import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, damp } from '../core/noise';
import { Clip, PoseMixer, pose } from './Rig';

/*
 * Syrian brown bear (Ursus arctos syriacus) — the bear of the Land of Israel ("הַדֹּב"),
 * pale straw-to-golden brown, shoulder hump, dished face, pale claws.
 * Shell-textured fur on a procedural joint hierarchy. Faces +Z.
 */

const SHELLS = 16;

function furMaterial(base: THREE.Color, tip: THREE.Color, furLen: number, density: number, shells: boolean) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  const u = {
    uBase: { value: base },
    uTip: { value: tip },
    uFurLen: { value: furLen },
    uDensity: { value: density },
    uWet: { value: 0 },
  };
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uFurLen; varying vec3 vBasePos; varying float vLayer;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vBasePos = position;
vLayer = 0.0;
${shells ? `
vLayer = float(gl_InstanceID) / ${(SHELLS - 1).toFixed(1)};
vec3 comb = normalize(normal + vec3(0.0, -0.55, -0.35));
transformed += mix(normal, comb, vLayer * 0.6) * vLayer * uFurLen;
` : ''}`,
      );
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uBase; uniform vec3 uTip; uniform float uDensity; varying vec3 vBasePos; varying float vLayer;
float fh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 fh3(vec3 p){ return vec3(fh(p), fh(p + 13.7), fh(p + 29.3)); }`)
      .replace(
        '#include <map_fragment>',
        `{
  vec3 q = vBasePos * uDensity;
  vec3 cell = floor(q);
  float h = fh(cell);
  float clump = fh(floor(vBasePos * uDensity * 0.18));
  ${shells ? `
  vec3 f = fract(q) - 0.5 - (fh3(cell) - 0.5) * 0.45;
  float d = length(f);
  float r = 0.72 * pow(1.0 - vLayer, 1.35) * (0.7 + 0.3 * h);
  if (vLayer > 0.02 && (d > r || h < vLayer * vLayer * 0.45)) discard;
  ` : ''}
  vec3 c = mix(uBase, uTip, clamp(vLayer * 1.3 + (clump - 0.5) * 0.4, 0.0, 1.0));
  c *= mix(0.62, 1.0, smoothstep(0.0, 0.7, vLayer)) * (0.88 + 0.24 * h);
  diffuseColor.rgb *= c;
}`,
      );
  };
  mat.customProgramCacheKey = () => `fur-${shells}-${base.getHexString()}-${tip.getHexString()}-${furLen}`;
  return mat;
}

function ell(rx: number, ry: number, rz: number, x = 0, y = 0, z = 0, w = 24, h = 16) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  return g;
}

function taper(len: number, r0: number, r1: number, radial = 16) {
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(0.0001, r0 * 0.5));
  for (let i = 0; i <= 3; i++) {
    const a = (i / 3) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.sin(a) * r0, Math.cos(a) * r0 * 0.5));
  }
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2(THREE.MathUtils.lerp(r0, r1, t) + Math.sin(t * Math.PI) * r0 * 0.08, -len * t));
  }
  pts.push(new THREE.Vector2(r1 * 0.7, -len - r1 * 0.4));
  pts.push(new THREE.Vector2(0.0001, -len - r1 * 0.55));
  return new THREE.LatheGeometry(pts, radial);
}

function mergeParts(list: THREE.BufferGeometry[]) {
  return mergeGeometries(list.map((g) => {
    const x = g.index ? g.toNonIndexed() : g;
    for (const n of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(n)) x.deleteAttribute(n);
    return x;
  }))!;
}

// ------------------------------------------------------------------------------------ poses
const REAR = pose({
  pelvis: [-1.18, 0, 0], spine: [0.1, 0, 0], neck: [0.55, 0, 0], head: [0.35, 0, 0],
  hlUA: [1.05, 0, 0.12], hlLA: [0.2, 0, 0], hlP: [-0.1, 0, 0],
  hrUA: [1.05, 0, -0.12], hrLA: [0.2, 0, 0], hrP: [-0.1, 0, 0],
  flUA: [-0.2, 0, 0.45], flLA: [-0.9, 0, 0], flP: [0.6, 0, 0],
  frUA: [-0.2, 0, -0.45], frLA: [-0.9, 0, 0], frP: [0.6, 0, 0],
}, 0);

