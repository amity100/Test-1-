import * as THREE from 'three';
import type { HumanModel } from '../human/HumanModel';
import type { Tube } from './loft';
import { noise1, rng } from './loft';

/*
 * The tearing of Samuel's me'il (1 Sam 15:27 "וַיַּחֲזֵק בִּכְנַף־מְעִילוֹ וַיִּקָּרַע"; docs/visual-bible.md 3.3).
 *
 * At build time the lower corner of the me'il skirt (the כָּנָף with its tzitzit) is split off the skirt along a
 * stepped line (hand-woven wool tears along the weave) into its own skinned mesh: intact, the two look like one
 * cloth. When the tear starts the corner becomes a free cloth piece (position-based dynamics: edge constraints,
 * gravity, wind, damping) initialised from the skinned pose:
 *   - grab vertices (round the corner tip) follow the hand that holds them (`grab(socket)`),
 *   - tear-line vertices stay pinned to the skirt until the tear front passes them (`progress` 0..1), each one
 *     releasing a wool thread that stretches between the two edges and snaps at 1-7 cm, leaving frayed fibres
 *     dangling from both edges,
 *   - the tzitzit of that corner (the chain socket) move with the piece.
 * The piece ends in Saul's fist (shot 12). `onSnap(worldPos)` fires per snapped thread (lint / dust FX).
 */

export interface TearOptions {
  /** width of the torn piece along the hem (m) and its height at the slit edge (m) */
  width?: number;
  height?: number;
  seed?: number;
  /** material for the free piece (NOT skinned; same look as the me'il skirt) */
  freeMaterial: THREE.Material;
  /** thread colour */
  threadColor?: THREE.ColorRepresentation;
}

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();

/** CPU skinning (8 influences, LBS) of one vertex of a SkinnedMesh built by makeSkinned -> world position */
export function skinnedWorld(mesh: THREE.SkinnedMesh, i: number, out: THREE.Vector3): THREE.Vector3 {
  const g = mesh.geometry;
  const pos = g.getAttribute('position');
  _a.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix);
  out.set(0, 0, 0);
  const sk = mesh.skeleton;
  for (const [si, sw] of [['skinIndex', 'skinWeight'], ['skinIndex2', 'skinWeight2']] as const) {
    const I = g.getAttribute(si), W = g.getAttribute(sw);
    if (!I || !W) continue;
    for (let c = 0; c < 4; c++) {
      const w = W.getComponent(i, c);
      if (w <= 0) continue;
      const b = I.getComponent(i, c);
      _m.multiplyMatrices(sk.bones[b].matrixWorld, sk.boneInverses[b]);
      out.addScaledVector(_b.copy(_a).applyMatrix4(_m), w);
    }
  }
  out.applyMatrix4(mesh.bindMatrixInverse);
  return out.applyMatrix4(mesh.matrixWorld);
}

interface Thread {
  edge: number; // particle index of the flap edge vertex
  skirtV: number; // vertex index in the skirt mesh
  state: 0 | 1 | 2; // 0 intact, 1 stretched, 2 snapped
  breakLen: number;
  dA: THREE.Vector3;
  dB: THREE.Vector3;
}

export class MeilTear {
  /** the free piece (world space, add to the scene; hidden until the tear starts) */
  readonly free: THREE.Mesh;
  /** threads / frayed fibres (world space) */
  readonly threads: THREE.LineSegments;
  /** skinned flap (part of the robe while intact) */
  readonly flapSkinned: THREE.SkinnedMesh;
  /** 0 intact .. 1 torn through */
  progress = 0;
  wind = new THREE.Vector3();
  gravity = -9.81;
  /** fired when a thread snaps (world position): lint / dust puff */
  onSnap: ((p: THREE.Vector3) => void) | null = null;
  private started = false;
  private readonly vIdx: Uint32Array; // particle -> skirt vertex index
  private readonly p: Float32Array;
  private readonly prev: Float32Array;
  private readonly invM: Float32Array;
  private readonly cons: Uint32Array;
  private readonly rest: Float32Array;
  private readonly edgeTau: Float32Array; // per particle: release threshold (edge vertices), else -1
  private readonly grabW: Float32Array; // per particle: grab pin weight
  private readonly grabOff: Float32Array; // per particle offset in the hand frame
  private hand: THREE.Object3D | null = null;
  private handOn = 0;
  private threadList: Thread[] = [];
  private cornerP = 0; // particle nearest the corner tip
  private tzitzitSockets: THREE.Object3D[] = [];
  private tzitzitAnchor = new THREE.Object3D();
  private posAttr: THREE.BufferAttribute;
  private lineAttr: THREE.BufferAttribute;

