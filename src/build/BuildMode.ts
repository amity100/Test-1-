import * as THREE from 'three';
import { FlagMesh } from '../render/FlagMesh';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Terrain } from '../world/Terrain';
import type { Input } from '../core/Input';
import { PLOT_Y, PLOT_MAX_HEIGHT, type Plot } from '../world/Layout';
import { Mat, encodeBlock, blockMat, blockColor, PALETTE } from '../world/Voxel';
import { STYLES, type StyleId, type BlockRole } from '../world/Styles';
import { PREFABS, rotateBlocks, prefabCost, type PrefabId, type PrefabBlock } from '../world/Prefabs';
import { checkReachability, type Cell, type ReachResult } from '../world/Reachability';
import { generateFortress, type Archetype } from '../world/FortressGen';
import { Random } from '../core/Random';
import { Emitter } from '../core/Events';
import { clamp, damp } from '../core/MathUtil';

export type Tool = 'block' | 'box' | 'line' | 'wall' | 'stairs' | 'prefab' | 'paint' | 'erase' | 'flag' | 'spawn';

/** A quick-select slot: a block kind (material + colour) or a prefab. */
export type HotbarSlot = { kind: 'block'; mat: Mat; color: number } | { kind: 'prefab'; id: PrefabId } | null;
export const HOTBAR_SIZE = 9;
/** Tools that need two clicks (start and end). */
export const TWO_POINT_TOOLS: Tool[] = ['box', 'line', 'wall', 'stairs'];

export interface BuildState {
  tool: Tool;
  mat: Mat;
  color: number;
  prefab: PrefabId;
  prefabSize: number;
  rot: number;
  mirror: boolean;
  hollow: boolean;
  used: number;
  budget: number;
  flag: Cell | null;
  spawn: Cell | null;
  reach: ReachResult;
  style: StyleId;
  boxStart: Cell | null;
  canUndo: boolean;
  canRedo: boolean;
  /** Build on a fixed height plane instead of surfaces. */
  layerLock: boolean;
  layerY: number;
  hotbar: HotbarSlot[];
  hotIndex: number;
  /** Height of walls drawn with the wall tool. */
  wallHeight: number;
}

interface Edit {
  x: number;
  y: number;
  z: number;
  before: number;
  after: number;
}

interface Action {
  edits: Edit[];
  flagBefore: Cell | null;
  flagAfter: Cell | null;
  spawnBefore: Cell | null;
  spawnAfter: Cell | null;
}

export interface Blueprint {
  name: string;
  style: StyleId;
  size: [number, number, number];
  rle: number[];
  flag: Cell | null;
  spawn: Cell | null;
  savedAt: number;
}

const BP_KEY = 'flagkeep.blueprints.v1';
export const BUILD_BUDGET = 3000;