const SWIPE = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.3, p: pose({ frUA: [-1.6, 0, -0.7], frLA: [-0.8, 0, 0], spine: [0, -0.25, 0], head: [0.1, 0.3, 0], neck: [0, 0.2, 0] }) },
  { t: 0.48, p: pose({ frUA: [-0.6, 0, 0.35], frLA: [-0.1, 0, 0], spine: [0.1, 0.35, 0], head: [0.2, -0.2, 0], neck: [0, -0.2, 0] }) },
  { t: 0.85, p: pose({}) },
]);

const SWIPE_HIGH = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.35, p: pose({ frUA: [-0.4, 0, -1.4], frLA: [-1.2, 0, 0], spine: [0, -0.35, 0], neck: [0, 0.2, 0] }) },
  { t: 0.52, p: pose({ frUA: [-1.3, 0, 0.3], frLA: [-0.3, 0, 0], spine: [0.15, 0.4, 0], neck: [0.2, -0.3, 0] }) },
  { t: 0.95, p: pose({}) },
]);

const HURT = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.08, p: pose({ neck: [-0.5, 0.4, 0.2], head: [-0.3, 0.3, 0.3], spine: [-0.1, 0.1, 0] }) },
  { t: 0.5, p: pose({}) },
]);

export type BearHold = 'none' | 'rear' | 'carry' | 'down';

export class BearModel {
  readonly root = new THREE.Group();
  readonly j: Record<string, THREE.Object3D> = {};
  readonly mixer: PoseMixer;
  readonly mouthSocket = new THREE.Object3D();
  readonly beardSocket = new THREE.Object3D();
  readonly headCenter = new THREE.Object3D();
  speed = 0;
  hold: BearHold = 'none';
  roar = 0; // 0..1 mouth open / roar intensity (set by gameplay)
  private holdW: Record<BearHold, number> = { none: 0, rear: 0, carry: 0, down: 0 };
  private phase = 0;
  private time = 0;
  private locoW = 0;
  private runW = 0;
  private action: { clip: Clip; t: number; events: { t: number; fn: () => void; fired: boolean }[] } | null = null;
  lookTarget: THREE.Vector3 | null = null;
  private look = new THREE.Vector2();
  deathT = -1;
  ground?: (x: number, z: number) => number;
  onFootfall?: () => void;
  private lastStep = 0;

  constructor() {
    this.build();
    this.mixer = new PoseMixer(this.j);
  }

