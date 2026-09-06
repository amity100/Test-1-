import * as THREE from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Terrain } from '../world/Terrain';
import type { Input } from '../core/Input';
import type { BuildMode } from './BuildMode';
import type { VoxelMaterials } from '../render/VoxelMaterial';
import { PLOT_Y, PLOT_HALF, type Plot } from '../world/Layout';
import { MODULE, STOREY, MODULES_PER_SIDE, MAX_LEVEL, moduleOrigin, pieceCells, pieceKey, presetToOpen, type PiecePlacement, type PieceRecord } from './Pieces';
import { NavSystem } from '../ai/NavSystem';
import { makeShape, withShape } from '../world/Voxel';
import { Emitter } from '../core/Events';
import { clamp, damp } from '../core/MathUtil';
import type { Cell } from '../world/Reachability';

/**
 * The command table: a fixed-angle plan view of the plot where fortifications are painted with a
 * finger (or the mouse). Walls follow a dragged line, towers and stairs go where you tap, bunkers
 * and mazes fill a dragged rectangle, a tap on a wall picks its openings. One storey is shown at a
 * time (everything above is cut away) and the attackers' route to the flag is drawn live.
 */
export type Brush = 'wall' | 'tower' | 'bunker' | 'openings' | 'stairs' | 'cover' | 'maze' | 'flag' | 'erase' | 'hand';
export const BRUSHES: Brush[] = ['wall', 'tower', 'bunker', 'stairs', 'openings', 'cover', 'maze', 'flag', 'erase'];
/** Brushes where a one-finger drag paints; the others pan with one finger. */
const DRAG_BRUSHES: Brush[] = ['wall', 'bunker', 'maze', 'erase'];
export const TABLE_LEVELS = 6;

export interface TableEvents extends Record<string, unknown> {
  change: Record<string, never>;
  path: { length: number | null };
  picker: { key: string; type: 'wall' | 'floor'; open: boolean[] } | null;
}

interface Node {
  i: number;
  j: number;
}

interface Gesture {
  sx: number;
  sy: number;
  downX: number;
  downY: number;
  downAt: number;
  moved: number;
  blocked: boolean;
  longFired: boolean;
  /** Dragged wall nodes / rectangle corners collected so far. */
  nodes: Node[];
  rectStart: Node | null;
  rectEnd: Node | null;
  lastEraseKey: string;
}