/** Build-phase editor: orbit camera, block tools, prefabs, mirror, undo/redo, validation, blueprints. */
export class BuildMode {
  readonly events = new Emitter<{ change: Record<string, never>; placed: { count: number }; erased: { count: number }; invalid: { key: string }; placedCells: { cells: Cell[] } }>();
  readonly state: BuildState;
  private undoStack: Action[] = [];
  private redoStack: Action[] = [];
  private focus = new THREE.Vector3();
  private orbitYaw = 0.6;
  private orbitPitch = -0.7;
  private orbitDist = 46;
  private cursorCell: Cell | null = null;
  private cursorNormal = new THREE.Vector3();
  private cursorHitBlock: Cell | null = null;
  private ghost: THREE.Mesh;
  private ghostBox: THREE.Mesh;
  private prefabGhost: THREE.InstancedMesh;
  private flagMarker: FlagMesh;
  private spawnMarker: THREE.Mesh;
  private plotFrame: THREE.LineSegments;
  private layerGrid: THREE.GridHelper;
  private drawKey = '';
  private popMesh: THREE.InstancedMesh;
  private pops: { x: number; y: number; z: number; t: number; color: THREE.Color }[] = [];
  private group = new THREE.Group();
  private validateTimer = 0;
  private dirtyValidate = true;
  private raycaster = new THREE.Raycaster();
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PLOT_Y);
  active = false;

  constructor(
    private world: VoxelWorld,
    private terrain: Terrain,
    readonly plot: Plot,
    style: StyleId,
    private input: Input,
    private camera: THREE.PerspectiveCamera,
    private scene: THREE.Scene,
    budget = BUILD_BUDGET,
  ) {
    const s = STYLES[style];
    this.state = {
      tool: 'block',
      mat: blockMat(s.roles.wall) as Mat,
      color: blockColor(s.roles.wall),
      prefab: 'wall',
      prefabSize: 1,
      rot: 0,
      mirror: false,
      hollow: true,
      used: 0,
      budget,
      flag: null,
      spawn: null,
      reach: { ok: false, reason: 'noFlag' },
      style,
      boxStart: null,
      canUndo: false,
      canRedo: false,
      layerLock: false,
      layerY: PLOT_Y,
      hotbar: [],
      hotIndex: 0,
      wallHeight: 4,
    };
    this.resetHotbar();
    this.focus.set(plot.cx, PLOT_Y + 4, plot.cz);
    // Ghost block
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35, depthWrite: false }));
    this.ghost.visible = false;
    this.ghost.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.03, 1.03, 1.03)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false })));
    // Placement pops: freshly placed blocks appear with a quick scale-in while the chunk remeshes.
    this.popMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false }), 64);
    this.popMesh.count = 0;
    this.popMesh.frustumCulled = false;
    this.ghostBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
    this.ghostBox.visible = false;
    this.prefabGhost = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35, depthWrite: false }), 4000);
    this.prefabGhost.count = 0;
    this.prefabGhost.visible = false;
    this.prefabGhost.frustumCulled = false;
    // Flag marker
    this.flagMarker = new FlagMesh(new THREE.Color(0x00e5ff));
    this.flagMarker.group.visible = false;
    this.spawnMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 24), new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.8 }));
    this.spawnMarker.visible = false;
    // Plot frame
    const box = new THREE.Box3(new THREE.Vector3(plot.minX, PLOT_Y, plot.minZ), new THREE.Vector3(plot.maxX + 1, PLOT_Y + PLOT_MAX_HEIGHT, plot.maxZ + 1));
    const frameGeo = new THREE.BoxGeometry(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
    this.plotFrame = new THREE.LineSegments(new THREE.EdgesGeometry(frameGeo), new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35 }));
    this.plotFrame.position.copy(box.getCenter(new THREE.Vector3()));
    this.layerGrid = new THREE.GridHelper(plot.maxX - plot.minX + 1, plot.maxX - plot.minX + 1, 0x00e5ff, 0x00e5ff);
    const lgm = this.layerGrid.material as THREE.LineBasicMaterial;
    lgm.transparent = true;
    lgm.opacity = 0.28;
    lgm.depthWrite = false;
    this.layerGrid.visible = false;
    this.group.add(this.ghost, this.ghostBox, this.prefabGhost, this.flagMarker.group, this.spawnMarker, this.plotFrame, this.layerGrid, this.popMesh);
    this.group.visible = false;
    scene.add(this.group);
    this.recount();
  }

  enter(): void {
    this.active = true;
    this.group.visible = true;
    this.input.exitPointerLock();
    this.recount();
    this.dirtyValidate = true;
  }

  exit(): void {
    this.active = false;
    this.group.visible = false;
  }

  dispose(): void {
    this.scene.remove(this.group);
  }

  // ---------- state setters ----------
  setTool(t: Tool): void {
    this.state.tool = t;
    this.state.boxStart = null;
    this.emitChange();
  }
  setMaterial(m: Mat): void {
    this.state.mat = m;
    if (this.state.tool === 'prefab') this.state.tool = 'block';
    this.state.hotbar[this.state.hotIndex] = { kind: 'block', mat: m, color: this.state.color };
    this.emitChange();
  }
  setColor(c: number): void {
    this.state.color = c;
    const slot = this.state.hotbar[this.state.hotIndex];
    if (!slot || slot.kind === 'block') this.state.hotbar[this.state.hotIndex] = { kind: 'block', mat: this.state.mat, color: c };
    this.emitChange();
  }
  setPrefab(id: PrefabId): void {
    this.state.prefab = id;
    this.state.prefabSize = Math.min(this.state.prefabSize, PREFABS[id].sizes - 1);
    this.state.tool = 'prefab';
    this.state.hotbar[this.state.hotIndex] = { kind: 'prefab', id };
    this.emitChange();
  }
  setWallHeight(h: number): void {
    this.state.wallHeight = clamp(Math.round(h), 1, 12);
    this.emitChange();
  }

  // ---------- hotbar ----------
  /** Default quick slots from the style palette: the main roles plus a stairs prefab. */
  resetHotbar(): void {
    const s = STYLES[this.state.style];
    const block = (v: number): HotbarSlot => ({ kind: 'block', mat: blockMat(v) as Mat, color: blockColor(v) });
    this.state.hotbar = [block(s.roles.wall), block(s.roles.wallAlt), block(s.roles.trim), block(s.roles.floor), block(s.roles.roof), block(s.roles.accent), block(s.roles.glass), block(s.roles.light), { kind: 'prefab', id: 'stairs' }];
    while (this.state.hotbar.length < HOTBAR_SIZE) this.state.hotbar.push(null);
    this.state.hotIndex = 0;
    this.applySlot(this.state.hotbar[0]);
  }

  private applySlot(slot: HotbarSlot): void {
    const st = this.state;
    if (!slot) return;
    if (slot.kind === 'block') {
      st.mat = slot.mat;
      st.color = slot.color;
      if (st.tool === 'prefab') st.tool = 'block';
    } else {
      st.prefab = slot.id;
      st.prefabSize = Math.min(st.prefabSize, PREFABS[slot.id].sizes - 1);
      st.tool = 'prefab';
    }
  }

  selectHotbar(i: number): void {
    const st = this.state;
    st.hotIndex = clamp(i, 0, HOTBAR_SIZE - 1);
    st.boxStart = null;
    this.applySlot(st.hotbar[st.hotIndex]);
    this.emitChange();
  }

  cycleHotbar(dir: number): void {
    this.selectHotbar((this.state.hotIndex + dir + HOTBAR_SIZE) % HOTBAR_SIZE);
  }

  /** Puts a slot into the selected hotbar position (or clears it). */
  assignHotbar(slot: HotbarSlot): void {
    this.state.hotbar[this.state.hotIndex] = slot;
    this.applySlot(slot);
    this.emitChange();
  }
  setPrefabSize(n: number): void {
    this.state.prefabSize = clamp(n, 0, PREFABS[this.state.prefab].sizes - 1);
    this.emitChange();
  }
  rotate(): void {
    this.state.rot = (this.state.rot + 1) % 4;
    this.emitChange();
  }
  toggleMirror(): void {
    this.state.mirror = !this.state.mirror;
    this.emitChange();
  }
  toggleHollow(): void {
    this.state.hollow = !this.state.hollow;
    this.emitChange();
  }
  toggleLayerLock(): void {
    const st = this.state;
    st.layerLock = !st.layerLock;
    if (st.layerLock) st.layerY = this.cursorCell ? clamp(this.cursorCell.y, PLOT_Y, PLOT_Y + PLOT_MAX_HEIGHT - 1) : PLOT_Y;
    this.emitChange();
  }
  setLayer(y: number): void {
    this.state.layerY = clamp(y, PLOT_Y, PLOT_Y + PLOT_MAX_HEIGHT - 1);
    this.emitChange();
  }
  /** Moves the locked layer up/down, or the camera focus height when the layer is free. */
  nudge(dir: number): void {
    if (this.state.layerLock) this.setLayer(this.state.layerY + dir);
    else this.focus.y = clamp(this.focus.y + dir * 3, PLOT_Y + 1, PLOT_Y + PLOT_MAX_HEIGHT + 10);
  }
  setStyle(s: StyleId): void {
    this.state.style = s;
    this.resetHotbar();
    this.emitChange();
  }

  private emitChange(): void {
    this.state.canUndo = this.undoStack.length > 0;
    this.state.canRedo = this.redoStack.length > 0;
    this.events.emit('change', {});
  }

  private get currentValue(): number {
    return encodeBlock(this.state.mat, this.state.color);
  }

  inPlot(x: number, y: number, z: number): boolean {
    const p = this.plot;
    return x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ && y >= PLOT_Y && y < PLOT_Y + PLOT_MAX_HEIGHT;
  }

  recount(): void {
    const p = this.plot;
    this.state.used = this.world.countBlocksInBox(p.minX, PLOT_Y, p.minZ, p.maxX, PLOT_Y + PLOT_MAX_HEIGHT, p.maxZ);
  }

  // ---------- editing primitives ----------
  private applyEdits(edits: Edit[], flagAfter: Cell | null, spawnAfter: Cell | null): void {
    if (edits.length === 0 && flagAfter === this.state.flag && spawnAfter === this.state.spawn) return;
    const action: Action = { edits, flagBefore: this.state.flag, flagAfter, spawnBefore: this.state.spawn, spawnAfter };
    const placed: Cell[] = [];
    for (const ed of edits) {
      this.world.set(ed.x, ed.y, ed.z, ed.after);
      if (ed.after !== 0 && placed.length < 40) placed.push({ x: ed.x, y: ed.y, z: ed.z });
    }
    if (placed.length) {
      for (const c of placed) {
        if (this.pops.length >= 64) break;
        const v = this.world.get(c.x, c.y, c.z);
        this.pops.push({ x: c.x, y: c.y, z: c.z, t: 0, color: new THREE.Color(PALETTE[blockColor(v)] ?? '#ffffff') });
      }
      this.events.emit('placedCells', { cells: placed.slice(0, 12) });
    }
    this.state.flag = flagAfter;
    this.state.spawn = spawnAfter;
    this.undoStack.push(action);
    if (this.undoStack.length > 300) this.undoStack.shift();
    this.redoStack.length = 0;
    this.recount();
    this.dirtyValidate = true;
    this.emitChange();
  }

  undo(): void {
    const a = this.undoStack.pop();
    if (!a) return;
    for (const ed of a.edits) this.world.set(ed.x, ed.y, ed.z, ed.before);
    this.state.flag = a.flagBefore;
    this.state.spawn = a.spawnBefore;
    this.redoStack.push(a);
    this.recount();
    this.dirtyValidate = true;
    this.emitChange();
  }

  redo(): void {
    const a = this.redoStack.pop();
    if (!a) return;
    for (const ed of a.edits) this.world.set(ed.x, ed.y, ed.z, ed.after);
    this.state.flag = a.flagAfter;
    this.state.spawn = a.spawnAfter;
    this.undoStack.push(a);
    this.recount();
    this.dirtyValidate = true;
    this.emitChange();
  }

  /** Collects edits for placing a value at a cell (with mirror), respecting budget/plot bounds. */
  private collect(cells: { x: number; y: number; z: number; value: number }[], edits: Edit[], seen: Set<string>, budgetLeft: { n: number }): void {
    for (const c of cells) {
      const targets = [c];
      if (this.state.mirror) {
        const mx = this.plot.minX + this.plot.maxX - c.x;
        if (mx !== c.x) targets.push({ x: mx, y: c.y, z: c.z, value: c.value });
      }
      for (const t of targets) {
        if (!this.inPlot(t.x, t.y, t.z)) continue;
        const key = `${t.x},${t.y},${t.z}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const before = this.world.get(t.x, t.y, t.z);
        if (before === t.value) continue;
        if (t.value !== 0 && before === 0) {
          if (budgetLeft.n <= 0) continue;
          budgetLeft.n--;
        } else if (t.value === 0 && before !== 0) budgetLeft.n++;
        edits.push({ x: t.x, y: t.y, z: t.z, before, after: t.value });
      }
    }
  }

  private budgetLeft(): number {
    return this.state.budget - this.state.used;
  }

  placeBlock(cell: Cell): void {
    if (this.blockedByMarker(cell)) return;
    const edits: Edit[] = [];
    const bl = { n: this.budgetLeft() };
    this.collect([{ ...cell, value: this.currentValue }], edits, new Set(), bl);
    if (edits.length === 0) {
      if (this.budgetLeft() <= 0) this.events.emit('invalid', { key: 'budgetExceeded' });
      return;
    }
    this.applyEdits(edits, this.state.flag, this.state.spawn);
    this.events.emit('placed', { count: edits.length });
  }

  eraseBlock(cell: Cell): void {
    const edits: Edit[] = [];
    this.collect([{ ...cell, value: 0 }], edits, new Set(), { n: this.budgetLeft() });
    if (edits.length === 0) return;
    this.applyEdits(edits, this.fixMarker(this.state.flag, edits), this.fixMarker(this.state.spawn, edits));
    this.events.emit('erased', { count: edits.length });
  }

  paintBlock(cell: Cell): void {
    const before = this.world.get(cell.x, cell.y, cell.z);
    if (before === 0) return;
    const edits: Edit[] = [];
    this.collect([{ ...cell, value: this.currentValue }], edits, new Set(), { n: 1e9 });
    if (edits.length) {
      this.applyEdits(edits, this.state.flag, this.state.spawn);
      this.events.emit('placed', { count: edits.length });
    }
  }

  fillBox(a: Cell, b: Cell, erase: boolean): void {
    const x0 = Math.min(a.x, b.x);
    const x1 = Math.max(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const y1 = Math.max(a.y, b.y);
    const z0 = Math.min(a.z, b.z);
    const z1 = Math.max(a.z, b.z);
    const cells: { x: number; y: number; z: number; value: number }[] = [];
    const hollow = this.state.hollow && !erase && x1 - x0 >= 2 && z1 - z0 >= 2;
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          if (hollow && x !== x0 && x !== x1 && z !== z0 && z !== z1 && y !== y0 && y !== y1) continue;
          if (!erase && this.blockedByMarker({ x, y, z })) continue;
          cells.push({ x, y, z, value: erase ? 0 : this.currentValue });
        }
    const edits: Edit[] = [];
    this.collect(cells, edits, new Set(), { n: this.budgetLeft() });
    if (edits.length === 0) {
      if (!erase && this.budgetLeft() <= 0) this.events.emit('invalid', { key: 'budgetExceeded' });
      return;
    }
    this.applyEdits(edits, erase ? this.fixMarker(this.state.flag, edits) : this.state.flag, erase ? this.fixMarker(this.state.spawn, edits) : this.state.spawn);
    this.events.emit(erase ? 'erased' : 'placed', { count: edits.length });
  }

  /** Cells of a straight run between two cells (3D DDA). */
  private lineCells(a: Cell, b: Cell): Cell[] {
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), Math.abs(b.z - a.z));
    const out: Cell[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      out.push({ x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t), z: Math.round(a.z + (b.z - a.z) * t) });
    }
    return out;
  }

  /** Cells produced by a two-point tool between its anchor and the cursor. */
  shapeCells(tool: Tool, a: Cell, b: Cell): Cell[] {
    if (tool === 'line') return this.lineCells(a, b);
    if (tool === 'wall') {
      const base = this.lineCells(a, { x: b.x, y: a.y, z: b.z });
      const out: Cell[] = [];
      for (const c of base) for (let y = 0; y < this.state.wallHeight; y++) out.push({ x: c.x, y: a.y + y, z: c.z });
      return out;
    }
    if (tool === 'stairs') {
      // Solid staircase rising one block per step from the anchor towards the cursor.
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const alongX = Math.abs(dx) >= Math.abs(dz);
      const n = Math.max(Math.abs(alongX ? dx : dz), 1);
      const sx = alongX ? Math.sign(dx) || 1 : 0;
      const sz = alongX ? 0 : Math.sign(dz) || 1;
      const width = Math.max(1, Math.min(4, Math.abs(alongX ? dz : dx) + 1));
      const out: Cell[] = [];
      for (let i = 0; i <= n; i++) {
        for (let w = 0; w < width; w++) {
          const wx = alongX ? a.x + sx * i : a.x + (Math.sign(dx) || 1) * w;
          const wz = alongX ? a.z + (Math.sign(dz) || 1) * w : a.z + sz * i;
          for (let y = 0; y <= i; y++) out.push({ x: wx, y: a.y + y, z: wz });
        }
      }
      return out;
    }
    return [];
  }

  /** Applies a two-point shape (line / wall / stairs) with the current block. */
  fillShape(tool: Tool, a: Cell, b: Cell): void {
    const cells = this.shapeCells(tool, a, b)
      .filter((c) => !this.blockedByMarker(c))
      .map((c) => ({ ...c, value: this.currentValue }));
    const edits: Edit[] = [];
    this.collect(cells, edits, new Set(), { n: this.budgetLeft() });
    if (edits.length === 0) {
      if (this.budgetLeft() <= 0) this.events.emit('invalid', { key: 'budgetExceeded' });
      return;
    }
    this.applyEdits(edits, this.state.flag, this.state.spawn);
    this.events.emit('placed', { count: edits.length });
  }

  private blockedByMarker(c: Cell): boolean {
    for (const m of [this.state.flag, this.state.spawn]) {
      if (m && m.x === c.x && m.z === c.z && (c.y === m.y || c.y === m.y + 1)) return true;
    }
    return false;
  }

  /** Markers standing on erased blocks drop to the new floor. */
  private fixMarker(m: Cell | null, edits: Edit[]): Cell | null {
    if (!m) return m;
    for (const ed of edits) {
      if (ed.after === 0 && ed.x === m.x && ed.z === m.z && ed.y === m.y - 1) {
        let y = m.y - 1;
        while (y > PLOT_Y && this.world.get(m.x, y - 1, m.z) === 0) y--;
        return { x: m.x, y, z: m.z };
      }
    }
    return m;
  }

  private prefabBlocks(): PrefabBlock[] {
    return rotateBlocks(PREFABS[this.state.prefab].build(this.state.prefabSize), this.state.rot);
  }

  private roleValue(role: BlockRole): number {
    const s = STYLES[this.state.style];
    // Use the current colour for walls so prefabs follow the palette choice.
    if (role === 'wall') return this.currentValue;
    return s.roles[role];
  }

  stampPrefab(anchor: Cell): void {
    const blocks = this.prefabBlocks();
    const cells = blocks
      .map((b) => ({ x: anchor.x + b.x, y: anchor.y + b.y, z: anchor.z + b.z, value: b.role === 'air' ? 0 : this.roleValue(b.role) }))
      .filter((c) => !this.blockedByMarker(c) || c.value === 0);
    const edits: Edit[] = [];
    const cost = prefabCost(blocks);
    if (cost > this.budgetLeft() + 20) {
      this.events.emit('invalid', { key: 'budgetExceeded' });
      return;
    }
    this.collect(cells, edits, new Set(), { n: this.budgetLeft() });
    if (edits.length === 0) return;
    this.applyEdits(edits, this.fixMarker(this.state.flag, edits), this.fixMarker(this.state.spawn, edits));
    this.events.emit('placed', { count: edits.length });
  }

  placeFlag(cell: Cell): void {
    if (!this.inPlot(cell.x, cell.y, cell.z)) {
      this.events.emit('invalid', { key: 'flagOutside' });
      return;
    }
    if (this.world.get(cell.x, cell.y, cell.z) !== 0 || this.world.get(cell.x, cell.y + 1, cell.z) !== 0) return;
    this.applyEdits([], cell, this.state.spawn);
  }

  placeSpawn(cell: Cell): void {
    if (!this.inPlot(cell.x, cell.y, cell.z)) return;
    if (this.world.get(cell.x, cell.y, cell.z) !== 0 || this.world.get(cell.x, cell.y + 1, cell.z) !== 0) return;
    this.applyEdits([], this.state.flag, cell);
  }

  clearAll(): void {
    const p = this.plot;
    const edits: Edit[] = [];
    for (let x = p.minX; x <= p.maxX; x++)
      for (let y = PLOT_Y; y < PLOT_Y + PLOT_MAX_HEIGHT; y++)
        for (let z = p.minZ; z <= p.maxZ; z++) {
          const v = this.world.get(x, y, z);
          if (v !== 0) edits.push({ x, y, z, before: v, after: 0 });
        }
    this.applyEdits(edits, null, null);
  }

  /** Generates a fortress for the player (records as one undoable action). */
  autoBuild(seed = Date.now(), archetype?: Archetype): void {
    const p = this.plot;
    const before = this.world.copyBox(p.minX, PLOT_Y, p.minZ, p.maxX, PLOT_Y + PLOT_MAX_HEIGHT, p.maxZ);
    const res = generateFortress(this.world, p, this.state.style, new Random(seed >>> 0), archetype);
    const after = this.world.copyBox(p.minX, PLOT_Y, p.minZ, p.maxX, PLOT_Y + PLOT_MAX_HEIGHT, p.maxZ);
    const edits: Edit[] = [];
    const sx = p.maxX - p.minX + 1;
    const sy = PLOT_MAX_HEIGHT + 1;
    const sz = p.maxZ - p.minZ + 1;
    let i = 0;
    for (let x = 0; x < sx; x++)
      for (let y = 0; y < sy; y++)
        for (let z = 0; z < sz; z++, i++) {
          if (before[i] !== after[i]) edits.push({ x: p.minX + x, y: PLOT_Y + y, z: p.minZ + z, before: before[i], after: after[i] });
        }
    // Restore then apply through the undo system.
    for (const ed of edits) this.world.set(ed.x, ed.y, ed.z, ed.before);
    this.applyEdits(edits, res.flag, res.spawn);
  }

  // ---------- validation ----------
  validateNow(): ReachResult {
    this.state.reach = checkReachability(this.world, this.plot, this.state.flag, this.state.spawn);
    this.dirtyValidate = false;
    this.emitChange();
    return this.state.reach;
  }

  // ---------- blueprints ----------
  listBlueprints(): Blueprint[] {
    try {
      const raw = localStorage.getItem(BP_KEY);
      return raw ? (JSON.parse(raw) as Blueprint[]) : [];
    } catch {
      return [];
    }
  }

  saveBlueprint(name: string): void {
    const p = this.plot;
    const data = this.world.copyBox(p.minX, PLOT_Y, p.minZ, p.maxX, PLOT_Y + PLOT_MAX_HEIGHT, p.maxZ);
    const rle: number[] = [];
    let run = 1;
    for (let i = 1; i <= data.length; i++) {
      if (i < data.length && data[i] === data[i - 1] && run < 65535) run++;
      else {
        rle.push(data[i - 1], run);
        run = 1;
      }
    }
    const rel = (c: Cell | null): Cell | null => (c ? { x: c.x - p.minX, y: c.y - PLOT_Y, z: c.z - p.minZ } : null);
    const bp: Blueprint = { name, style: this.state.style, size: [p.maxX - p.minX + 1, PLOT_MAX_HEIGHT + 1, p.maxZ - p.minZ + 1], rle, flag: rel(this.state.flag), spawn: rel(this.state.spawn), savedAt: Date.now() };
    const list = this.listBlueprints().filter((b) => b.name !== name);
    list.unshift(bp);
    try {
      localStorage.setItem(BP_KEY, JSON.stringify(list.slice(0, 24)));
    } catch {
      /* ignore */
    }
    this.emitChange();
  }

  deleteBlueprint(name: string): void {
    const list = this.listBlueprints().filter((b) => b.name !== name);
    try {
      localStorage.setItem(BP_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
    this.emitChange();
  }

  loadBlueprint(name: string): boolean {
    const bp = this.listBlueprints().find((b) => b.name === name);
    if (!bp) return false;
    const p = this.plot;
    const [sx, sy, sz] = bp.size;
    const data = new Uint16Array(sx * sy * sz);
    let i = 0;
    for (let k = 0; k < bp.rle.length; k += 2) {
      const v = bp.rle[k];
      const n = bp.rle[k + 1];
      for (let j = 0; j < n && i < data.length; j++) data[i++] = v;
    }
    const edits: Edit[] = [];
    i = 0;
    for (let x = 0; x < sx; x++)
      for (let y = 0; y < sy; y++)
        for (let z = 0; z < sz; z++, i++) {
          const wx = p.minX + x;
          const wy = PLOT_Y + y;
          const wz = p.minZ + z;
          if (!this.inPlot(wx, wy, wz)) continue;
          const before = this.world.get(wx, wy, wz);
          if (before !== data[i]) edits.push({ x: wx, y: wy, z: wz, before, after: data[i] });
        }
    // Budget check: count solid blocks in blueprint
    let solid = 0;
    for (const v of data) if (v !== 0) solid++;
    if (solid > this.state.budget) {
      this.events.emit('invalid', { key: 'budgetExceeded' });
      return false;
    }
    const abs = (c: Cell | null): Cell | null => (c ? { x: c.x + p.minX, y: c.y + PLOT_Y, z: c.z + p.minZ } : null);
    this.applyEdits(edits, abs(bp.flag), abs(bp.spawn));
    if (bp.style) this.state.style = bp.style;
    return true;
  }

  // ---------- camera + cursor ----------
  private updateCamera(dt: number): void {
    const input = this.input;
    const v = input.virtual;
    const rotating = input.buttonDown(2) || input.buttonDown(1);
    if (rotating) {
      this.orbitYaw -= input.mouseDX * 0.005;
      this.orbitPitch = clamp(this.orbitPitch - input.mouseDY * 0.005, -1.45, -0.05);
    }
    if (input.isTouch && (v.lookDX !== 0 || v.lookDY !== 0)) {
      this.orbitYaw -= v.lookDX * 0.006;
      this.orbitPitch = clamp(this.orbitPitch - v.lookDY * 0.006, -1.45, -0.05);
    }
    if (v.zoom !== 0) this.orbitDist = clamp(this.orbitDist * (1 + v.zoom * 0.6), 8, 110);
    if (v.panX !== 0 || v.panY !== 0) {
      const rightV = new THREE.Vector3(Math.cos(this.orbitYaw), 0, -Math.sin(this.orbitYaw));
      const k = this.orbitDist * 0.0016;
      this.focus.addScaledVector(rightV, -v.panX * k);
      this.focus.y += v.panY * k;
    }
    if (v.heightDir !== 0) this.focus.y += v.heightDir * 14 * dt;
    if (input.wheel !== 0) {
      if (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) this.cycleHotbar(Math.sign(input.wheel));
      else this.orbitDist = clamp(this.orbitDist * (1 + input.wheel * 0.12), 8, 110);
    }
    const speed = (input.isDown('ShiftLeft') ? 40 : 20) * dt;
    const fwd = new THREE.Vector3(-Math.sin(this.orbitYaw), 0, -Math.cos(this.orbitYaw));
    const right = new THREE.Vector3(Math.cos(this.orbitYaw), 0, -Math.sin(this.orbitYaw));
    this.focus.addScaledVector(fwd, input.axisY() * speed).addScaledVector(right, input.axisX() * speed);
    if (input.isDown('KeyE') || input.isDown('Space')) this.focus.y += speed;
    if (input.isDown('KeyQ') || input.isDown('ControlLeft')) this.focus.y -= speed;
    const p = this.plot;
    this.focus.x = clamp(this.focus.x, p.minX - 20, p.maxX + 20);
    this.focus.z = clamp(this.focus.z, p.minZ - 20, p.maxZ + 20);
    this.focus.y = clamp(this.focus.y, PLOT_Y + 1, PLOT_Y + PLOT_MAX_HEIGHT + 10);
    const cp = Math.cos(this.orbitPitch);
    const off = new THREE.Vector3(Math.sin(this.orbitYaw) * cp, -Math.sin(this.orbitPitch), Math.cos(this.orbitYaw) * cp).multiplyScalar(this.orbitDist);
    const target = this.focus.clone().add(off);
    // Keep the camera above the terrain.
    target.y = Math.max(target.y, this.terrain.heightAt(target.x, target.z) + 1.5);
    this.camera.position.x = damp(this.camera.position.x, target.x, 12, dt);
    this.camera.position.y = damp(this.camera.position.y, target.y, 12, dt);
    this.camera.position.z = damp(this.camera.position.z, target.z, 12, dt);
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
  }

  /** Cursor → target cell (for placement) and hit block (for erase/paint). */
  private updateCursor(): void {
    const input = this.input;
    const w = window.innerWidth;
    const h = window.innerHeight;
    let sx = input.cursorX;
    let sy = input.cursorY;
    if (input.isTouch) {
      if (input.virtual.tapped) {
        sx = input.virtual.tapX;
        sy = input.virtual.tapY;
      } else {
        sx = w / 2;
        sy = h / 2;
      }
    }
    const ndc = new THREE.Vector2((sx / w) * 2 - 1, -(sy / h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const o = this.raycaster.ray.origin;
    const d = this.raycaster.ray.direction;
    this.cursorCell = null;
    this.cursorHitBlock = null;
    if (this.state.layerLock) {
      // Fixed height: pick the cell of the locked layer under the cursor.
      const ly = this.state.layerY;
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(ly + 0.5));
      const ph = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(plane, ph)) {
        const cx = Math.floor(ph.x);
        const cz = Math.floor(ph.z);
        this.cursorCell = { x: cx, y: ly, z: cz };
        this.cursorNormal.set(0, 1, 0);
        this.cursorHitBlock = this.world.get(cx, ly, cz) !== 0 ? { x: cx, y: ly, z: cz } : null;
      }
      return;
    }
    const hit = this.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 200);
    // Floor plane fallback
    const planeHit = new THREE.Vector3();
    const planeT = this.raycaster.ray.intersectPlane(this.floorPlane, planeHit) ? planeHit.distanceTo(o) : Infinity;
    if (hit && hit.dist < planeT) {
      this.cursorHitBlock = { x: hit.x, y: hit.y, z: hit.z };
      this.cursorNormal.set(hit.nx, hit.ny, hit.nz);
      this.cursorCell = { x: hit.x + hit.nx, y: hit.y + hit.ny, z: hit.z + hit.nz };
    } else if (planeT < Infinity) {
      const cx = Math.floor(planeHit.x);
      const cz = Math.floor(planeHit.z);
      this.cursorCell = { x: cx, y: PLOT_Y, z: cz };
      this.cursorNormal.set(0, 1, 0);
    }
  }

  update(dt: number): void {
    if (!this.active) return;
    const input = this.input;
    this.updateCamera(dt);
    this.updateCursor();
    const st = this.state;
    // Hotkeys
    if (input.wasPressed('KeyR')) this.rotate();
    if (input.wasPressed('KeyM')) this.toggleMirror();
    if (input.wasPressed('KeyZ') && (input.isDown('ControlLeft') || input.isDown('MetaLeft'))) {
      if (input.isDown('ShiftLeft')) this.redo();
      else this.undo();
    }
    if (input.wasPressed('KeyY') && (input.isDown('ControlLeft') || input.isDown('MetaLeft'))) this.redo();
    for (let i = 1; i <= 9; i++) if (input.wasPressed(`Digit${i}`)) this.selectHotbar(i - 1);
    const toolKeys: [string, Tool][] = [['KeyB', 'block'], ['KeyV', 'box'], ['KeyL', 'line'], ['KeyN', 'wall'], ['KeyK', 'stairs'], ['KeyP', 'prefab'], ['KeyC', 'paint'], ['KeyX', 'erase'], ['KeyF', 'flag'], ['KeyG', 'spawn']];
    for (const [key, tool] of toolKeys) if (input.wasPressed(key)) this.setTool(tool);
    if (input.wasPressed('BracketRight')) this.setPrefabSize(this.state.prefabSize + 1);
    if (input.wasPressed('BracketLeft')) this.setPrefabSize(this.state.prefabSize - 1);
    if (input.wasPressed('KeyT')) this.toggleLayerLock();
    if (input.wasPressed('Escape') && st.boxStart) {
      st.boxStart = null;
      this.emitChange();
    }

    // Ghost visuals
    this.ghost.visible = false;
    this.ghostBox.visible = false;
    this.prefabGhost.visible = false;
    const cell = st.tool === 'erase' || st.tool === 'paint' ? this.cursorHitBlock : this.cursorCell;
    const uiHover = input.cursorY > window.innerHeight - 190 || input.cursorX < 250 && st.tool === 'prefab';
    void uiHover;
    if (cell) {
      const valid = this.inPlot(cell.x, cell.y, cell.z);
      const col = (this.ghost.material as THREE.MeshBasicMaterial).color;
      if (st.tool === 'block' || st.tool === 'erase' || st.tool === 'paint' || st.tool === 'flag' || st.tool === 'spawn' || (TWO_POINT_TOOLS.includes(st.tool) && !st.boxStart)) {
        this.ghost.visible = true;
        this.ghost.position.set(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5);
        col.set(st.tool === 'erase' ? 0xff3355 : !valid ? 0xff3355 : st.tool === 'paint' ? 0xffb300 : st.tool === 'flag' ? 0xffb300 : st.tool === 'spawn' ? 0x39ff14 : PALETTE[st.color]);
      }
      if (st.tool === 'box' && st.boxStart) {
        this.ghostBox.visible = true;
        const a = st.boxStart;
        const min = new THREE.Vector3(Math.min(a.x, cell.x), Math.min(a.y, cell.y), Math.min(a.z, cell.z));
        const max = new THREE.Vector3(Math.max(a.x, cell.x) + 1, Math.max(a.y, cell.y) + 1, Math.max(a.z, cell.z) + 1);
        this.ghostBox.position.copy(min).add(max).multiplyScalar(0.5);
        this.ghostBox.scale.copy(max).sub(min);
      }
      if (st.tool === 'prefab') {
        const blocks = this.prefabBlocks();
        const m = new THREE.Matrix4();
        let n = 0;
        for (const b of blocks) {
          if (b.role === 'air' || n >= 4000) continue;
          m.makeTranslation(cell.x + b.x + 0.5, cell.y + b.y + 0.5, cell.z + b.z + 0.5);
          this.prefabGhost.setMatrixAt(n++, m);
        }
        this.prefabGhost.count = n;
        this.prefabGhost.instanceMatrix.needsUpdate = true;
        this.prefabGhost.visible = n > 0;
        (this.prefabGhost.material as THREE.MeshBasicMaterial).color.set(valid ? 0x00e5ff : 0xff3355);
      }
      if ((st.tool === 'line' || st.tool === 'wall' || st.tool === 'stairs') && st.boxStart) {
        const cells = this.shapeCells(st.tool, st.boxStart, cell);
        const m = new THREE.Matrix4();
        let n = 0;
        for (const c of cells) {
          if (n >= 4000) break;
          m.makeTranslation(c.x + 0.5, c.y + 0.5, c.z + 0.5);
          this.prefabGhost.setMatrixAt(n++, m);
        }
        this.prefabGhost.count = n;
        this.prefabGhost.instanceMatrix.needsUpdate = true;
        this.prefabGhost.visible = n > 0;
        (this.prefabGhost.material as THREE.MeshBasicMaterial).color.set(PALETTE[st.color]);
      }
    }
    // Markers
    if (st.flag) {
      this.flagMarker.group.visible = true;
      this.flagMarker.group.position.set(st.flag.x + 0.5, st.flag.y, st.flag.z + 0.5);
      this.flagMarker.update(dt, this.camera.position);
    } else this.flagMarker.group.visible = false;
    if (st.spawn) {
      this.spawnMarker.visible = true;
      this.spawnMarker.position.set(st.spawn.x + 0.5, st.spawn.y + 0.05, st.spawn.z + 0.5);
    } else this.spawnMarker.visible = false;
    // Placement pops
    if (this.pops.length) {
      const m = new THREE.Matrix4();
      let n = 0;
      for (let i = this.pops.length - 1; i >= 0; i--) {
        const pp = this.pops[i];
        pp.t += dt;
        if (pp.t > 0.22) {
          this.pops.splice(i, 1);
          continue;
        }
        const k = pp.t / 0.22;
        const sc = 1.28 - 0.28 * k;
        m.makeScale(sc, sc, sc).setPosition(pp.x + 0.5, pp.y + 0.5, pp.z + 0.5);
        this.popMesh.setMatrixAt(n, m);
        this.popMesh.setColorAt(n, pp.color);
        n++;
      }
      this.popMesh.count = n;
      this.popMesh.instanceMatrix.needsUpdate = true;
      if (this.popMesh.instanceColor) this.popMesh.instanceColor.needsUpdate = true;
      this.popMesh.visible = n > 0;
    } else this.popMesh.visible = false;
    this.layerGrid.visible = st.layerLock;
    if (st.layerLock) this.layerGrid.position.set(this.plot.cx, st.layerY + 0.02, this.plot.cz);

    // Clicks (ignore when the cursor is over UI: UI elements stop propagation, so we check a flag set by BuildUI)
    if (!this.uiHover) {
      const v = input.virtual;
      const drawTool = st.tool === 'block' || st.tool === 'erase' || st.tool === 'paint';
      const holdPlace = drawTool && (input.buttonDown(0) || v.primaryHeld);
      const holdErase = drawTool && v.secondaryHeld;
      const key = cell ? `${cell.x},${cell.y},${cell.z}` : '';
      if ((input.buttonPressed(0) || v.primary || (input.isTouch && v.tapped && !v.longPress)) && cell) {
        this.primary(cell);
        this.drawKey = key;
      } else if (holdPlace && cell && key !== this.drawKey) {
        // Dragging (or holding ＋ while turning) lays a continuous run of blocks.
        this.primary(cell);
        this.drawKey = key;
      }
      const hitKey = this.cursorHitBlock ? `${this.cursorHitBlock.x},${this.cursorHitBlock.y},${this.cursorHitBlock.z}` : '';
      if (v.secondary && this.cursorHitBlock) {
        this.eraseBlock(this.cursorHitBlock);
        this.drawKey = hitKey;
      } else if (holdErase && this.cursorHitBlock && hitKey !== this.drawKey) {
        this.eraseBlock(this.cursorHitBlock);
        this.drawKey = hitKey;
      }
      if (!holdPlace && !holdErase) this.drawKey = '';
      if (input.buttonPressed(2) && this.cursorHitBlock && st.tool !== 'box' && !input.isDown('ShiftLeft')) {
        // Right click erases (unless used for camera drag: only when not moving)
        this.rightClickCell = { ...this.cursorHitBlock };
        this.rightClickMoved = 0;
      }
      if (input.buttonDown(2)) this.rightClickMoved += Math.abs(input.mouseDX) + Math.abs(input.mouseDY);
      if (input.buttonReleased(2) && this.rightClickCell && this.rightClickMoved < 6) {
        this.eraseBlock(this.rightClickCell);
        this.rightClickCell = null;
      }
    }
    // Debounced validation
    if (this.dirtyValidate) {
      this.validateTimer += dt;
      if (this.validateTimer > 0.25) {
        this.validateTimer = 0;
        this.validateNow();
      }
    }
  }

  uiHover = false;
  private rightClickCell: Cell | null = null;
  private rightClickMoved = 0;

  private primary(cell: Cell): void {
    const st = this.state;
    switch (st.tool) {
      case 'block':
        this.placeBlock(cell);
        break;
      case 'erase':
        this.eraseBlock(cell);
        break;
      case 'paint':
        this.paintBlock(cell);
        break;
      case 'prefab':
        this.stampPrefab(cell);
        break;
      case 'flag':
        this.placeFlag(cell);
        break;
      case 'spawn':
        this.placeSpawn(cell);
        break;
      case 'box':
        if (!st.boxStart) {
          st.boxStart = { ...cell };
          this.emitChange();
        } else {
          this.fillBox(st.boxStart, cell, this.input.isDown('AltLeft'));
          st.boxStart = null;
          this.emitChange();
        }
        break;
      case 'line':
      case 'wall':
      case 'stairs':
        if (!st.boxStart) {
          st.boxStart = { ...cell };
          this.emitChange();
        } else {
          this.fillShape(st.tool, st.boxStart, cell);
          st.boxStart = null;
          this.emitChange();
        }
        break;
    }
  }

  /** Auto-places a flag/spawn if the player forgot, choosing a hidden reachable cell. */
  ensureMarkers(rng: Random): void {
    if (!this.state.flag || !this.state.reach.ok) {
      const p = this.plot;
      const res = generateFortressMarkers(this.world, p, rng);
      this.applyEdits([], res.flag, res.spawn);
      this.validateNow();
    }
  }
}

import { bestHidingCells, reachableFromOutside } from '../world/Reachability';

function generateFortressMarkers(world: VoxelWorld, plot: Plot, rng: Random): { flag: Cell; spawn: Cell } {
  const cands = bestHidingCells(world, plot, 8);
  const flag = cands.length ? rng.pick(cands) : { x: plot.cx, y: PLOT_Y, z: plot.cz };
  const reach = reachableFromOutside(world, plot);
  let spawn: Cell | null = null;
  let best = -Infinity;
  for (const r of reach.values()) {
    if (r.x < plot.minX || r.x > plot.maxX || r.z < plot.minZ || r.z > plot.maxZ) continue;
    const d = Math.abs(r.x - flag.x) + Math.abs(r.z - flag.z);
    if (d < 2 || d > 12) continue;
    const s = r.dist + rng.next();
    if (s > best && checkReachability(world, plot, flag, r).ok) {
      best = s;
      spawn = { x: r.x, y: r.y, z: r.z };
    }
  }
  return { flag, spawn: spawn ?? { ...flag } };
}