  private build() {
    const base = new THREE.Color(0.12, 0.068, 0.03); // linear
    const tip = new THREE.Color(0.5, 0.33, 0.15);
    const legBase = new THREE.Color(0.08, 0.05, 0.028);
    const legTip = new THREE.Color(0.38, 0.25, 0.13);
    const furSkin = furMaterial(base, tip, 0.07, 190, false);
    const furShell = furMaterial(base, tip, 0.075, 190, true);
    const legSkin = furMaterial(legBase, legTip, 0.045, 220, false);
    const legShell = furMaterial(legBase, legTip, 0.05, 220, true);
    const nose = new THREE.MeshPhysicalMaterial({ color: 0x0c0806, roughness: 0.25, clearcoat: 0.6 });
    const eye = new THREE.MeshPhysicalMaterial({ color: 0x120a04, roughness: 0.05, clearcoat: 1 });
    const claw = new THREE.MeshStandardMaterial({ color: 0xcbbfa6, roughness: 0.4 });
    const mouth = new THREE.MeshStandardMaterial({ color: 0x3a0e0c, roughness: 0.6 });
    const teeth = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.35 });
    const tongue = new THREE.MeshStandardMaterial({ color: 0x9a4a4a, roughness: 0.5 });

    const J = (name: string, parent: THREE.Object3D, x: number, y: number, z: number) => {
      const o = new THREE.Group();
      o.position.set(x, y, z);
      parent.add(o);
      this.j[name] = o;
      return o;
    };
    const furry = (parent: THREE.Object3D, geo: THREE.BufferGeometry, skin: THREE.Material, shell: THREE.Material, shellsOn = true) => {
      const g0 = geo.clone();
      g0.deleteAttribute('uv');
      g0.deleteAttribute('normal');
      const g = mergeVertices(g0);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, skin);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      if (shellsOn) {
        const im = new THREE.InstancedMesh(g, shell, SHELLS);
        const id = new THREE.Matrix4();
        for (let i = 0; i < SHELLS; i++) im.setMatrixAt(i, id);
        im.castShadow = false;
        im.receiveShadow = true;
        im.frustumCulled = false;
        parent.add(im);
      }
      return m;
    };
    const plain = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    const pelvis = J('pelvis', this.root, 0, 0.82, -0.5);
    const spine = J('spine', pelvis, 0, 0.06, 0.55);
    const neck = J('neck', spine, 0, 0.1, 0.42);
    const head = J('head', neck, 0, -0.02, 0.26);
    head.scale.setScalar(1.22);
    const jaw = J('jaw', head, 0, -0.07, 0.04);

    // rear body + belly
    furry(pelvis, mergeParts([ell(0.36, 0.38, 0.46, 0, 0.0, 0.2)]), furSkin, furShell);
    // chest with the shoulder hump
    furry(spine, mergeParts([ell(0.4, 0.44, 0.44, 0, 0.0, 0.05), ell(0.26, 0.2, 0.3, 0, 0.3, -0.02)]), furSkin, furShell);
    // neck
    furry(neck, mergeParts([ell(0.27, 0.3, 0.3, 0, -0.02, 0.05)]), furSkin, furShell);
    // head: broad skull, dished face, snout
    const skull = ell(0.235, 0.205, 0.23, 0, 0.02, 0.0, 28, 20);
    {
      const p = skull.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        // cheek ruff wider at the bottom, forehead dish
        const k = THREE.MathUtils.smoothstep(-y + 0.02, -0.05, 0.12);
        p.setX(i, x * (1 + 0.18 * k));
        if (z > 0.1 && y > 0.02) p.setZ(i, z - (z - 0.1) * 0.35);
      }
    }
    furry(head, mergeParts([skull]), furSkin, furShell);
    const snout = mergeParts([ell(0.1, 0.088, 0.17, 0, -0.035, 0.22)]);
    furry(head, snout, legSkin, legShell, false);
    plain(head, ell(0.05, 0.036, 0.034, 0, -0.01, 0.385, 16, 12), nose);
    for (const s of [1, -1]) {
      furry(head, mergeParts([ell(0.068, 0.07, 0.03, 0.16 * s, 0.2, -0.03)]), furSkin, furShell);
      plain(head, ell(0.019, 0.019, 0.013, 0.095 * s, 0.075, 0.19, 12, 10), eye);
    }
    // lower jaw + mouth interior + teeth
    plain(jaw, ell(0.08, 0.034, 0.15, 0, -0.016, 0.19), legSkin);
    plain(head, ell(0.08, 0.05, 0.14, 0, -0.08, 0.2), mouth);
    plain(jaw, ell(0.055, 0.016, 0.11, 0, 0.012, 0.18), tongue);
    for (const s of [1, -1]) {
      const c = new THREE.ConeGeometry(0.009, 0.035, 8);
      c.rotateX(Math.PI);
      c.translate(0.046 * s, -0.09, 0.31);
      plain(head, c, teeth);
      const c2 = new THREE.ConeGeometry(0.008, 0.03, 8);
      c2.translate(0.042 * s, 0.03, 0.28);
      plain(jaw, c2, teeth);
    }
    this.headCenter.position.set(0, 0.02, 0.1);
    head.add(this.headCenter);
    this.mouthSocket.position.set(0, -0.07, 0.27);
    head.add(this.mouthSocket);
    this.beardSocket.position.set(0, -0.14, 0.12);
    head.add(this.beardSocket);
    // chin ruff — the "beard" (זָקָן) David seizes
    furry(jaw, mergeParts([ell(0.1, 0.07, 0.1, 0, -0.06, 0.06)]), furSkin, furShell);

    // legs
    const legDefs: [string, THREE.Object3D, number, number, number, number, number][] = [
      ['fl', spine, 0.22, -0.2, 0.2, 0.42, 0.36],
      ['fr', spine, -0.22, -0.2, 0.2, 0.42, 0.36],
      ['hl', pelvis, 0.2, -0.12, 0.08, 0.42, 0.38],
    ];
    legDefs.push(['hr', pelvis, -0.2, -0.12, 0.08, 0.42, 0.38]);
    for (const [n, parent, x, y, z, l1, l2] of legDefs) {
      const ua = J(n + 'UA', parent, x, y, z);
      const la = J(n + 'LA', ua, 0, -l1, 0);
      const pw = J(n + 'P', la, 0, -l2 + 0.02, 0);
      furry(ua, mergeParts([taper(l1, 0.15, 0.1)]), furSkin, furShell);
      furry(la, mergeParts([taper(l2, 0.1, 0.085)]), legSkin, legShell);
      // paw + pale claws
      plain(pw, mergeParts([ell(0.095, 0.05, 0.13, 0, -0.03, 0.05)]), legSkin);
      for (let k = 0; k < 5; k++) {
        const c = new THREE.ConeGeometry(0.009, 0.06, 6);
        c.rotateX(Math.PI / 2 + 0.5);
        c.translate((k - 2) * 0.034, -0.05, 0.19 + (k === 0 || k === 4 ? -0.015 : 0));
        plain(pw, c, claw);
      }
    }
    // stubby tail
    furry(pelvis, mergeParts([ell(0.05, 0.05, 0.06, 0, 0.14, -0.28)]), furSkin, furShell);
  }

  play(name: 'swipe' | 'swipeHigh' | 'hurt', events: { t: number; fn: () => void }[] = []) {
    const clip = name === 'swipe' ? SWIPE : name === 'swipeHigh' ? SWIPE_HIGH : HURT;
    this.action = { clip, t: 0, events: events.map((e) => ({ ...e, fired: false })) };
  }
  get busy() {
    return !!this.action;
  }

  update(dt: number) {
    this.time += dt;
    const m = this.mixer;
    m.reset();
    const v = this.speed;
    this.locoW = damp(this.locoW, clamp(v / 1.0, 0, 1), 6, dt);
    this.runW = damp(this.runW, clamp((v - 2.5) / 3.0, 0, 1), 4, dt);
    const cycle = THREE.MathUtils.lerp(1.6, 3.2, this.runW);
    this.phase += (Math.PI * 2 * v * dt) / cycle;
    const P = this.phase;
    const A = THREE.MathUtils.lerp(0.42, 0.75, this.runW) * this.locoW;
    const offs = {
      hl: 0,
      fl: THREE.MathUtils.lerp(0.25, 0.0, this.runW),
      hr: THREE.MathUtils.lerp(0.5, 0.08, this.runW),
      fr: THREE.MathUtils.lerp(0.75, 0.1, this.runW),
    } as Record<string, number>;
    if (this.runW > 0.01) {
      offs.hl = THREE.MathUtils.lerp(0, 0.55, this.runW);
      offs.hr = THREE.MathUtils.lerp(0.5, 0.62, this.runW);
    }
    const r: Record<string, [number, number, number]> = {};
    for (const leg of ['fl', 'fr', 'hl', 'hr']) {
      const ph = P + offs[leg] * Math.PI * 2;
      const s = Math.sin(ph), c = Math.cos(ph);
      const front = leg[0] === 'f';
      r[leg + 'UA'] = [-s * A, 0, 0];
      const lift = Math.max(0, c) * (front ? 1.1 : 0.8) * this.locoW;
      r[leg + 'LA'] = [front ? lift : lift * 0.6, 0, 0];
      r[leg + 'P'] = [front ? -lift * 0.5 : 0.2 * lift, 0, 0];
    }
    const breath = Math.sin(this.time * 1.6) * 0.02;
    r.pelvis = [0, Math.sin(P) * 0.05 * this.locoW, 0];
    r.spine = [Math.sin(P * 2) * 0.03 * this.locoW + Math.sin(P) * 0.12 * this.runW + breath, -Math.sin(P) * 0.06 * this.locoW, 0];
    r.neck = [-0.05 + Math.sin(P * 2) * 0.05 * this.locoW + 0.15 * (1 - this.locoW), Math.sin(this.time * 0.3) * 0.2 * (1 - this.locoW), 0];
    r.head = [0.1 + Math.sin(P * 2 + 1) * 0.05 * this.locoW, 0, 0];
    r.jaw = [0, 0, 0];
    m.layer({ r, hipsY: 0 }, 1);
    this.root.position.y += 0; // (ground handled by gameplay)

    for (const k of Object.keys(this.holdW) as BearHold[]) this.holdW[k] = damp(this.holdW[k], this.hold === k ? 1 : 0, k === 'rear' ? 3.2 : 5, dt);
    if (this.holdW.carry > 0.001) m.layer(pose({ neck: [-0.35, 0, 0], head: [0.25, 0, 0], jaw: [0.35, 0, 0] }), this.holdW.carry, ['neck', 'head', 'jaw']);
    if (this.holdW.rear > 0.001) {
      m.layer(REAR, this.holdW.rear);
      // paws paddle while standing
      m.add('flUA', Math.sin(this.time * 2.2) * 0.12 * this.holdW.rear, 0, 0);
      m.add('frUA', Math.sin(this.time * 2.2 + 1.5) * 0.12 * this.holdW.rear, 0, 0);
    }
    if (this.action) {
      const a = this.action;
      a.t += dt;
      const w = Math.min(1, a.t / 0.08, (a.clip.duration - a.t) / 0.15);
      m.layer(a.clip.sample(a.t, { r: {} }), Math.max(0, w));
      for (const e of a.events) if (!e.fired && a.t >= e.t) { e.fired = true; e.fn(); }
      if (a.t >= a.clip.duration) this.action = null;
    }
    // roar: open jaw wide, head up and shaking
    if (this.roar > 0.001) {
      m.add('jaw', this.roar * 0.75, 0, 0);
      m.add('head', -this.roar * 0.25, Math.sin(this.time * 18) * 0.06 * this.roar, 0);
      m.add('neck', -this.roar * 0.15, 0, 0);
    }
    // look at target (yaw only)
    if (this.lookTarget) {
      const local = this.root.worldToLocal(tmp.copy(this.lookTarget));
      const yaw = clamp(Math.atan2(local.x, local.z), -0.9, 0.9);
      this.look.x = damp(this.look.x, yaw, 4, dt);
    } else this.look.x = damp(this.look.x, 0, 3, dt);
    m.add('neck', 0, this.look.x * 0.5, 0);
    m.add('head', 0, this.look.x * 0.4, 0);
    if (this.holdW.down > 0.001) {
      const d = this.holdW.down;
      m.layer(pose({ neck: [0.3, 0, 0.3], head: [0.2, 0, 0.4], jaw: [0.2, 0, 0], flUA: [-0.3, 0, 0.9], frUA: [-0.2, 0, 0.6], hlUA: [-0.3, 0, 0.8], hrUA: [-0.2, 0, 0.5], flLA: [0.4, 0, 0], frLA: [0.6, 0, 0] }), d);
    }
    m.apply();
    // footfall sound on heavy steps
    const st = Math.sin(P);
    if (Math.sign(st) !== this.lastStep && this.locoW > 0.5) this.onFootfall?.();
    this.lastStep = Math.sign(st);
    // collapse: roll onto the side
    const down = this.holdW.down;
    this.j.pelvis.position.y = 0.82 - down * 0.45 + this.holdW.rear * 0.08;
    this.j.pelvis.rotation.z = down * 1.35;
    this.root.updateMatrixWorld(true);
  }

  /** Approximate hit capsule centre points (world) for projectiles and melee. */
  hitPoints(out: THREE.Vector3[]) {
    out[0] = this.j.pelvis.localToWorld((out[0] ?? new THREE.Vector3()).set(0, 0, 0.2));
    out[1] = this.j.spine.localToWorld((out[1] ?? new THREE.Vector3()).set(0, 0.05, 0.05));
    out[2] = this.headCenter.getWorldPosition(out[2] ?? new THREE.Vector3());
    return out;
  }
}

const tmp = new THREE.Vector3();
