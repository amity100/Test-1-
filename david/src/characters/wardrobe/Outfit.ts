import * as THREE from 'three';
import type { HumanModel } from '../human/HumanModel';
import { OutfitUniforms } from './materials';

/*
 * Outfit — the dressed state of one HumanModel: skinned garments (children of human.root), rigid accessories on
 * sockets, dynamic parts (verlet cords / tassels / tzitzit, a satchel pendulum), hand props (NOT attached) and
 * the per-outfit uniforms (hem sway, leg capsules for skirt collision).
 *
 *   outfit.update(dt, { velocity, wind })   once per frame AFTER human.update() (bones must be current)
 */

export interface Prop {
  object: THREE.Object3D;
  /** frame for the hand socket (human.sockets.handGripL/R): +Y along the shaft, origin on the axis */
  grip: THREE.Object3D;
  tip: THREE.Object3D;
  butt: THREE.Object3D;
}

export interface OutfitProps {
  staff?: Prop;
  slingPouch?: THREE.Object3D;
  slingCordMaterial?: THREE.Material;
  satchel?: THREE.Object3D;
  spear?: Prop;
  sword?: THREE.Object3D;
  shield?: THREE.Object3D;
  dagger?: THREE.Object3D;
}

export interface OutfitStats {
  triangles: number;
  drawCalls: number;
  textures: string[];
  buildMs: number;
}

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();

/** Leg capsule driven by two bones (root space), used for skirt collision in the vertex shader and by cords. */
export interface Capsule {
  a: string;
  b: string;
  radius: number;
  /** extra push radius for cords (outside the cloth) */
  cordRadius: number;
}

/** A verlet chain hanging from a socket, rendered as a tube (+ optional tassel cards at the end). */
export class Chain {
  readonly n: number;
  readonly p: Float32Array;
  readonly o: Float32Array;
  readonly mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private radial: number;
  private seg: number;
  private tasselCards: number;
  private started = false;
  private frames: THREE.Vector3[];