  /**
   * @param skirtMesh the me'il skirt SkinnedMesh (makeSkinned; vertex order = tube order)
   * @param tube      its rest tube (meil.skirt.tube)
   * @param cornerTh  angle of the slit edge of the corner to tear (rad; 0 = front, +PI/2 = his left)
   * @param dirTh     +1 / -1: the direction (in th) in which the cloth extends from that slit edge
   */
  constructor(readonly human: HumanModel, skirtMesh: THREE.SkinnedMesh, tube: Tube, readonly skirtRef: { mesh: THREE.SkinnedMesh }, cornerTh: number, dirTh: number, hemY: number, o: TearOptions) {
    const width = o.width ?? 0.3, height = o.height ?? 0.34;
    const R = rng(o.seed ?? 27);
    const nz = noise1((o.seed ?? 27) + 5);
    const g = skirtMesh.geometry;
    const idx = g.getIndex()!;
    const P = tube.pos;
    const nv = P.length / 3;
    // stepped tear line: height of the boundary as a function of the arc distance from the slit edge
    const steps = 4;
    const stepH: number[] = [], stepA: number[] = [];
    for (let s = 0; s < steps; s++) {
      stepA.push(((s + 1) / steps) * width * (0.85 + 0.3 * R()));
      stepH.push(height * (1 - s / steps) * (0.9 + 0.2 * R()));
    }
    const boundary = (arc: number) => {
      for (let s = 0; s < steps; s++) if (arc < stepA[s]) return stepH[s] + (nz(arc * 40) - 0.5) * 0.012;
      return -1;
    };
    const arcOf = (i: number) => {
      const x = P[i * 3], z = P[i * 3 + 2];
      const th = Math.atan2(x, z);
      let d = (th - cornerTh) * dirTh;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      return d * Math.hypot(x, z);
    };
    const inside = (i: number) => {
      const arc = arcOf(i);
      if (arc < -0.03) return false;
      return P[i * 3 + 1] - hemY < boundary(Math.max(0, arc));
    };
    const flapT: number[] = [], mainT: number[] = [];
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
      const n = (inside(a) ? 1 : 0) + (inside(b) ? 1 : 0) + (inside(c) ? 1 : 0);
      (n >= 2 ? flapT : mainT).push(a, b, c);
    }
    // skinned flap: same attributes, its own index
    const fg = g.clone();
    fg.setIndex(flapT);
    g.setIndex(mainT);
    const flap = new THREE.SkinnedMesh(fg, skirtMesh.material);
    flap.name = 'meilCorner';
    flap.bind(skirtMesh.skeleton, skirtMesh.bindMatrix);
    flap.castShadow = skirtMesh.castShadow;
    flap.receiveShadow = skirtMesh.receiveShadow;
    flap.customDepthMaterial = skirtMesh.customDepthMaterial;
    flap.frustumCulled = false;
    skirtMesh.parent!.add(flap);
    this.flapSkinned = flap;
    // particles = vertices used by the flap
    const map = new Int32Array(nv).fill(-1);
    const list: number[] = [];
    for (const v of flapT) if (map[v] < 0) {
      map[v] = list.length;
      list.push(v);
    }
    this.vIdx = Uint32Array.from(list);
    const n = list.length;
    this.p = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.invM = new Float32Array(n).fill(1);
    this.edgeTau = new Float32Array(n).fill(-1);
    this.grabW = new Float32Array(n);
    this.grabOff = new Float32Array(n * 3);
    // constraints: triangle edges (+ bending: second neighbours along the grid are implied by the triangles)
    const edges = new Set<string>();
    const cons: number[] = [], rest: number[] = [];
    const addC = (a: number, b: number) => {
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      if (edges.has(k)) return;
      edges.add(k);
      cons.push(map[a], map[b]);
      rest.push(Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]));
    };
    for (let t = 0; t < flapT.length; t += 3) {
      addC(flapT[t], flapT[t + 1]);
      addC(flapT[t + 1], flapT[t + 2]);
      addC(flapT[t + 2], flapT[t]);
    }
    this.cons = Uint32Array.from(cons);
    this.rest = Float32Array.from(rest);
    // tear-line vertices: used by both sets. Release order: from the slit edge inward (the tear runs from the
    // corner Saul pulls toward the inside of the cloth)
    const inMain = new Uint8Array(nv);
    for (const v of mainT) inMain[v] = 1;
    let maxArc = 0;
    let bestCorner = -1, bestScore = Infinity;
    for (let k = 0; k < n; k++) {
      const v = list[k];
      const arc = Math.max(0, arcOf(v));
      if (inMain[v]) {
        this.edgeTau[k] = arc;
        maxArc = Math.max(maxArc, arc);
      }
      // the grab point: on the slit edge near the top of the piece (the highest point Saul's hand can reach)
      const s = Math.abs(arc - 0.04) + Math.abs(P[v * 3 + 1] - hemY - (height - 0.07));
      if (s < bestScore) {
        bestScore = s;
        bestCorner = k;
      }
    }
    this.cornerP = Math.max(0, bestCorner);
    for (let k = 0; k < n; k++) {
      if (this.edgeTau[k] >= 0) {
        // the tear front sweeps the line from the edge (0.15) to the inside (0.95), a little ragged
        const f = this.edgeTau[k] / Math.max(1e-3, maxArc);
        this.edgeTau[k] = 0.15 + 0.8 * f + (R() - 0.5) * 0.08;
        this.threadList.push({ edge: k, skirtV: list[k], state: 0, breakLen: 0.01 + 0.06 * R() ** 2, dA: new THREE.Vector3(), dB: new THREE.Vector3() });
        if (R() < 0.5) this.threadList.push({ edge: k, skirtV: list[k], state: 0, breakLen: 0.015 + 0.05 * R(), dA: new THREE.Vector3(), dB: new THREE.Vector3() });
      }
      const v = list[k];
      const cx = P[this.vIdx[this.cornerP] * 3], cy = P[this.vIdx[this.cornerP] * 3 + 1], cz = P[this.vIdx[this.cornerP] * 3 + 2];
      const d = Math.hypot(P[v * 3] - cx, P[v * 3 + 1] - cy, P[v * 3 + 2] - cz);
      this.grabW[k] = Math.max(0, 1 - d / 0.06);
    }
    // free mesh (world space)
    const free = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    free.setAttribute('position', this.posAttr);
    free.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    for (const name of Object.keys(g.attributes)) {
      if (/^(position|normal|skin)/.test(name)) continue;
      const src = g.getAttribute(name) as THREE.BufferAttribute;
      const arr = new Float32Array(n * src.itemSize);
      for (let k = 0; k < n; k++) for (let c = 0; c < src.itemSize; c++) arr[k * src.itemSize + c] = src.getComponent(list[k], c);
      free.setAttribute(name, new THREE.BufferAttribute(arr, src.itemSize));
    }
    free.setIndex(flapT.map((v) => map[v]));
    this.free = new THREE.Mesh(free, o.freeMaterial);
    this.free.name = 'meilCornerTorn';
    this.free.visible = false;
    this.free.castShadow = true;
    this.free.receiveShadow = true;
    this.free.frustumCulled = false;
    // threads
    const lg = new THREE.BufferGeometry();
    this.lineAttr = new THREE.BufferAttribute(new Float32Array(this.threadList.length * 4 * 3), 3);
    this.lineAttr.setUsage(THREE.DynamicDrawUsage);
    lg.setAttribute('position', this.lineAttr);
    this.threads = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: o.threadColor ?? 0x8a7a64, transparent: true, opacity: 0.9 }));
    this.threads.name = 'meilThreads';
    this.threads.visible = false;
    this.threads.frustumCulled = false;
    void _q;
  }

  /** the tzitzit sockets of this corner (they follow the torn piece once it is free) */
  attachTzitzit(sockets: THREE.Object3D[]) {
    this.tzitzitSockets = sockets;
  }

  /** world position of the corner (the point Saul's hand reaches for) — valid intact or torn */
  cornerWorld(out: THREE.Vector3) {
    if (this.started) return out.fromArray(this.p, this.cornerP * 3);
    return skinnedWorld(this.flapSkinned, this.vIdx[this.cornerP], out);
  }

  /** the hand closes on the corner: grab vertices follow `socket` (e.g. saul.sockets.handGripR) from now on */
  grab(socket: THREE.Object3D) {
    this.start();
    this.hand = socket;
    socket.updateWorldMatrix(true, false);
    _m.copy(socket.matrixWorld).invert();
    for (let k = 0; k < this.grabW.length; k++) {
      if (this.grabW[k] <= 0) continue;
      _v.fromArray(this.p, k * 3).applyMatrix4(_m);
      // pull the offsets toward the fist (the cloth is bunched in the hand)
      _v.multiplyScalar(0.35);
      _v.toArray(this.grabOff, k * 3);
    }
    this.handOn = 0;
  }

  release() {
    this.hand = null;
  }

  /** switch from the skinned corner to the free piece at the current skinned pose */
  start() {
    if (this.started) return;
    this.started = true;
    const n = this.vIdx.length;
    for (let k = 0; k < n; k++) {
      skinnedWorld(this.flapSkinned, this.vIdx[k], _v);
      _v.toArray(this.p, k * 3);
      _v.toArray(this.prev, k * 3);
    }
    this.flapSkinned.visible = false;
    this.free.visible = true;
    this.threads.visible = true;
    this.writeMesh();
    // tzitzit move with the piece
    if (this.tzitzitSockets.length) {
      const scene = this.free.parent;
      if (scene) {
        scene.add(this.tzitzitAnchor);
        this.tzitzitAnchor.position.fromArray(this.p, this.cornerP * 3);
        this.tzitzitAnchor.updateMatrixWorld(true);
        for (const s of this.tzitzitSockets) this.tzitzitAnchor.attach(s);
      }
    }
  }

  /** back to intact (e.g. when a shot is replayed) */
  reset() {
    if (!this.started) return;
    this.started = false;
    this.progress = 0;
    this.hand = null;
    this.flapSkinned.visible = true;
    this.free.visible = false;
    this.threads.visible = false;
    for (const t of this.threadList) t.state = 0;
    // the tzitzit sockets go back to the leg bone they came from
    for (const s of this.tzitzitSockets) {
      const home = s.userData.tearHome as THREE.Object3D | undefined;
      if (home) home.attach(s);
    }
  }

  get isTorn() {
    return this.started;
  }

  update(dt: number) {
    if (!this.started) return;
    dt = Math.min(dt, 1 / 30);
    if (dt <= 0) return;
    const n = this.vIdx.length;
    const p = this.p, pr = this.prev;
    const damp = 0.985;
    const g = this.gravity * dt * dt;
    const wx = this.wind.x * 0.02 * dt, wz = this.wind.z * 0.02 * dt;
    for (let k = 0; k < n; k++) {
      const i = k * 3;
      const vx = (p[i] - pr[i]) * damp, vy = (p[i + 1] - pr[i + 1]) * damp, vz = (p[i + 2] - pr[i + 2]) * damp;
      pr[i] = p[i];
      pr[i + 1] = p[i + 1];
      pr[i + 2] = p[i + 2];
      p[i] += vx + wx;
      p[i + 1] += vy + g;
      p[i + 2] += vz + wz;
    }
    this.handOn = Math.min(1, this.handOn + dt * 8);
    if (this.hand) this.hand.updateWorldMatrix(true, false);
    const iters = 6;
    for (let it = 0; it < iters; it++) {
      // distance constraints
      const C = this.cons, L = this.rest;
      for (let c = 0; c < L.length; c++) {
        const a = C[c * 2] * 3, b = C[c * 2 + 1] * 3;
        const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        // wool: stretches a little, never compresses hard
        const target = L[c];
        const diff = d > target * 1.04 ? (d - target * 1.04) / d : d < target * 0.85 ? (d - target * 0.85) / d : 0;
        if (diff === 0) continue;
        const s = 0.5 * diff;
        p[a] += dx * s;
        p[a + 1] += dy * s;
        p[a + 2] += dz * s;
        p[b] -= dx * s;
        p[b + 1] -= dy * s;
        p[b + 2] -= dz * s;
      }
      // pins: the tear line (until the front passes) and the hand
      for (let k = 0; k < n; k++) {
        const i = k * 3;
        const tau = this.edgeTau[k];
        if (tau >= 0 && this.progress < tau) {
          skinnedWorld(this.skirtRef.mesh, this.vIdx[k], _v);
          p[i] = _v.x;
          p[i + 1] = _v.y;
          p[i + 2] = _v.z;
        }
        const gw = this.grabW[k] * this.handOn;
        if (this.hand && gw > 0) {
          _v.fromArray(this.grabOff, i).applyMatrix4(this.hand.matrixWorld);
          p[i] += (_v.x - p[i]) * gw;
          p[i + 1] += (_v.y - p[i + 1]) * gw;
          p[i + 2] += (_v.z - p[i + 2]) * gw;
        }
      }
    }
    this.writeMesh();
    // threads
    const la = this.lineAttr.array as Float32Array;
    let o = 0;
    for (const t of this.threadList) {
      const tau = this.edgeTau[t.edge];
      _a.fromArray(p, t.edge * 3);
      if (t.state === 0 && this.progress >= tau) t.state = 1;
      if (t.state === 1) {
        skinnedWorld(this.skirtRef.mesh, t.skirtV, _b);
        const d = _a.distanceTo(_b);
        if (d > t.breakLen) {
          t.state = 2;
          const dir = _b.clone().sub(_a).normalize();
          t.dA.copy(dir).multiplyScalar(0.006 + 0.012 * Math.random()).add(new THREE.Vector3(0, -0.004, 0));
          t.dB.copy(dir).multiplyScalar(-(0.006 + 0.012 * Math.random())).add(new THREE.Vector3(0, -0.006, 0));
          this.onSnap?.(_a.clone().lerp(_b, 0.5));
        } else {
          _a.toArray(la, o);
          _b.toArray(la, o + 3);
          _a.toArray(la, o + 6);
          _a.toArray(la, o + 9);
          o += 12;
          continue;
        }
      }
      if (t.state === 2) {
        skinnedWorld(this.skirtRef.mesh, t.skirtV, _b);
        _a.toArray(la, o);
        _v.copy(_a).add(t.dA).toArray(la, o + 3);
        _b.toArray(la, o + 6);
        _v.copy(_b).add(t.dB).toArray(la, o + 9);
      } else {
        for (let c = 0; c < 12; c++) la[o + c] = 0;
        _a.toArray(la, o);
        _a.toArray(la, o + 3);
        _a.toArray(la, o + 6);
        _a.toArray(la, o + 9);
      }
      o += 12;
    }
    this.lineAttr.needsUpdate = true;
    if (this.tzitzitSockets.length) {
      this.tzitzitAnchor.position.fromArray(p, this.cornerP * 3);
      this.tzitzitAnchor.updateMatrixWorld(true);
    }
  }

  private writeMesh() {
    (this.posAttr.array as Float32Array).set(this.p);
    this.posAttr.needsUpdate = true;
    const geo = this.free.geometry;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }

  dispose() {
    this.free.geometry.dispose();
    this.threads.geometry.dispose();
    (this.threads.material as THREE.Material).dispose();
    this.flapSkinned.geometry.dispose();
    this.free.removeFromParent();
    this.threads.removeFromParent();
    this.tzitzitAnchor.removeFromParent();
  }
}