const PITCH = 1.02;
const LONG_PRESS_MS = 480;
const TAP_PX = 12;
const RING: [number, number][] = [[1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [1, 2]];
const tmpV = new THREE.Vector3();

export class CommandTable {
  readonly events = new Emitter<TableEvents>();
  brush: Brush = 'wall';
  level = 0;
  yawIndex = 0;
  zoom = 1;
  readonly pan: THREE.Vector3;
  private yawAnim = 0;
  private active = false;
  private group = new THREE.Group();
  private grid: THREE.GridHelper;
  private hover: THREE.Mesh;
  private edgeHover: THREE.Mesh;
  private ghost: THREE.InstancedMesh;
  private pathMesh: THREE.Mesh;
  private dots: THREE.Mesh[] = [];
  private pathPoints: THREE.Vector3[] = [];
  private pathLength = 0;
  private dotPhase = 0;
  private clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  private gesture: Gesture | null = null;
  private rightDrag: { x: number; y: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private nav: NavSystem | null = null;
  private pathDirty = true;
  /** Wall-clock time of the last edit; the path is recomputed 450 ms after it. */
  private pathStamp = 0;
  private offChange: (() => void) | null = null;
  /** Last operation performed (debug/test aid). */
  debugLast = '';

  constructor(
    private build: BuildMode,
    private world: VoxelWorld,
    private terrain: Terrain,
    private plot: Plot,
    private plots: Plot[],
    private input: Input,
    private camera: THREE.PerspectiveCamera,
    private scene: THREE.Scene,
    private materials: VoxelMaterials,
    private renderer: THREE.WebGLRenderer,
  ) {
    this.pan = new THREE.Vector3(plot.cx + 0.5, PLOT_Y, plot.cz + 0.5);
    const size = MODULE * MODULES_PER_SIDE;
    this.grid = new THREE.GridHelper(size, MODULES_PER_SIDE, 0x00e5ff, 0x00e5ff);
    const gm = this.grid.material as THREE.LineBasicMaterial;
    gm.transparent = true;
    gm.opacity = 0.35;
    gm.depthWrite = false;
    this.hover = new THREE.Mesh(new THREE.PlaneGeometry(MODULE - 0.2, MODULE - 0.2), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.visible = false;
    this.edgeHover = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.45, depthWrite: false }));
    this.edgeHover.visible = false;
    this.ghost = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.38, depthWrite: false }), 4000);
    this.ghost.count = 0;
    this.ghost.visible = false;
    this.ghost.frustumCulled = false;
    this.pathMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xff3b4a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    this.pathMesh.frustumCulled = false;
    this.pathMesh.visible = false;
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd6da }));
      d.visible = false;
      this.dots.push(d);
      this.group.add(d);
    }
    this.group.add(this.grid, this.hover, this.edgeHover, this.ghost, this.pathMesh);
    this.group.visible = false;
    scene.add(this.group);
  }

  get visuals(): THREE.Group {
    return this.group;
  }

  // ---------------------------------------------------------------- lifecycle
  enter(): void {
    this.active = true;
    this.build.external = true;
    this.build.state.editing = null;
    this.group.visible = true;
    this.yawAnim = this.yawIndex * (Math.PI / 2);
    this.setCutaway(true);
    this.pathDirty = true;
    this.pathStamp = 0;
    this.offChange?.();
    this.offChange = this.build.events.on('change', () => {
      this.pathDirty = true;
      this.pathStamp = performance.now();
    });
    // Snap the camera straight to the framed view.
    this.updateCamera(1);
    this.updateCamera(1);
  }

  exit(): void {
    this.active = false;
    this.build.external = false;
    this.group.visible = false;
    this.setCutaway(false);
    this.gesture = null;
    this.offChange?.();
    this.offChange = null;
    this.events.emit('picker', null);
  }

  dispose(): void {
    this.exit();
    this.scene.remove(this.group);
  }

  /** Clips fortress blocks above the current storey so the plan is readable; off for screenshots. */
  setCutaway(on: boolean): void {
    const planes = on ? [this.clipPlane] : [];
    for (const m of [this.materials.opaque, this.materials.transparent]) {
      m.clippingPlanes = planes;
      m.clipShadows = on;
      m.needsUpdate = true;
    }
    this.renderer.localClippingEnabled = on || this.renderer.localClippingEnabled;
  }

  get storeyY(): number {
    return PLOT_Y + this.level * STOREY;
  }

  setLevel(k: number): void {
    const n = clamp(Math.round(k), 0, Math.min(MAX_LEVEL, TABLE_LEVELS - 1));
    if (n === this.level) return;
    this.level = n;
    this.gesture = null;
    this.events.emit('change', {});
  }

  rotate(dir = 1): void {
    this.yawIndex = (this.yawIndex + dir + 4) % 4;
    this.events.emit('change', {});
  }

  setBrush(b: Brush): void {
    if (b === this.brush) return;
    this.brush = b;
    this.gesture = null;
    this.events.emit('picker', null);
    this.events.emit('change', {});
  }

  /** Recentres and resets zoom so the whole plot is on screen. */
  frame(): void {
    this.pan.set(this.plot.cx + 0.5, this.storeyY, this.plot.cz + 0.5);
    this.zoom = 1;
  }

  // ---------------------------------------------------------------- camera
  private get yaw(): number {
    return this.yawAnim;
  }

  private baseDistance(): number {
    const vf = THREE.MathUtils.degToRad(this.camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    const f = Math.min(vf, hf);
    const extent = MODULE * MODULES_PER_SIDE + 10;
    return (extent * 0.52) / Math.tan(f / 2) * 1.12;
  }

  private updateCamera(dt: number): void {
    const target = this.yawIndex * (Math.PI / 2);
    let d = target - this.yawAnim;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yawAnim += d * Math.min(1, dt * 10);
    this.pan.x = clamp(this.pan.x, this.plot.minX - 12, this.plot.maxX + 13);
    this.pan.z = clamp(this.pan.z, this.plot.minZ - 12, this.plot.maxZ + 13);
    this.pan.y = damp(this.pan.y, this.storeyY, 10, dt);
    const dist = this.baseDistance() * this.zoom;
    const cp = Math.cos(PITCH);
    tmpV.set(Math.sin(this.yaw) * cp, Math.sin(PITCH), Math.cos(this.yaw) * cp).multiplyScalar(dist).add(this.pan);
    this.camera.position.x = damp(this.camera.position.x, tmpV.x, 14, dt);
    this.camera.position.y = damp(this.camera.position.y, tmpV.y, 14, dt);
    this.camera.position.z = damp(this.camera.position.z, tmpV.z, 14, dt);
    this.camera.lookAt(this.pan);
    this.camera.updateMatrixWorld();
    // Cut everything above the storey's ceiling (roof slabs included) so the plan stays readable.
    this.clipPlane.constant = this.storeyY + STOREY - 0.05;
    this.grid.position.set(this.plot.cx + 0.5, this.storeyY + 0.04, this.plot.cz + 0.5);
  }

  /** Screen-space delta → world pan (content follows the finger). */
  private panBy(dx: number, dy: number): void {
    const k = this.baseDistance() * this.zoom * 0.0016;
    const right = tmpV.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.pan.addScaledVector(right, -dx * k);
    const fwd = tmpV.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.pan.addScaledVector(fwd, dy * k);
  }

  // ---------------------------------------------------------------- picking
  private setRay(sx: number, sy: number): void {
    const ndc = new THREE.Vector2((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  /** Point on the current storey's floor plane under a screen position. */
  planePoint(sx: number, sy: number): THREE.Vector3 | null {
    this.setRay(sx, sy);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.storeyY);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, p) ? p : null;
  }

  /** First fortress block under a screen position, ignoring everything above the cut-away. */
  hitBlock(sx: number, sy: number): { cell: Cell; point: THREE.Vector3; normal: THREE.Vector3 } | null {
    this.setRay(sx, sy);
    const ray = this.raycaster.ray;
    const cutY = this.clipPlane.constant;
    let o = ray.origin.clone();
    if (o.y > cutY) {
      if (ray.direction.y >= -1e-4) return null;
      o.addScaledVector(ray.direction, (cutY - o.y) / ray.direction.y);
    }
    const hit = this.world.raycast(o.x, o.y, o.z, ray.direction.x, ray.direction.y, ray.direction.z, 200);
    if (!hit) return null;
    return { cell: { x: hit.x, y: hit.y, z: hit.z }, point: new THREE.Vector3(hit.px, hit.py, hit.pz), normal: new THREE.Vector3(hit.nx, hit.ny, hit.nz) };
  }

  private moduleAt(p: THREE.Vector3): Node {
    return { i: Math.floor((p.x - this.plot.minX) / MODULE), j: Math.floor((p.z - this.plot.minZ) / MODULE) };
  }

  private nodeAt(p: THREE.Vector3): Node {
    return { i: clamp(Math.round((p.x - this.plot.minX) / MODULE), 0, MODULES_PER_SIDE), j: clamp(Math.round((p.z - this.plot.minZ) / MODULE), 0, MODULES_PER_SIDE) };
  }

  private moduleInside(m: Node): boolean {
    return m.i >= 0 && m.i < MODULES_PER_SIDE && m.j >= 0 && m.j < MODULES_PER_SIDE;
  }

  /** Direction from the plot towards the island centre: the side attackers come from. */
  private frontDir(): { x: number; z: number } {
    const len = Math.hypot(this.plot.cx, this.plot.cz);
    if (len < 1) return { x: 0, z: 1 };
    return { x: -this.plot.cx / len, z: -this.plot.cz / len };
  }

  // ---------------------------------------------------------------- wall geometry
  /** Canonical wall piece for the grid segment between two adjacent corner nodes (one block thick). */
  private wallForSegment(a: Node, b: Node, k: number): PiecePlacement | null {
    const N = MODULES_PER_SIDE;
    if (a.j === b.j) {
      const i = Math.min(a.i, b.i);
      const j = a.j;
      if (i < 0 || i >= N || j < 0 || j > N) return null;
      return j < N ? { type: 'wall', i, j, k, rot: 0 } : { type: 'wall', i, j: N - 1, k, rot: 2 };
    }
    if (a.i === b.i) {
      const j = Math.min(a.j, b.j);
      const i = a.i;
      if (j < 0 || j >= N || i < 0 || i > N) return null;
      return i < N ? { type: 'wall', i, j, k, rot: 3 } : { type: 'wall', i: N - 1, j, k, rot: 1 };
    }
    return null;
  }

  /** Wall segments along a node path (Manhattan steps between consecutive nodes). */
  private pathSegments(nodes: Node[], k: number): PiecePlacement[] {
    const out: PiecePlacement[] = [];
    const seen = new Set<string>();
    for (let n = 1; n < nodes.length; n++) {
      let cur = { ...nodes[n - 1] };
      const to = nodes[n];
      let guard = 0;
      while ((cur.i !== to.i || cur.j !== to.j) && guard++ < 40) {
        const di = to.i - cur.i;
        const dj = to.j - cur.j;
        const next = Math.abs(di) >= Math.abs(dj) && di !== 0 ? { i: cur.i + Math.sign(di), j: cur.j } : { i: cur.i, j: cur.j + Math.sign(dj) };
        const w = this.wallForSegment(cur, next, k);
        if (w) {
          const key = pieceKey(w);
          if (!seen.has(key)) {
            seen.add(key);
            out.push(w);
          }
        }
        cur = next;
      }
    }
    return out;
  }

  /** Wall on the module edge nearest to a plane point. */
  private wallNearest(p: THREE.Vector3, k: number): PiecePlacement | null {
    const m = this.moduleAt(p);
    if (!this.moduleInside(m)) return null;
    const u = (p.x - this.plot.minX) / MODULE - m.i;
    const v = (p.z - this.plot.minZ) / MODULE - m.j;
    const d = [v, 1 - u, 1 - v, u];
    let side = 0;
    for (let s = 1; s < 4; s++) if (d[s] < d[side]) side = s;
    const segs: [Node, Node][] = [
      [{ i: m.i, j: m.j }, { i: m.i + 1, j: m.j }],
      [{ i: m.i + 1, j: m.j }, { i: m.i + 1, j: m.j + 1 }],
      [{ i: m.i, j: m.j + 1 }, { i: m.i + 1, j: m.j + 1 }],
      [{ i: m.i, j: m.j }, { i: m.i, j: m.j + 1 }],
    ];
    return this.wallForSegment(segs[side][0], segs[side][1], k);
  }

  /** Merlon blocks (alternating) along the top of a wall piece. */
  private merlonsFor(w: PiecePlacement): { x: number; y: number; z: number; value: number }[] {
    const out: { x: number; y: number; z: number; value: number }[] = [];
    const v = this.build.blockValue;
    for (const c of pieceCells(this.plot, w)) {
      if (c.edit < 0 || Math.floor(c.edit / MODULE) !== 0) continue;
      if (c.edit % 2 !== 0) continue;
      out.push({ x: c.x, y: c.y + 1, z: c.z, value: v });
    }
    return out;
  }

  private rectSegments(a: Node, b: Node): [Node, Node][] {
    const i0 = Math.min(a.i, b.i);
    const i1 = Math.max(a.i, b.i);
    const j0 = Math.min(a.j, b.j);
    const j1 = Math.max(a.j, b.j);
    const segs: [Node, Node][] = [];
    for (let i = i0; i <= i1; i++) {
      segs.push([{ i, j: j0 }, { i: i + 1, j: j0 }]);
      segs.push([{ i, j: j1 + 1 }, { i: i + 1, j: j1 + 1 }]);
    }
    for (let j = j0; j <= j1; j++) {
      segs.push([{ i: i0, j }, { i: i0, j: j + 1 }]);
      segs.push([{ i: i1 + 1, j }, { i: i1 + 1, j: j + 1 }]);
    }
    return segs;
  }

  private segMid(s: [Node, Node]): { x: number; z: number } {
    return { x: this.plot.minX + ((s[0].i + s[1].i) / 2) * MODULE, z: this.plot.minZ + ((s[0].j + s[1].j) / 2) * MODULE };
  }

  // ---------------------------------------------------------------- brushes
  private commitWalls(nodes: Node[]): number {
    const walls = this.pathSegments(nodes, this.level);
    if (walls.length === 0) return 0;
    this.build.beginBatch();
    let placed = 0;
    for (const w of walls) {
      if (this.build.placePiece(w)) placed++;
      this.build.placeCells(this.merlonsFor(w));
    }
    this.build.endBatch();
    this.debugLast = `walls:${placed}`;
    return placed;
  }

  private placeWallAt(p: THREE.Vector3): boolean {
    const w = this.wallNearest(p, this.level);
    if (!w) return false;
    this.build.beginBatch();
    const ok = this.build.placePiece(w);
    this.build.placeCells(this.merlonsFor(w));
    this.build.endBatch();
    this.debugLast = `wall:${ok}`;
    return ok;
  }

  /** Hollow tower one storey taller than the current level: door on the inner side, firing slits above, spiral steps, parapet roof. */
  private placeTower(m: Node): boolean {
    if (!this.moduleInside(m)) return false;
    const top = Math.min(MAX_LEVEL - 1, Math.max(1, this.level + 1));
    const o0 = moduleOrigin(this.plot, m.i, m.j, 0);
    const mx = o0.x + MODULE / 2;
    const mz = o0.z + MODULE / 2;
    const dx = this.plot.cx - mx;
    const dz = this.plot.cz - mz;
    const doorSide = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : dz > 0 ? 2 : 0;
    const door = presetToOpen('wall', 'door')!;
    const slit = presetToOpen('wall', 'slit')!;
    const value = this.build.blockValue;
    this.build.beginBatch();
    for (let s = 0; s <= top; s++) {
      for (let side = 0; side < 4; side++) {
        const open = s === 0 ? (side === doorSide ? door : undefined) : slit;
        this.build.placePiece({ type: 'wall', i: m.i, j: m.j, k: s, rot: side }, open);
      }
      if (s > 0) this.build.placePiece({ type: 'floor', i: m.i, j: m.j, k: s, rot: 0 }, this.hatchMask(s));
      // Spiral steps around the inner ring (the storey floor is step zero from the first storey up).
      const steps: { x: number; y: number; z: number; value: number }[] = [];
      for (let n = s === 0 ? 0 : 1; n < STOREY; n++) {
        const r = (STOREY * s + n) % RING.length;
        const [lx, lz] = RING[r];
        const [nx, nz] = RING[(r + 1) % RING.length];
        const ddx = nx - lx;
        const ddz = nz - lz;
        const rot = ddx > 0 ? 0 : ddz > 0 ? 1 : ddx < 0 ? 2 : 3;
        steps.push({ x: o0.x + lx, y: PLOT_Y + STOREY * s + n, z: o0.z + lz, value: withShape(value, makeShape('stairs', rot)) });
      }
      this.build.placeCells(steps);
    }
    const roofK = top + 1;
    this.build.placePiece({ type: 'floor', i: m.i, j: m.j, k: roofK, rot: 0 }, this.hatchMask(roofK));
    const roofY = PLOT_Y + roofK * STOREY;
    const merlons: { x: number; y: number; z: number; value: number }[] = [];
    for (let lx = 0; lx < MODULE; lx++)
      for (let lz = 0; lz < MODULE; lz++) {
        const edge = lx === 0 || lx === MODULE - 1 || lz === 0 || lz === MODULE - 1;
        if (!edge || (lx + lz) % 2 !== 0) continue;
        merlons.push({ x: o0.x + lx, y: roofY + 1, z: o0.z + lz, value });
      }
    this.build.placeCells(merlons);
    this.build.endBatch();
    this.debugLast = `tower:${m.i},${m.j}:${top}`;
    return true;
  }

  /** Floor mask for a tower storey: open above the two highest steps of the storey below. */
  private hatchMask(k: number): boolean[] {
    const open = new Array<boolean>(MODULE * MODULE).fill(false);
    for (const n of [STOREY - 2, STOREY - 1]) {
      const r = (STOREY * (k - 1) + n) % RING.length;
      const [lx, lz] = RING[r];
      open[lz * MODULE + lx] = true;
    }
    return open;
  }

  /** Walled hall with a flat roof and a single door on the side attackers come from. */
  private placeBunker(a: Node, b: Node): boolean {
    const i0 = clamp(Math.min(a.i, b.i), 0, MODULES_PER_SIDE - 1);
    const i1 = clamp(Math.max(a.i, b.i), 0, MODULES_PER_SIDE - 1);
    const j0 = clamp(Math.min(a.j, b.j), 0, MODULES_PER_SIDE - 1);
    const j1 = clamp(Math.max(a.j, b.j), 0, MODULES_PER_SIDE - 1);
    const k = this.level;
    if (k + 1 > MAX_LEVEL) return false;
    const segs = this.rectSegments({ i: i0, j: j0 }, { i: i1, j: j1 });
    const f = this.frontDir();
    const cx = this.plot.minX + ((i0 + i1 + 1) / 2) * MODULE;
    const cz = this.plot.minZ + ((j0 + j1 + 1) / 2) * MODULE;
    let doorIdx = 0;
    let best = -Infinity;
    segs.forEach((s, idx) => {
      const mid = this.segMid(s);
      const d = (mid.x - cx) * f.x + (mid.z - cz) * f.z;
      if (d > best) {
        best = d;
        doorIdx = idx;
      }
    });
    const door = presetToOpen('wall', 'door')!;
    const value = this.build.blockValue;
    this.build.beginBatch();
    segs.forEach((s, idx) => {
      const w = this.wallForSegment(s[0], s[1], k);
      if (w) this.build.placePiece(w, idx === doorIdx ? door : undefined);
    });
    const parapet: { x: number; y: number; z: number; value: number }[] = [];
    const roofY = PLOT_Y + (k + 1) * STOREY;
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        if (k > 0) this.build.placePiece({ type: 'floor', i, j, k, rot: 0 });
        this.build.placePiece({ type: 'floor', i, j, k: k + 1, rot: 0 });
        const o = moduleOrigin(this.plot, i, j, 0);
        for (let lx = 0; lx < MODULE; lx++)
          for (let lz = 0; lz < MODULE; lz++) {
            const edge = (i === i0 && lx === 0) || (i === i1 && lx === MODULE - 1) || (j === j0 && lz === 0) || (j === j1 && lz === MODULE - 1);
            if (!edge || (lx + lz) % 2 !== 0) continue;
            parapet.push({ x: o.x + lx, y: roofY + 1, z: o.z + lz, value });
          }
      }
    this.build.placeCells(parapet);
    this.build.endBatch();
    this.debugLast = `bunker:${i0},${j0}-${i1},${j1}`;
    return true;
  }

  /** Random perfect maze over the rectangle's modules, entrance away from the centre, exit towards it. */
  private placeMaze(a: Node, b: Node): boolean {
    const i0 = clamp(Math.min(a.i, b.i), 0, MODULES_PER_SIDE - 1);
    const i1 = clamp(Math.max(a.i, b.i), 0, MODULES_PER_SIDE - 1);
    const j0 = clamp(Math.min(a.j, b.j), 0, MODULES_PER_SIDE - 1);
    const j1 = clamp(Math.max(a.j, b.j), 0, MODULES_PER_SIDE - 1);
    const w = i1 - i0 + 1;
    const h = j1 - j0 + 1;
    if (w * h < 2) return false;
    const id = (i: number, j: number): number => (j - j0) * w + (i - i0);
    const visited = new Uint8Array(w * h);
    const open = new Set<string>();
    const edgeKey = (i: number, j: number, i2: number, j2: number): string => (i < i2 || (i === i2 && j < j2) ? `${i},${j}-${i2},${j2}` : `${i2},${j2}-${i},${j}`);
    const stack: [number, number][] = [[i0 + Math.floor(Math.random() * w), j0 + Math.floor(Math.random() * h)]];
    visited[id(stack[0][0], stack[0][1])] = 1;
    while (stack.length) {
      const [ci, cj] = stack[stack.length - 1];
      const cand: [number, number][] = [];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < i0 || ni > i1 || nj < j0 || nj > j1 || visited[id(ni, nj)]) continue;
        cand.push([ni, nj]);
      }
      if (!cand.length) {
        stack.pop();
        continue;
      }
      const [ni, nj] = cand[Math.floor(Math.random() * cand.length)];
      visited[id(ni, nj)] = 1;
      open.add(edgeKey(ci, cj, ni, nj));
      stack.push([ni, nj]);
    }
    const f = this.frontDir();
    const cx = this.plot.minX + ((i0 + i1 + 1) / 2) * MODULE;
    const cz = this.plot.minZ + ((j0 + j1 + 1) / 2) * MODULE;
    const outer = this.rectSegments({ i: i0, j: j0 }, { i: i1, j: j1 });
    let entrance = 0;
    let exit = 0;
    let lo = Infinity;
    let hi = -Infinity;
    outer.forEach((s, idx) => {
      const mid = this.segMid(s);
      const d = (mid.x - cx) * f.x + (mid.z - cz) * f.z;
      if (d < lo) {
        lo = d;
        entrance = idx;
      }
      if (d > hi) {
        hi = d;
        exit = idx;
      }
    });
    const k = this.level;
    this.build.beginBatch();
    outer.forEach((s, idx) => {
      if (idx === entrance || idx === exit) return;
      const wp = this.wallForSegment(s[0], s[1], k);
      if (wp) this.build.placePiece(wp);
    });
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        if (i < i1 && !open.has(edgeKey(i, j, i + 1, j))) {
          const wp = this.wallForSegment({ i: i + 1, j }, { i: i + 1, j: j + 1 }, k);
          if (wp) this.build.placePiece(wp);
        }
        if (j < j1 && !open.has(edgeKey(i, j, i, j + 1))) {
          const wp = this.wallForSegment({ i, j: j + 1 }, { i: i + 1, j: j + 1 }, k);
          if (wp) this.build.placePiece(wp);
        }
      }
    this.build.endBatch();
    this.debugLast = `maze:${w}x${h}`;
    return true;
  }

  /** Ramp in the tapped module, rising towards where the finger sits inside it; opens the floor above so it leads somewhere. */
  private placeStairs(p: THREE.Vector3): boolean {
    const m = this.moduleAt(p);
    if (!this.moduleInside(m)) return false;
    const o = moduleOrigin(this.plot, m.i, m.j, this.level);
    const dx = p.x - (o.x + MODULE / 2);
    const dz = p.z - (o.z + MODULE / 2);
    const rot = Math.abs(dx) >= Math.abs(dz) ? (dx >= 0 ? 0 : 2) : dz >= 0 ? 1 : 3;
    this.build.beginBatch();
    const ok = this.build.placePiece({ type: 'ramp', i: m.i, j: m.j, k: this.level, rot });
    const aboveKey = pieceKey({ type: 'floor', i: m.i, j: m.j, k: this.level + 1, rot: 0 });
    const above = this.build.pieces.get(aboveKey);
    if (above) {
      const open = above.open.slice();
      for (let lx = 0; lx < MODULE; lx++)
        for (let lz = 0; lz < MODULE; lz++) {
          const row = rot === 0 ? lx : rot === 1 ? lz : rot === 2 ? MODULE - 1 - lx : MODULE - 1 - lz;
          if (row >= MODULE - 2) open[lz * MODULE + lx] = true;
        }
      this.build.setPieceOpen(aboveKey, open);
    }
    this.build.endBatch();
    this.debugLast = `stairs:${ok}`;
    return ok;
  }

  /** Waist-high cover, three blocks wide, facing the direction attackers come from. */
  private placeCover(p: THREE.Vector3): boolean {
    const f = this.frontDir();
    const alongZ = Math.abs(f.x) > Math.abs(f.z);
    const x0 = Math.floor(p.x);
    const z0 = Math.floor(p.z);
    const y = this.storeyY;
    const value = this.build.blockValue;
    const cells: { x: number; y: number; z: number; value: number }[] = [];
    for (let d = -1; d <= 1; d++) cells.push(alongZ ? { x: x0, y, z: z0 + d, value } : { x: x0 + d, y, z: z0, value });
    const n = this.build.placeCells(cells.filter((c) => this.build.inPlot(c.x, c.y, c.z) && this.world.get(c.x, c.y, c.z) === 0));
    this.debugLast = `cover:${n}`;
    return n > 0;
  }

  private placeFlagAt(p: THREE.Vector3): boolean {
    const cell = { x: Math.floor(p.x), y: this.storeyY, z: Math.floor(p.z) };
    if (!this.build.inPlot(cell.x, cell.y, cell.z)) {
      this.build.events.emit('invalid', { key: 'flagOutside' });
      return false;
    }
    if (this.world.get(cell.x, cell.y - 1, cell.z) === 0) {
      this.build.events.emit('invalid', { key: 'flagNeedsFloor' });
      return false;
    }
    if (this.world.get(cell.x, cell.y, cell.z) !== 0 || this.world.get(cell.x, cell.y + 1, cell.z) !== 0) {
      this.build.events.emit('invalid', { key: 'flagBlocked' });
      return false;
    }
    // The flag also seeds the defender's spawn when none was set, so the table never nags for one.
    this.build.beginBatch();
    this.build.placeFlag(cell);
    if (!this.build.state.spawn) this.build.placeSpawn(cell);
    this.build.endBatch();
    this.debugLast = 'flag';
    return true;
  }

  /** Removes the piece (or the single block) under a screen position. */
  private eraseAt(sx: number, sy: number, g: Gesture | null): boolean {
    const hit = this.hitBlock(sx, sy);
    if (!hit || !this.build.inPlot(hit.cell.x, hit.cell.y, hit.cell.z)) return false;
    const rec = this.build.pieceAt(hit.cell);
    const key = rec ? rec.key : `${hit.cell.x},${hit.cell.y},${hit.cell.z}`;
    if (g && g.lastEraseKey === key) return false;
    if (g) g.lastEraseKey = key;
    if (rec) this.build.removePiece(rec.key);
    else this.build.eraseCells([hit.cell]);
    this.debugLast = `erase:${key}`;
    return true;
  }

  /** Piece under a screen position for the openings picker (walls and floors only). */
  private pickOpenings(sx: number, sy: number): void {
    const hit = this.hitBlock(sx, sy);
    const rec = hit ? this.build.pieceAt(hit.cell) : null;
    if (rec && (rec.type === 'wall' || rec.type === 'floor')) this.events.emit('picker', { key: rec.key, type: rec.type, open: rec.open.slice() });
    else this.events.emit('picker', null);
  }

  /** Applies an openings preset to a picked piece. */
  applyPreset(key: string, preset: string): boolean {
    const rec: PieceRecord | undefined = this.build.pieces.get(key);
    if (!rec) return false;
    const open = presetToOpen(rec.type, preset);
    if (!open) return false;
    const ok = this.build.setPieceOpen(key, open);
    this.debugLast = `preset:${preset}`;
    return ok;
  }

  // ---------------------------------------------------------------- input
  private overUI(sx: number, sy: number): boolean {
    const el = document.elementFromPoint(sx, sy);
    return !!el && !!el.closest('[data-ui]');
  }

  private readPointer(): { down: boolean; held: boolean; up: boolean; cancel: boolean; x: number; y: number; heldMs: number; longTick: boolean } {
    const input = this.input;
    if (input.isTouch) {
      const v = input.virtual;
      return { down: v.strokeStart, held: v.strokeActive, up: v.strokeEnd && !v.strokeCancel, cancel: v.strokeCancel, x: v.strokeX, y: v.strokeY, heldMs: v.strokeHeldMs, longTick: v.strokeLongTick };
    }
    // Read the hold time even before the gesture exists: a slow frame can deliver press and release together.
    const heldMs = input.buttonHeldMs(0);
    return { down: input.buttonPressed(0), held: input.buttonDown(0), up: input.buttonReleased(0), cancel: false, x: input.cursorX, y: input.cursorY, heldMs, longTick: input.buttonDown(0) && heldMs >= LONG_PRESS_MS };
  }

  private handleGestures(dt: number): void {
    void dt;
    const input = this.input;
    const v = input.virtual;
    // Two fingers / wheel / right drag: camera.
    if (v.zoom !== 0) this.zoom = clamp(this.zoom * (1 + v.zoom * 0.6), 0.45, 2.6);
    if (v.panX !== 0 || v.panY !== 0) this.panBy(v.panX, v.panY);
    if (input.wheel !== 0) this.zoom = clamp(this.zoom * (1 + input.wheel * 0.12), 0.45, 2.6);
    if (!input.isTouch) {
      // Right drag pans: cursor deltas, since movement deltas only flow under pointer lock.
      if (input.buttonDown(2)) {
        if (this.rightDrag) this.panBy(input.cursorX - this.rightDrag.x, input.cursorY - this.rightDrag.y);
        this.rightDrag = { x: input.cursorX, y: input.cursorY };
      } else this.rightDrag = null;
    }
    if (!input.isTouch) {
      const speed = 22 * dt * this.zoom;
      const ax = input.axisX();
      const ay = input.axisY();
      if (ax !== 0 || ay !== 0) {
        const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        this.pan.addScaledVector(right, ax * speed).addScaledVector(fwd, ay * speed);
      }
      if (input.wasPressed('KeyQ')) this.rotate(-1);
      if (input.wasPressed('KeyE') || input.wasPressed('KeyR')) this.rotate(1);
      for (let i = 1; i <= TABLE_LEVELS; i++) if (input.wasPressed(`Digit${i}`)) this.setLevel(i - 1);
      if (input.wasPressed('KeyZ') && (input.isDown('ControlLeft') || input.isDown('MetaLeft'))) {
        if (input.isDown('ShiftLeft')) this.build.redo();
        else this.build.undo();
      }
      if (input.wasPressed('KeyY') && (input.isDown('ControlLeft') || input.isDown('MetaLeft'))) this.build.redo();
      if (input.wasPressed('Escape')) {
        this.gesture = null;
        this.events.emit('picker', null);
      }
    }
    const ptr = this.readPointer();
    const now = performance.now();
    if (ptr.cancel) this.gesture = null;
    if (ptr.down && !this.gesture) {
      const blocked = this.overUI(ptr.x, ptr.y);
      const g: Gesture = { sx: ptr.x, sy: ptr.y, downX: ptr.x, downY: ptr.y, downAt: now, moved: 0, blocked, longFired: false, nodes: [], rectStart: null, rectEnd: null, lastEraseKey: '' };
      this.gesture = g;
      if (!blocked) this.gestureStart(g);
    }
    const g = this.gesture;
    if (!g) return;
    if (ptr.held || ptr.up) {
      const dx = ptr.x - g.sx;
      const dy = ptr.y - g.sy;
      g.moved += Math.abs(dx) + Math.abs(dy);
      g.sx = ptr.x;
      g.sy = ptr.y;
      if (!g.blocked && (dx !== 0 || dy !== 0)) this.gestureMove(g, dx, dy);
    }
    // A finger held still is a long press: the block under it lights up red; the erase happens on release,
    // decided from hardware event timestamps so a slow frame can never turn a tap into a removal.
    g.longFired = !g.blocked && g.moved < TAP_PX && ptr.longTick && this.brush !== 'hand' && this.brush !== 'erase';
    if (ptr.up) {
      if (!g.blocked) {
        if (g.moved < TAP_PX && ptr.heldMs >= LONG_PRESS_MS && this.brush !== 'hand' && this.brush !== 'erase') this.eraseAt(g.sx, g.sy, null);
        else this.gestureEnd(g);
      }
      this.gesture = null;
    }
  }

  private gestureStart(g: Gesture): void {
    const p = this.planePoint(g.sx, g.sy);
    if (!p) return;
    if (this.brush === 'wall') g.nodes = [this.nodeAt(p)];
    else if (this.brush === 'bunker' || this.brush === 'maze') {
      const m = this.moduleAt(p);
      if (this.moduleInside(m)) {
        g.rectStart = m;
        g.rectEnd = m;
      }
    } else if (this.brush === 'erase') this.eraseAt(g.sx, g.sy, g);
  }

  private gestureMove(g: Gesture, dx: number, dy: number): void {
    const dragBrush = DRAG_BRUSHES.includes(this.brush);
    if (!dragBrush) {
      // Tap brushes pan with one finger.
      if (g.moved >= TAP_PX) this.panBy(dx, dy);
      return;
    }
    const p = this.planePoint(g.sx, g.sy);
    if (!p) return;
    if (this.brush === 'wall' && g.nodes.length) {
      const n = this.nodeAt(p);
      const last = g.nodes[g.nodes.length - 1];
      if (n.i !== last.i || n.j !== last.j) g.nodes.push(n);
    } else if ((this.brush === 'bunker' || this.brush === 'maze') && g.rectStart) {
      const m = this.moduleAt(p);
      g.rectEnd = { i: clamp(m.i, 0, MODULES_PER_SIDE - 1), j: clamp(m.j, 0, MODULES_PER_SIDE - 1) };
    } else if (this.brush === 'erase' && g.moved >= TAP_PX) this.eraseAt(g.sx, g.sy, g);
  }

  private gestureEnd(g: Gesture): void {
    const tap = g.moved < TAP_PX;
    const p = this.planePoint(g.sx, g.sy);
    switch (this.brush) {
      case 'wall':
        if (g.nodes.length > 1) this.commitWalls(g.nodes);
        else if (p) this.placeWallAt(p);
        break;
      case 'bunker':
        if (g.rectStart && g.rectEnd) this.placeBunker(g.rectStart, g.rectEnd);
        break;
      case 'maze':
        if (g.rectStart && g.rectEnd) this.placeMaze(g.rectStart, g.rectEnd);
        break;
      case 'tower':
        if (tap && p) this.placeTower(this.moduleAt(p));
        break;
      case 'stairs':
        if (tap && p) this.placeStairs(p);
        break;
      case 'cover':
        if (tap && p) this.placeCover(p);
        break;
      case 'flag':
        if (tap && p) this.placeFlagAt(p);
        break;
      case 'openings':
        if (tap) this.pickOpenings(g.sx, g.sy);
        break;
      case 'erase':
        if (tap) this.eraseAt(g.sx, g.sy, null);
        break;
      case 'hand':
        break;
    }
  }

  // ---------------------------------------------------------------- overlays
  private showGhostCells(cells: { x: number; y: number; z: number }[]): void {
    const m = new THREE.Matrix4();
    let n = 0;
    for (const c of cells) {
      if (n >= 4000) break;
      m.makeTranslation(c.x + 0.5, c.y + 0.5, c.z + 0.5);
      this.ghost.setMatrixAt(n++, m);
    }
    this.ghost.count = n;
    this.ghost.instanceMatrix.needsUpdate = true;
    this.ghost.visible = n > 0;
  }

  private updateOverlays(): void {
    this.hover.visible = false;
    this.edgeHover.visible = false;
    this.ghost.visible = false;
    const g = this.gesture;
    const input = this.input;
    // Pointer position: the active gesture, or the mouse when hovering.
    let sx = -1;
    let sy = -1;
    if (g && !g.blocked) {
      sx = g.sx;
      sy = g.sy;
    } else if (!input.isTouch && !g) {
      sx = input.cursorX;
      sy = input.cursorY;
      if (this.overUI(sx, sy)) return;
    }
    if (sx < 0) return;
    if (g && g.longFired) {
      // Long press: the block about to be erased glows red.
      const hit = this.hitBlock(sx, sy);
      if (hit) {
        this.edgeHover.visible = true;
        this.edgeHover.scale.set(1.08, 1.08, 1.08);
        this.edgeHover.position.set(hit.cell.x + 0.5, hit.cell.y + 0.5, hit.cell.z + 0.5);
        (this.edgeHover.material as THREE.MeshBasicMaterial).color.setHex(0xff3b4a);
      }
      return;
    }
    (this.edgeHover.material as THREE.MeshBasicMaterial).color.setHex(0x00e5ff);
    const p = this.planePoint(sx, sy);
    if (!p) return;
    const k = this.level;
    if (g && this.brush === 'wall' && g.nodes.length > 1) {
      const cells: Cell[] = [];
      for (const w of this.pathSegments(g.nodes, k)) for (const c of pieceCells(this.plot, w)) cells.push(c);
      this.showGhostCells(cells);
      return;
    }
    if (g && (this.brush === 'bunker' || this.brush === 'maze') && g.rectStart && g.rectEnd) {
      const cells: Cell[] = [];
      for (const s of this.rectSegments(g.rectStart, g.rectEnd)) {
        const w = this.wallForSegment(s[0], s[1], k);
        if (w) for (const c of pieceCells(this.plot, w)) cells.push(c);
      }
      this.showGhostCells(cells);
      return;
    }
    const m = this.moduleAt(p);
    if (!this.moduleInside(m)) return;
    if (this.brush === 'wall') {
      const w = this.wallNearest(p, k);
      if (w) {
        const o = moduleOrigin(this.plot, w.i, w.j, w.k);
        const alongX = w.rot === 0 || w.rot === 2;
        const lz = w.rot === 0 ? 0 : w.rot === 2 ? MODULE - 1 : 0;
        const lx = w.rot === 3 ? 0 : w.rot === 1 ? MODULE - 1 : 0;
        this.edgeHover.visible = true;
        this.edgeHover.scale.set(alongX ? MODULE : 1, STOREY, alongX ? 1 : MODULE);
        this.edgeHover.position.set(o.x + (alongX ? MODULE / 2 : lx + 0.5), o.y + STOREY / 2, o.z + (alongX ? lz + 0.5 : MODULE / 2));
      }
      return;
    }
    if (this.brush === 'tower' || this.brush === 'bunker' || this.brush === 'maze' || this.brush === 'stairs') {
      const o = moduleOrigin(this.plot, m.i, m.j, k);
      this.hover.visible = true;
      this.hover.position.set(o.x + MODULE / 2, this.storeyY + 0.06, o.z + MODULE / 2);
    }
  }

  // ---------------------------------------------------------------- attack path
  private doorstep(): THREE.Vector3 | null {
    const f = this.frontDir();
    const base = Math.atan2(f.z, f.x);
    for (let attempt = 0; attempt < 10; attempt++) {
      const a = base + (attempt % 2 === 0 ? 1 : -1) * Math.ceil(attempt / 2) * 0.35;
      const r = PLOT_HALF + 6 + Math.floor(attempt / 4) * 2;
      const x = this.plot.cx + Math.cos(a) * r;
      const z = this.plot.cz + Math.sin(a) * r;
      const y = this.terrain.heightAt(x, z);
      if (y > 1.0 && !this.world.boxIntersectsSolid(x - 0.4, y, z - 0.4, x + 0.4, y + 2, z + 0.4)) return new THREE.Vector3(x, y + 0.05, z);
    }
    return null;
  }

  private refreshPath(): void {
    const flag = this.build.state.flag;
    if (!flag) {
      this.setPath([]);
      return;
    }
    if (!this.nav) this.nav = new NavSystem(this.world, this.terrain, this.plots);
    this.nav.invalidatePlot(this.plot.index);
    const start = this.doorstep();
    if (!start) {
      this.setPath([]);
      return;
    }
    const goal = new THREE.Vector3(flag.x + 0.5, flag.y, flag.z + 0.5);
    const route = this.nav.findRoute(start, goal);
    if (!route || route.length < 2) {
      this.setPath([]);
      return;
    }
    const last = route[route.length - 1];
    if (Math.hypot(last.x - goal.x, last.z - goal.z) > 2.5 || Math.abs(last.y - goal.y) > 3) {
      this.setPath([]);
      return;
    }
    this.setPath(route);
  }

  private setPath(points: THREE.Vector3[]): void {
    this.pathPoints = points;
    let len = 0;
    for (let i = 1; i < points.length; i++) len += points[i].distanceTo(points[i - 1]);
    this.pathLength = len;
    const geo = this.pathMesh.geometry;
    geo.dispose();
    if (points.length < 2) {
      this.pathMesh.geometry = new THREE.BufferGeometry();
      this.pathMesh.visible = false;
      for (const d of this.dots) d.visible = false;
      this.events.emit('path', { length: null });
      return;
    }
    const w = 0.45;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[Math.max(0, i - 1)];
      const b = points[Math.min(points.length - 1, i + 1)];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      const nx = (-dz / l) * w;
      const nz = (dx / l) * w;
      const p = points[i];
      pos.push(p.x + nx, p.y + 0.28, p.z + nz, p.x - nx, p.y + 0.28, p.z - nz);
      if (i > 0) {
        const o = (i - 1) * 2;
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    this.pathMesh.geometry = g;
    this.pathMesh.visible = true;
    for (const d of this.dots) d.visible = true;
    this.events.emit('path', { length: len });
  }

  private updateDots(dt: number): void {
    if (this.pathPoints.length < 2) return;
    this.dotPhase = (this.dotPhase + dt * 7) % this.pathLength;
    for (let n = 0; n < this.dots.length; n++) {
      let s = (this.dotPhase + (n * this.pathLength) / this.dots.length) % this.pathLength;
      for (let i = 1; i < this.pathPoints.length; i++) {
        const a = this.pathPoints[i - 1];
        const b = this.pathPoints[i];
        const seg = a.distanceTo(b);
        if (s <= seg || i === this.pathPoints.length - 1) {
          const t = seg > 0 ? clamp(s / seg, 0, 1) : 0;
          this.dots[n].position.lerpVectors(a, b, t);
          this.dots[n].position.y += 0.5;
          break;
        }
        s -= seg;
      }
    }
  }

  get attackPathLength(): number | null {
    return this.pathPoints.length >= 2 ? this.pathLength : null;
  }

  // ---------------------------------------------------------------- frame
  update(dt: number): void {
    if (!this.active) return;
    this.handleGestures(dt);
    this.updateCamera(dt);
    this.updateOverlays();
    if (this.pathDirty && performance.now() - this.pathStamp > 450) {
      // Debounced on wall-clock time so a burst of edits costs one navigation rebuild.
      this.pathDirty = false;
      this.refreshPath();
    }
    this.updateDots(dt);
  }

  /** Test aid: performs a brush action at a plane point / rectangle as if tapped or dragged. */
  debugApply(brush: Brush, points: { x: number; z: number }[]): string {
    const prev = this.brush;
    this.brush = brush;
    const y = this.storeyY;
    const nodes = points.map((q) => this.nodeAt(new THREE.Vector3(q.x, y, q.z)));
    const mods = points.map((q) => this.moduleAt(new THREE.Vector3(q.x, y, q.z)));
    const p0 = new THREE.Vector3(points[0].x, y, points[0].z);
    switch (brush) {
      case 'wall':
        if (points.length > 1) this.commitWalls(nodes);
        else this.placeWallAt(p0);
        break;
      case 'tower':
        this.placeTower(mods[0]);
        break;
      case 'bunker':
        this.placeBunker(mods[0], mods[mods.length - 1]);
        break;
      case 'maze':
        this.placeMaze(mods[0], mods[mods.length - 1]);
        break;
      case 'stairs':
        this.placeStairs(p0);
        break;
      case 'cover':
        this.placeCover(p0);
        break;
      case 'flag':
        this.placeFlagAt(p0);
        break;
      default:
        break;
    }
    this.brush = prev;
    return this.debugLast;
  }

  debugState(): Record<string, unknown> {
    return { brush: this.brush, level: this.level, yaw: this.yawIndex, zoom: +this.zoom.toFixed(2), pan: this.pan.toArray().map((v) => +v.toFixed(1)), path: this.attackPathLength === null ? null : +this.attackPathLength.toFixed(1), pieces: this.build.pieces.size, used: this.build.state.used, last: this.debugLast, gesture: this.gesture ? { moved: Math.round(this.gesture.moved), nodes: this.gesture.nodes.length, blocked: this.gesture.blocked } : null };
  }
}