  constructor(
    readonly anchor: THREE.Object3D,
    readonly length: number,
    segments: number,
    readonly radius: number,
    material: THREE.Material | THREE.Material[],
    opts: { radial?: number; tassel?: { length: number; cards: number }; color?: THREE.Color; initialDir?: THREE.Vector3; stiffness?: number } = {},
  ) {
    this.n = segments + 1;
    this.seg = length / segments;
    this.p = new Float32Array(this.n * 3);
    this.o = new Float32Array(this.n * 3);
    this.radial = opts.radial ?? 5;
    this.tasselCards = opts.tassel ? opts.tassel.cards : 0;
    this.tassel = opts.tassel ?? { length: 0, cards: 0 };
    this.initialDir = (opts.initialDir ?? new THREE.Vector3(0, -1, 0)).clone().normalize();
    this.stiffness = opts.stiffness ?? 0.15;
    const ring = this.radial + 1;
    const tubeV = this.n * ring;
    const cardV = this.tasselCards * 4;
    const V = tubeV + cardV;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(V * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(V * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const uv = new Float32Array(V * 2);
    const gd = new Float32Array(V * 4);
    const idx: number[] = [];
    for (let i = 0; i < this.n; i++)
      for (let j = 0; j <= this.radial; j++) {
        const k = i * ring + j;
        uv[k * 2] = j / this.radial;
        uv[k * 2 + 1] = (i / (this.n - 1)) * length;
        if (i < this.n - 1 && j < this.radial) {
          const a = k, b = k + 1, c = k + ring, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
    const tubeIdx = idx.length;
    for (let t = 0; t < this.tasselCards; t++) {
      const b = tubeV + t * 4;
      const u0 = t * 0.037;
      uv.set([u0, 0, u0 + 0.03, 0, u0, 1, u0 + 0.03, 1], b * 2);
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('gdata', new THREE.BufferAttribute(gd, 4));
    g.setIndex(idx);
    if (Array.isArray(material)) {
      g.addGroup(0, tubeIdx, 0);
      g.addGroup(tubeIdx, idx.length - tubeIdx, 1);
    }
    if (opts.color) {
      const col = new Float32Array(V * 3);
      for (let i = 0; i < V; i++) opts.color.toArray(col, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    this.geo = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.frames = Array.from({ length: this.n }, () => new THREE.Vector3());
  }
  private tassel: { length: number; cards: number };
  private initialDir: THREE.Vector3;
  private stiffness: number;

  reset() {
    this.anchor.getWorldPosition(_v);
    _w.copy(this.initialDir).transformDirection(this.anchor.matrixWorld);
    for (let i = 0; i < this.n; i++) {
      const x = _v.x + _w.x * this.seg * i, y = _v.y + _w.y * this.seg * i, z = _v.z + _w.z * this.seg * i;
      this.p[i * 3] = this.o[i * 3] = x;
      this.p[i * 3 + 1] = this.o[i * 3 + 1] = y;
      this.p[i * 3 + 2] = this.o[i * 3 + 2] = z;
    }
    this.started = true;
  }

  step(dt: number, wind: THREE.Vector3, caps: Float32Array, capCount: number) {
    if (!this.started) this.reset();
    const p = this.p, o = this.o, n = this.n;
    this.anchor.getWorldPosition(_v);
    p[0] = _v.x;
    p[1] = _v.y;
    p[2] = _v.z;
    // the first segment leaves the knot along the anchor's direction (stiff root)
    _w.copy(this.initialDir).transformDirection(this.anchor.matrixWorld);
    const g = -9.81 * dt * dt;
    const damp = 0.985;
    for (let i = 1; i < n; i++) {
      const k = i * 3;
      const vx = (p[k] - o[k]) * damp, vy = (p[k + 1] - o[k + 1]) * damp, vz = (p[k + 2] - o[k + 2]) * damp;
      o[k] = p[k];
      o[k + 1] = p[k + 1];
      o[k + 2] = p[k + 2];
      const wf = dt * dt * (0.6 + 0.4 * Math.sin(i * 1.7 + performance.now() * 0.003));
      p[k] += vx + wind.x * wf;
      p[k + 1] += vy + g + wind.y * wf;
      p[k + 2] += vz + wind.z * wf;
    }
    for (let it = 0; it < 4; it++) {
      p[0] = _v.x;
      p[1] = _v.y;
      p[2] = _v.z;
      // stiff root
      const s = this.stiffness;
      p[3] += (_v.x + _w.x * this.seg - p[3]) * s;
      p[4] += (_v.y + _w.y * this.seg - p[4]) * s;
      p[5] += (_v.z + _w.z * this.seg - p[5]) * s;
      for (let i = 0; i < n - 1; i++) {
        const a = i * 3, b = a + 3;
        const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const diff = (d - this.seg) / d;
        if (i === 0) {
          p[b] -= dx * diff;
          p[b + 1] -= dy * diff;
          p[b + 2] -= dz * diff;
        } else {
          p[a] += dx * diff * 0.5;
          p[a + 1] += dy * diff * 0.5;
          p[a + 2] += dz * diff * 0.5;
          p[b] -= dx * diff * 0.5;
          p[b + 1] -= dy * diff * 0.5;
          p[b + 2] -= dz * diff * 0.5;
        }
      }
      // capsules (world space)
      for (let c = 0; c < capCount; c++) {
        const ax = caps[c * 7], ay = caps[c * 7 + 1], az = caps[c * 7 + 2];
        const bx = caps[c * 7 + 3], by = caps[c * 7 + 4], bz = caps[c * 7 + 5], r = caps[c * 7 + 6];
        const ex = bx - ax, ey = by - ay, ez = bz - az;
        const ee = ex * ex + ey * ey + ez * ez || 1e-6;
        for (let i = 1; i < n; i++) {
          const k = i * 3;
          let t = ((p[k] - ax) * ex + (p[k + 1] - ay) * ey + (p[k + 2] - az) * ez) / ee;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const cx = ax + ex * t, cy = ay + ey * t, cz = az + ez * t;
          const dx = p[k] - cx, dy = p[k + 1] - cy, dz = p[k + 2] - cz;
          const l = Math.hypot(dx, dy, dz);
          if (l < r && l > 1e-6) {
            const f = r / l;
            p[k] = cx + dx * f;
            p[k + 1] = cy + dy * f;
            p[k + 2] = cz + dz * f;
          }
        }
      }
    }
  }

  /** rebuild the tube in the space of `parentInv` (world -> mesh parent) */
  write(parentInv: THREE.Matrix4) {
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const nor = this.geo.getAttribute('normal') as THREE.BufferAttribute;
    const n = this.n, ring = this.radial + 1;
    const P = this.frames;
    for (let i = 0; i < n; i++) P[i].fromArray(this.p, i * 3).applyMatrix4(parentInv);
    // parallel-transport frames
    const t = _v, u = _w, v = new THREE.Vector3();
    const prevU = new THREE.Vector3(1, 0, 0);
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      t.subVectors(b, a);
      if (t.lengthSq() < 1e-12) t.set(0, -1, 0);
      t.normalize();
      u.copy(prevU).addScaledVector(t, -prevU.dot(t));
      if (u.lengthSq() < 1e-8) u.set(0, 0, 1).addScaledVector(t, -t.z);
      u.normalize();
      prevU.copy(u);
      v.crossVectors(t, u);
      const taper = i === n - 1 ? 0.75 : 1;
      for (let j = 0; j <= this.radial; j++) {
        const ang = (j / this.radial) * Math.PI * 2;
        const c = Math.cos(ang), s = Math.sin(ang);
        const nx = u.x * c + v.x * s, ny = u.y * c + v.y * s, nz = u.z * c + v.z * s;
        const k = i * ring + j;
        const r = this.radius * taper;
        pos.setXYZ(k, P[i].x + nx * r, P[i].y + ny * r, P[i].z + nz * r);
        nor.setXYZ(k, nx, ny, nz);
      }
      if (i === n - 1 && this.tasselCards) {
        // crossed cards continuing the last segment
        const base = n * ring;
        const L = this.tassel.length;
        for (let c = 0; c < this.tasselCards; c++) {
          const ang = (c / this.tasselCards) * Math.PI;
          const cx = Math.cos(ang), sx = Math.sin(ang);
          const wx = u.x * cx + v.x * sx, wy = u.y * cx + v.y * sx, wz = u.z * cx + v.z * sx;
          const w = this.radius * 2.6;
          const k = base + c * 4;
          const end = P[i];
          const flare = 1.8;
          pos.setXYZ(k, end.x - wx * w, end.y - wy * w, end.z - wz * w);
          pos.setXYZ(k + 1, end.x + wx * w, end.y + wy * w, end.z + wz * w);
          pos.setXYZ(k + 2, end.x + t.x * L - wx * w * flare, end.y + t.y * L - wy * w * flare, end.z + t.z * L - wz * w * flare);
          pos.setXYZ(k + 3, end.x + t.x * L + wx * w * flare, end.y + t.y * L + wy * w * flare, end.z + t.z * L + wz * w * flare);
          // normal: perpendicular to the card
          const nx = t.y * wz - t.z * wy, ny = t.z * wx - t.x * wz, nz = t.x * wy - t.y * wx;
          for (let q = 0; q < 4; q++) nor.setXYZ(k + q, nx, ny, nz);
        }
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
  }
}

/** Damped pendulum for a rigid accessory (satchel, scabbard): swings about its pivot from the pivot's acceleration. */
export class Pendulum {
  private prev = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private ang = new THREE.Vector2();
  private angV = new THREE.Vector2();
  private started = false;
  constructor(
    readonly pivot: THREE.Object3D,
    readonly body: THREE.Object3D,
    readonly opts: { freq: number; damping: number; gain: number; limit: number },
  ) {}
  step(dt: number, wind: THREE.Vector3) {
    if (dt <= 0) return;
    this.pivot.getWorldPosition(_v);
    if (!this.started) {
      this.prev.copy(_v);
      this.started = true;
    }
    const nv = _w.subVectors(_v, this.prev).divideScalar(dt);
    const acc = nv.clone().sub(this.vel).divideScalar(dt);
    this.vel.copy(nv);
    this.prev.copy(_v);
    // acceleration into the pivot's local frame
    this.pivot.getWorldQuaternion(_q).invert();
    acc.applyQuaternion(_q);
    const wl = wind.clone().applyQuaternion(_q);
    const k = (2 * Math.PI * this.opts.freq) ** 2;
    const c = 2 * this.opts.damping * 2 * Math.PI * this.opts.freq;
    // x-rotation swings the bag forward/back (driven by -z acceleration), z-rotation sideways (+x acceleration)
    const fx = (acc.z * -1 + wl.z * 0.3) * this.opts.gain;
    const fz = (acc.x + wl.x * 0.3) * this.opts.gain;
    this.angV.x += (-k * this.ang.x - c * this.angV.x - fx) * dt;
    this.angV.y += (-k * this.ang.y - c * this.angV.y + fz) * dt;
    this.ang.x = THREE.MathUtils.clamp(this.ang.x + this.angV.x * dt, -this.opts.limit, this.opts.limit);
    this.ang.y = THREE.MathUtils.clamp(this.ang.y + this.angV.y * dt, -this.opts.limit, this.opts.limit);
    this.body.rotation.set(this.ang.x, 0, this.ang.y);
  }
}

export class Outfit {
  readonly root = new THREE.Group();
  readonly props: OutfitProps = {};
  readonly uniforms = new OutfitUniforms();
  readonly meshes: THREE.Object3D[] = [];
  readonly chains: Chain[] = [];
  readonly pendulums: Pendulum[] = [];
  readonly capsules: Capsule[] = [];
  readonly stats: OutfitStats = { triangles: 0, drawCalls: 0, textures: [], buildMs: 0 };
  /** sandal sole thickness (m): raise the character by this (root.position.y or foot-IK ground height) */
  groundOffset = 0;
  private swayVel = new THREE.Vector3();
  private sway = new THREE.Vector3();
  private caps = new Float32Array(8 * 7);
  private rootInv = new THREE.Matrix4();
  private disposables = new Set<{ dispose(): void }>();

  constructor(readonly human: HumanModel, readonly name: string) {
    this.root.name = `outfit:${name}`;
    human.root.add(this.root);
  }

  /** register an object (already parented) for visibility, stats and disposal */
  add<T extends THREE.Object3D>(o: T): T {
    this.meshes.push(o);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        this.disposables.add(m.geometry);
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) this.disposables.add(mat);
        if (m.customDepthMaterial) this.disposables.add(m.customDepthMaterial);
      }
    });
    return o;
  }

  addChain(c: Chain) {
    this.chains.push(c);
    this.human.root.add(c.mesh);
    this.add(c.mesh);
    return c;
  }

  finish(t0: number) {
    let tris = 0, calls = 0;
    const tex = new Set<string>();
    const visit = (o: THREE.Object3D) =>
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (!m.isMesh) return;
        const g = m.geometry;
        const count = g.index ? g.index.count : (g.getAttribute('position') as THREE.BufferAttribute).count;
        tris += count / 3;
        calls += Array.isArray(m.material) ? Math.max(1, g.groups.length) : 1;
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          const u = mat.userData.wardrobe as Record<string, THREE.IUniform> | undefined;
          if (u) for (const v of Object.values(u)) if (v.value instanceof THREE.Texture) tex.add(`${v.value.name} ${v.value.image?.width ?? '?'}px`);
        }
      });
    for (const o of this.meshes) visit(o);
    for (const p of Object.values(this.props)) if (p && (p as Prop).object) visit((p as Prop).object);
    this.stats.triangles = Math.round(tris);
    this.stats.drawCalls = calls;
    this.stats.textures = [...tex];
    this.stats.buildMs = performance.now() - t0;
  }

  /** Per frame, after human.update(). velocity/wind in world space (m/s). */
  update(dt: number, ctx: { velocity: THREE.Vector3; wind: THREE.Vector3 }) {
    dt = Math.min(Math.max(dt, 0), 1 / 20);
    const u = this.uniforms;
    u.uSwayTime.value += dt;
    this.rootInv.copy(this.human.root.matrixWorld).invert();
    // hem sway: damped spring toward (-velocity * k + wind * k2), in root space
    const target = _v.copy(ctx.velocity).multiplyScalar(-0.035).addScaledVector(ctx.wind, 0.012);
    this.human.root.getWorldQuaternion(_q).invert();
    target.applyQuaternion(_q);
    target.y = 0;
    const k = 60, c = 9;
    if (dt > 0) {
      this.swayVel.addScaledVector(_w.copy(target).sub(this.sway).multiplyScalar(k).addScaledVector(this.swayVel, -c), dt);
      this.sway.addScaledVector(this.swayVel, dt);
    }
    this.sway.clampLength(0, 0.12);
    u.uSway.value.copy(this.sway);
    // leg capsules
    const bones = this.human.bones;
    let cc = 0;
    for (let i = 0; i < this.capsules.length && i < 4; i++) {
      const cap = this.capsules[i];
      const a = bones[cap.a], b = bones[cap.b];
      if (!a || !b) continue;
      a.getWorldPosition(_v);
      b.getWorldPosition(_w);
      // world capsule for cords
      this.caps.set([_v.x, _v.y, _v.z, _w.x, _w.y, _w.z, cap.cordRadius], cc * 7);
      cc++;
      _v.applyMatrix4(this.rootInv);
      _w.applyMatrix4(this.rootInv);
      u.uCapA.value[i].set(_v.x, _v.y, _v.z, cap.radius);
      u.uCapB.value[i].set(_w.x, _w.y, _w.z, cap.radius);
    }
    if (dt > 0) {
      for (const ch of this.chains) ch.step(dt, ctx.wind, this.caps, cc);
      for (const p of this.pendulums) p.step(dt, ctx.wind);
    }
    for (const ch of this.chains) ch.write(this.rootInv);
  }

  /** snap dynamic parts to the current pose (after teleports / cuts) */
  resetDynamics() {
    for (const ch of this.chains) ch.reset();
    this.sway.set(0, 0, 0);
    this.swayVel.set(0, 0, 0);
  }

  setVisible(v: boolean) {
    this.root.visible = v;
    for (const m of this.meshes) m.visible = v;
  }

  dispose() {
    for (const m of this.meshes) m.removeFromParent();
    this.root.removeFromParent();
    for (const d of this.disposables) d.dispose();
    for (const p of Object.values(this.props)) {
      const o = (p as Prop | undefined)?.object ?? (p as THREE.Object3D | undefined);
      if (o && (o as THREE.Object3D).isObject3D)
        (o as THREE.Object3D).traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.isMesh) {
            m.geometry.dispose();
            for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
          }
        });
    }
    this.disposables.clear();
    void _m;
  }
}
