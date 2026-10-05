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
  /**
   * finishing pass: the wrap's inner layer under the corner — a copy of the corner `under.inset` m deeper, drawn with
   * `under.material` (the skirt's material with a smaller leg-push pad), always shown: when Saul pulls the corner away
   * and tears it off, dark wool shows beneath, not the light tunic (a white wedge in the low two-shot G5b)
   */
  under?: { material: THREE.Material; inset: number };
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

/**
 * The selected corner as ONE piece of cloth: union-find over the selection's triangles plus welds of vertices that
 * share a rest position (< 0.5 mm: the loft duplicates them along seams and the slit); the largest component stays,
 * any other island's triangles go back to the skirt (`mainT`). Returns the piece and its weld pairs (vertex indices).
 */
function connectedPiece(flapT0: number[], mainT: number[], P: ArrayLike<number>): { flapT: number[]; welds: number[] } {
  const verts = [...new Set(flapT0)];
  const parent = new Map<number, number>();
  for (const v of verts) parent.set(v, v);
  const find = (v: number): number => {
    let r = v;
    while (parent.get(r)! !== r) r = parent.get(r)!;
    let x = v;
    while (parent.get(x)! !== r) {
      const nx = parent.get(x)!;
      parent.set(x, r);
      x = nx;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (let t = 0; t < flapT0.length; t += 3) {
    union(flapT0[t], flapT0[t + 1]);
    union(flapT0[t + 1], flapT0[t + 2]);
  }
  const q = (x: number) => Math.round(x / 0.0005);
  const byKey = new Map<string, number>();
  const pairs: number[] = [];
  for (const v of verts) {
    const k = `${q(P[v * 3])},${q(P[v * 3 + 1])},${q(P[v * 3 + 2])}`;
    const o = byKey.get(k);
    if (o === undefined) byKey.set(k, v);
    else {
      pairs.push(o, v);
      union(o, v);
    }
  }
  const count = new Map<number, number>();
  for (let t = 0; t < flapT0.length; t += 3) {
    const r = find(flapT0[t]);
    count.set(r, (count.get(r) ?? 0) + 1);
  }
  let best = -1, bestN = -1;
  for (const [r, c] of count) if (c > bestN) {
    bestN = c;
    best = r;
  }
  const flapT: number[] = [];
  for (let t = 0; t < flapT0.length; t += 3) (find(flapT0[t]) === best ? flapT : mainT).push(flapT0[t], flapT0[t + 1], flapT0[t + 2]);
  const welds: number[] = [];
  for (let i = 0; i < pairs.length; i += 2) if (find(pairs[i]) === best) welds.push(pairs[i], pairs[i + 1]);
  return { flapT, welds };
}

interface Thread {
  edge: number; // particle index of the flap edge vertex
  skirtV: number; // vertex index in the skirt mesh
  state: 0 | 1 | 2; // 0 intact, 1 stretched, 2 snapped
  breakLen: number;
  dA: THREE.Vector3;
  dB: THREE.Vector3;
  /** small fixed offsets of the two ends (several threads per edge vertex spread along the weave) */
  oA: THREE.Vector3;
  oB: THREE.Vector3;
  /** ribbon half-width (m) */
  w: number;
  /** edge-to-skirt distance when the tear front reached it (the thread is drawn from there; -1 = not yet) */
  d0: number;
}
const _s = new THREE.Vector3();
const _d = new THREE.Vector3();
/** tear progress over which a tear-line vertex lets go of the skirt (see update) */
const RELEASE = 0.12;
/**
 * finishing pass: the tear front sweeps the line from EDGE0 to EDGE0 + EDGE_SPAN (± EDGE_JITTER), so every vertex is
 * free by progress 1 (threshold + RELEASE ≤ 1). Before, thresholds reached ~1.11 and at progress 1 (documented as
 * "torn through") the innermost vertices stayed pinned: the piece was stretched from Saul's fist to Samuel's hem.
 */
const EDGE0 = 0.1, EDGE_SPAN = 0.74, EDGE_JITTER = 0.04;
/** constraint iterations per step (the long-range attachments carry the hanging piece, see update) */
const ITERS = 8;
/** short frayed fibres standing off the torn edge of the free piece (per tear-line particle, before snapping) */
const FRAY_PER_EDGE = 2;
/** radius (m) of cloth round the grab point that the fist gathers, and how tightly (offset scale in the hand) */
const GRAB_R = 0.09, BUNCH = 0.45;

export class MeilTear {
  /** the free piece (world space, add to the scene; hidden until the tear starts) */
  readonly free: THREE.Mesh;
  /** threads / frayed fibres (world space): camera-facing ribbons ~1-1.5 mm wide (1 px lines vanished at 1080p) */
  readonly threads: THREE.Mesh;
  /** where the camera is (world): the thread ribbons face it — FilmActor.update sets it */
  readonly viewer = new THREE.Vector3(0, 1.6, 10);
  /** skinned flap (part of the robe while intact) */
  readonly flapSkinned: THREE.SkinnedMesh;
  /** the wrap's inner layer under the corner (TearOptions.under), or null */
  readonly under: THREE.SkinnedMesh | null = null;
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
  /** particle the tzitzit hang from once torn (the one nearest the corner's tassel socket) */
  private tzitzitP = -1;
  private posAttr: THREE.BufferAttribute;
  private lineAttr: THREE.BufferAttribute;
  private readonly segs: Float32Array;
  /** rest geodesic distance (along the cloth) of every particle from the grabbed corner: long-range attachments */
  private readonly geo: Float32Array;
  /** per-step pin targets of the tear line (CPU-skinned once per step, not once per iteration) and their weights */
  private readonly pinT: Float32Array;
  private readonly pinK: Float32Array;
  /** frayed fibres standing off the torn edge: particle, its in-cloth neighbour (the fibre points away from it) */
  private readonly fray: { k: number; nb: number; len: number; tilt: THREE.Vector3; w: number }[] = [];
  /** ribbon half-width of every segment (threads: 2 per thread; then the frayed fibres) */
  private readonly segW: Float32Array;
  /** welded duplicate pairs (diagnostics) */
  readonly weldCount: number;

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
    // the tear line ALONG THE WEAVE (visual-bible 3.3; finishing pass): from the slit edge a run along the weft
    // (level, `height` above the hem) out to `width`, then down along the warp to the hem — an L whose runs jog by a
    // thread group (±1.2 cm) here and there, with a few mm of ragged fray. (The old staircase of four big steps read as a
    // spiky dark leaf in the low two-shot G5b.)
    const jog = (x: number, k: number) => 0.012 * Math.round((nz(x * 9 + k) - 0.5) * 2.6) + (nz(x * 45 + k + 3) - 0.5) * 0.006;
    void R;
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
      const y = P[i * 3 + 1] - hemY;
      return y < height + jog(Math.max(0, arc), 0) && arc < width + jog(y, 17);
    };
    const flapT0: number[] = [], mainT: number[] = [];
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
      const n = (inside(a) ? 1 : 0) + (inside(b) ? 1 : 0) + (inside(c) ? 1 : 0);
      (n >= 2 ? flapT0 : mainT).push(a, b, c);
    }
    // finishing pass: ONE connected piece. Vertices that share a rest position (the loft duplicates them along seams /
    // the slit) are welded; any other island of the selection (a sliver of the neighbouring panel across the side
    // slit) goes back to the skirt — a detached 19-particle strip free-fell to y = -38 m once it was released.
    const { flapT, welds } = connectedPiece(flapT0, mainT, P);
    this.weldCount = welds.length / 2;
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
    if (o.under) {
      // the inner layer of the wrap under the corner (bind space ≈ rest space: set back radially)
      const ug = g.clone();
      ug.setIndex(flapT);
      const pa = (ug.getAttribute('position') as THREE.BufferAttribute).clone();
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), z = pa.getZ(i);
        const l = Math.hypot(x, z) || 1;
        pa.setXYZ(i, x - (x / l) * o.under.inset, pa.getY(i), z - (z / l) * o.under.inset);
      }
      ug.setAttribute('position', pa);
      const um = new THREE.SkinnedMesh(ug, o.under.material);
      um.name = 'meilCornerUnder';
      um.bind(skirtMesh.skeleton, skirtMesh.bindMatrix);
      um.castShadow = false;
      um.receiveShadow = skirtMesh.receiveShadow;
      um.frustumCulled = false;
      skirtMesh.parent!.add(um);
      this.under = um;
    }
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
    // welded duplicates: zero-length constraints (they move as one point)
    for (let i = 0; i < welds.length; i += 2) if (map[welds[i]] >= 0 && map[welds[i + 1]] >= 0) addC(welds[i], welds[i + 1]);
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
        // the front runs along the L: out along the weft from the slit edge, then down the warp to the hem
        const along = arc + Math.max(0, height - (P[v * 3 + 1] - hemY));
        this.edgeTau[k] = along;
        maxArc = Math.max(maxArc, along);
      }
      // the grab point: on the slit edge near the top of the piece (the highest point Saul's hand can reach)
      const s = Math.abs(arc - 0.04) + Math.abs(P[v * 3 + 1] - hemY - (height - 0.035));
      if (s < bestScore) {
        bestScore = s;
        bestCorner = k;
      }
    }
    this.cornerP = Math.max(0, bestCorner);
    // neighbours along the cloth (constraint graph; welds included) — for the geodesics and the frayed fibres
    const nbr: number[][] = Array.from({ length: n }, () => []);
    const nbrL: number[][] = Array.from({ length: n }, () => []);
    for (let c = 0; c < this.rest.length; c++) {
      const a = this.cons[c * 2], b = this.cons[c * 2 + 1];
      nbr[a].push(b);
      nbrL[a].push(this.rest[c]);
      nbr[b].push(a);
      nbrL[b].push(this.rest[c]);
    }
    for (let k = 0; k < n; k++) {
      if (this.edgeTau[k] >= 0) {
        // the tear front sweeps the line from the slit edge inward, a little ragged; every vertex is free by progress 1
        const f = this.edgeTau[k] / Math.max(1e-3, maxArc);
        this.edgeTau[k] = EDGE0 + EDGE_SPAN * f + (R() - 0.5) * 2 * EDGE_JITTER;
        // 2-4 threads per edge vertex, spread a few mm along the weave; most snap early (1-4 cm), a few hold long
        const nT = 2 + Math.floor(R() * 3);
        for (let q = 0; q < nT; q++) {
          const off = () => new THREE.Vector3((R() - 0.5) * 0.012, (R() - 0.5) * 0.012, (R() - 0.5) * 0.012);
          this.threadList.push({
            // wool threads stretch a long way before they give (the slow-motion shot needs them visible): 2-9 cm,
            // a few up to 15 cm. Finishing pass: 2-3.4 mm yarns (homespun ≈1.5 mm + its fuzz) — at 1.2-2.4 mm they
            // were under a pixel at 640×360 and never read in the insert
            edge: k, skirtV: list[k], state: 0, breakLen: 0.02 + 0.07 * R() ** 1.5 + (R() < 0.15 ? 0.06 * R() : 0),
            dA: new THREE.Vector3(), dB: new THREE.Vector3(), oA: off(), oB: off(), w: 0.001 + 0.0007 * R(), d0: -1,
          });
        }
        // the frayed edge of the free piece: short fibres standing off the torn line (they appear as the front
        // passes and stay — the stepped edge reads fuzzy, not cut)
        let inner = -1, best = -Infinity;
        for (const j of nbr[k]) {
          // the in-cloth neighbour farthest from the tear line (the fibre points away from it, out of the piece)
          const s2 = this.edgeTau[j] >= 0 ? -1 : Math.hypot(P[list[j] * 3] - P[list[k] * 3], P[list[j] * 3 + 1] - P[list[k] * 3 + 1], P[list[j] * 3 + 2] - P[list[k] * 3 + 2]);
          if (s2 > best) {
            best = s2;
            inner = j;
          }
        }
        if (inner >= 0) {
          for (let q = 0; q < FRAY_PER_EDGE; q++) {
            this.fray.push({ k, nb: inner, len: 0.006 + 0.012 * R() ** 1.4, tilt: new THREE.Vector3((R() - 0.5) * 1.1, (R() - 0.5) * 0.9 - 0.7, (R() - 0.5) * 1.1), w: 0.0006 + 0.0005 * R() });
          }
        }
      }
      const v = list[k];
      const cx = P[this.vIdx[this.cornerP] * 3], cy = P[this.vIdx[this.cornerP] * 3 + 1], cz = P[this.vIdx[this.cornerP] * 3 + 2];
      const d = Math.hypot(P[v * 3] - cx, P[v * 3 + 1] - cy, P[v * 3 + 2] - cz);
      // finishing pass: a bigger wad in the fist (9 cm of cloth gathered round the grab point; at 6 cm the piece
      // seemed to hang a few cm beside the knuckles in the close two-shot)
      this.grabW[k] = Math.max(0, 1 - d / GRAB_R);
    }
    // long-range attachments (Kim et al. 2012): the rest geodesic from the grabbed corner bounds how far any point may
    // hang from the fist — no stretching into a streamer whatever the iteration count (Dijkstra, ~260 particles)
    this.geo = new Float32Array(n).fill(Infinity);
    {
      const done = new Uint8Array(n);
      this.geo[this.cornerP] = 0;
      for (let it = 0; it < n; it++) {
        let u = -1, bu = Infinity;
        for (let k = 0; k < n; k++) if (!done[k] && this.geo[k] < bu) {
          bu = this.geo[k];
          u = k;
        }
        if (u < 0) break;
        done[u] = 1;
        const nb = nbr[u], nl = nbrL[u];
        for (let j = 0; j < nb.length; j++) {
          const d = bu + nl[j];
          if (d < this.geo[nb[j]]) this.geo[nb[j]] = d;
        }
      }
      // (an unreachable particle cannot exist after connectedPiece; keep a finite bound anyway)
      for (let k = 0; k < n; k++) if (!Number.isFinite(this.geo[k])) this.geo[k] = 0.6;
    }
    this.pinT = new Float32Array(n * 3);
    this.pinK = new Float32Array(n);
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
    // threads: 2 segments per thread (stretched: edge -> skirt; snapped: two frayed ends), then one per frayed fibre of
    // the free piece's edge; each a camera-facing quad
    const nT = this.threadList.length;
    const nSeg = nT * 2 + this.fray.length;
    this.segs = new Float32Array(nSeg * 2 * 3);
    this.segW = new Float32Array(nSeg);
    this.threadList.forEach((t, i) => {
      this.segW[i * 2] = t.w;
      this.segW[i * 2 + 1] = t.w * 0.8;
    });
    this.fray.forEach((f, i) => (this.segW[nT * 2 + i] = f.w));
    const lg = new THREE.BufferGeometry();
    this.lineAttr = new THREE.BufferAttribute(new Float32Array(nSeg * 4 * 3), 3);
    this.lineAttr.setUsage(THREE.DynamicDrawUsage);
    lg.setAttribute('position', this.lineAttr);
    const ti: number[] = [];
    for (let q = 0; q < nSeg; q++) {
      const b = q * 4;
      ti.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    lg.setIndex(ti);
    // undyed wool fibres, a shade lighter than the cloth (they catch the backlight; finishing pass: x1.7 / 0.92 made
    // them glowing white sticks against the dark wool)
    const tc = new THREE.Color(o.threadColor ?? 0x8a7a64).multiplyScalar(1.25);
    this.threads = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: tc, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
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
    const wasTorn = this.started;
    this.start();
    this.hand = socket;
    socket.updateWorldMatrix(true, false);
    if (wasTorn) {
      // re-grabbed after a cut (G6 / G7 open with the piece in the fist, the actors re-placed): carry the torn piece
      // rigidly to the hand first — bunching it from where it was left spread up to 0.4 m of cloth round the fist
      _a.setFromMatrixPosition(socket.matrixWorld).sub(_b.fromArray(this.p, this.cornerP * 3));
      for (let k = 0; k < this.vIdx.length; k++) {
        const i = k * 3;
        this.p[i] += _a.x;
        this.p[i + 1] += _a.y;
        this.p[i + 2] += _a.z;
        this.prev[i] = this.p[i];
        this.prev[i + 1] = this.p[i + 1];
        this.prev[i + 2] = this.p[i + 2];
      }
    }
    _m.copy(socket.matrixWorld).invert();
    // the wad sits between the grip centre and the palm (a hand socket 'handGripX' sized for a spear shaft lies just in
    // front of the knuckles once the fingers close into a fist: the piece seemed to hang beside the hand)
    const palm = socket.parent?.getObjectByName(socket.name.replace('handGrip', 'palm'));
    if (palm && palm !== socket) _d.copy(palm.getWorldPosition(_s)).applyMatrix4(_m).multiplyScalar(0.55);
    else _d.set(0, 0, 0);
    // (CUT v6.1, cut7) the wool goes INTO the fist: every grabbed point's offset is taken from the CORNER (not from the
    // hand) and bunched round the grip — a hand that closed a few centimetres short of the corner used to hold the
    // cloth at that distance, a fist closed in the air beside it (Version 11, G5b); now the corner and the wool round it
    // are drawn into the fist (handOn ramps it over ~0.12 s: the tent of cloth pulled into the hand)
    _a.fromArray(this.p, this.cornerP * 3).applyMatrix4(_m);
    for (let k = 0; k < this.grabW.length; k++) {
      if (this.grabW[k] <= 0) continue;
      _v.fromArray(this.p, k * 3).applyMatrix4(_m).sub(_a);
      // pull the offsets toward the fist (the cloth is bunched in the hand, a wad round the fingers)
      _v.multiplyScalar(BUNCH).add(_d);
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
    // tzitzit move with the piece — from the particle at their own corner (the tassel hangs from the torn piece's
    // hem corner, below the fist), not from the grabbed point
    if (this.tzitzitSockets.length) {
      const scene = this.free.parent;
      if (scene) {
        this.tzitzitSockets[0].getWorldPosition(_a);
        let best = Infinity;
        for (let k = 0; k < n; k++) {
          const d = _b.fromArray(this.p, k * 3).distanceToSquared(_a);
          if (d < best) {
            best = d;
            this.tzitzitP = k;
          }
        }
        scene.add(this.tzitzitAnchor);
        this.tzitzitAnchor.position.fromArray(this.p, this.tzitzitP * 3);
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
    for (const t of this.threadList) {
      t.state = 0;
      t.d0 = -1;
    }
    // the tzitzit sockets go back to the leg bone they came from
    for (const s of this.tzitzitSockets) {
      const home = s.userData.tearHome as THREE.Object3D | undefined;
      if (home) home.attach(s);
    }
    this.tzitzitAnchor.removeFromParent();
    this.tzitzitP = -1;
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
    // the tear line's pins this step: CPU-skinned once (not once per iteration); weight 1 until the front reaches the
    // vertex, then giving over RELEASE; everything is free from progress 1 on
    const PT = this.pinT, PK = this.pinK;
    for (let k = 0; k < n; k++) {
      const tau = this.edgeTau[k];
      let kp = 0;
      if (tau >= 0 && this.progress < 1 && this.progress < tau + RELEASE) kp = this.progress < tau ? 1 : 1 - (this.progress - tau) / RELEASE;
      PK[k] = kp;
      if (kp > 0) {
        skinnedWorld(this.skirtRef.mesh, this.vIdx[k], _v);
        _v.toArray(PT, k * 3);
      }
    }
    const lra = this.hand && this.handOn > 0.25;
    const ci = this.cornerP * 3;
    for (let it = 0; it < ITERS; it++) {
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
        const kp = PK[k];
        if (kp > 0) {
          // the weave gives gradually as the tear front passes (a hard release jumped the edge across the gap in
          // one step and every thread snapped on that frame, unseen)
          p[i] += (PT[i] - p[i]) * kp;
          p[i + 1] += (PT[i + 1] - p[i + 1]) * kp;
          p[i + 2] += (PT[i + 2] - p[i + 2]) * kp;
        }
        const gw = this.grabW[k] * this.handOn;
        if (this.hand && gw > 0) {
          _v.fromArray(this.grabOff, i).applyMatrix4(this.hand.matrixWorld);
          p[i] += (_v.x - p[i]) * gw;
          p[i + 1] += (_v.y - p[i + 1]) * gw;
          p[i + 2] += (_v.z - p[i + 2]) * gw;
        }
      }
      // long-range attachments: no free point farther from the fist than its rest distance along the cloth (+3 %) —
      // the piece hangs wool-sized from the hand at any frame rate (it stretched into a 1.2-1.6 m streamer at 6
      // iterations; the substep workaround in FilmActor is no longer needed)
      if (lra) {
        const ax = p[ci], ay = p[ci + 1], az = p[ci + 2];
        for (let k = 0; k < n; k++) {
          if (PK[k] > 0.02 || k === this.cornerP) continue;
          const i = k * 3;
          const dx = p[i] - ax, dy = p[i + 1] - ay, dz = p[i + 2] - az;
          const d = Math.hypot(dx, dy, dz);
          const lim = this.geo[k] * 1.03 + 0.002;
          if (d > lim) {
            const s = lim / d;
            p[i] = ax + dx * s;
            p[i + 1] = ay + dy * s;
            p[i + 2] = az + dz * s;
          }
        }
      }
    }
    this.writeMesh();
    // threads (segment endpoints into this.segs, then ribbons)
    const la = this.segs;
    let o = 0;
    for (const t of this.threadList) {
      const tau = this.edgeTau[t.edge];
      _a.fromArray(p, t.edge * 3);
      if (t.state === 0 && this.progress >= tau) t.state = 1;
      _a.add(t.oA);
      if (t.state === 1) {
        skinnedWorld(this.skirtRef.mesh, t.skirtV, _b).add(t.oB);
        const d = _a.distanceTo(_b);
        // the thread stretches from the gap it had when the tear front reached it (the flap is already pulled
        // away by the fist, so an absolute length snapped every thread on the frame it was released)
        if (t.d0 < 0) t.d0 = Math.min(d, 0.02);
        if (d > t.d0 + t.breakLen) {
          t.state = 2;
          const dir = _b.clone().sub(_a).normalize();
          // frayed ends 0.8-2.4 cm, falling limp (finishing pass: along the snap direction they stuck out of the torn
          // piece sideways like white sticks)
          t.dA.copy(dir).multiplyScalar(0.35).add(_v.set((Math.random() - 0.5) * 0.4, -0.75, (Math.random() - 0.5) * 0.4)).normalize().multiplyScalar(0.008 + 0.016 * Math.random());
          t.dB.copy(dir).multiplyScalar(-0.35).add(_v.set((Math.random() - 0.5) * 0.4, -0.75, (Math.random() - 0.5) * 0.4)).normalize().multiplyScalar(0.008 + 0.016 * Math.random());
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
        skinnedWorld(this.skirtRef.mesh, t.skirtV, _b).add(t.oB);
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
    // the frayed edge of the free piece: once the front has passed a tear-line particle, short fibres stand off it,
    // pointing out of the piece (away from its in-cloth neighbour), drooping a little
    for (const f of this.fray) {
      const i = f.k * 3;
      _a.fromArray(p, i);
      if (this.progress < this.edgeTau[f.k]) {
        _a.toArray(la, o);
        _a.toArray(la, o + 3);
        o += 6;
        continue;
      }
      _d.fromArray(p, f.nb * 3);
      _b.copy(_a).sub(_d);
      const l = _b.length();
      if (l > 1e-6) _b.multiplyScalar(1 / l);
      _b.add(f.tilt).normalize().multiplyScalar(f.len).add(_a);
      _a.toArray(la, o);
      _b.toArray(la, o + 3);
      o += 6;
    }
    this.writeThreads();
    if (this.tzitzitSockets.length && this.tzitzitP >= 0) {
      this.tzitzitAnchor.position.fromArray(p, this.tzitzitP * 3);
      this.tzitzitAnchor.updateMatrixWorld(true);
    }
  }

  /** segments -> camera-facing quads */
  private writeThreads() {
    const S = this.segs, out = this.lineAttr.array as Float32Array;
    const n = this.segW.length;
    for (let q = 0; q < n; q++) {
      const i = q * 6, o = q * 12;
      _a.fromArray(S, i);
      _b.fromArray(S, i + 3);
      const w = this.segW[q];
      _d.copy(_b).sub(_a);
      _s.copy(_a).add(_b).multiplyScalar(0.5).sub(this.viewer).cross(_d);
      const l = _s.length();
      if (l < 1e-9) _s.set(0, 0, 0);
      else _s.multiplyScalar(w / l);
      out[o] = _a.x - _s.x; out[o + 1] = _a.y - _s.y; out[o + 2] = _a.z - _s.z;
      out[o + 3] = _a.x + _s.x; out[o + 4] = _a.y + _s.y; out[o + 5] = _a.z + _s.z;
      out[o + 6] = _b.x - _s.x; out[o + 7] = _b.y - _s.y; out[o + 8] = _b.z - _s.z;
      out[o + 9] = _b.x + _s.x; out[o + 10] = _b.y + _s.y; out[o + 11] = _b.z + _s.z;
    }
    this.lineAttr.needsUpdate = true;
    this.threads.geometry.computeBoundingSphere();
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
    this.under?.geometry.dispose();
    this.under?.removeFromParent();
    this.free.removeFromParent();
    this.threads.removeFromParent();
    this.tzitzitAnchor.removeFromParent();
  }
}
