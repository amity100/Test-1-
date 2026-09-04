import * as THREE from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Terrain } from '../world/Terrain';
import type { Input } from '../core/Input';
import { PLOT_Y, PLOT_MAX_HEIGHT, type Plot } from '../world/Layout';
import { Mat, encodeBlock, blockMat, blockColor, PALETTE } from '../world/Voxel';
import { STYLES, type StyleId, type BlockRole } from '../world/Styles';
import { PREFABS, rotateBlocks, prefabCost, type PrefabId, type PrefabBlock } from '../world/Prefabs';
import { checkReachability, type Cell, type ReachResult } from '../world/Reachability';
import { generateFortress } from '../world/FortressGen';
import { Random } from '../core/Random';
import { Emitter } from '../core/Events';
import { clamp, damp } from '../core/MathUtil';

export type Tool = 'block' | 'box' | 'prefab' | 'paint' | 'erase' | 'flag' | 'spawn';

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
  readonly events = new Emitter<{ change: Record<string, never>; placed: { count: number }; erased: { count: number }; invalid: { key: string } }>();
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
  private flagMarker: THREE.Group;
  private spawnMarker: THREE.Mesh;
  private plotFrame: THREE.LineSegments;
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
    };
    this.focus.set(plot.cx, PLOT_Y + 4, plot.cz);
    // Ghost block
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35, depthWrite: false }));
    this.ghost.visible = false;
    this.ghostBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
    this.ghostBox.visible = false;
    this.prefabGhost = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35, depthWrite: false }), 4000);
    this.prefabGhost.count = 0;
    this.prefabGhost.visible = false;
    this.prefabGhost.frustumCulled = false;
    // Flag marker
    this.flagMarker = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    pole.position.y = 1.2;
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.05), new THREE.MeshBasicMaterial({ color: 0xffb300 }));
    cloth.position.set(0.6, 2.0, 0);
    this.flagMarker.add(pole, cloth);
    this.flagMarker.visible = false;
    this.spawnMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 24), new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.8 }));
    this.spawnMarker.visible = false;
    // Plot frame
    const box = new THREE.Box3(new THREE.Vector3(plot.minX, PLOT_Y, plot.minZ), new THREE.Vector3(plot.maxX + 1, PLOT_Y + PLOT_MAX_HEIGHT, plot.maxZ + 1));
    const frameGeo = new THREE.BoxGeometry(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
    this.plotFrame = new THREE.LineSegments(new THREE.EdgesGeometry(frameGeo), new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35 }));
    this.plotFrame.position.copy(box.getCenter(new THREE.Vector3()));
    this.group.add(this.ghost, this.ghostBox, this.prefabGhost, this.flagMarker, this.spawnMarker, this.plotFrame);
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
    this.emitChange();
  }
  setColor(c: number): void {
    this.state.color = c;
    this.emitChange();
  }
  setPrefab(id: PrefabId): void {
    this.state.prefab = id;
    this.state.prefabSize = Math.min(this.state.prefabSize, PREFABS[id].sizes - 1);
    this.state.tool = 'prefab';
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
  setStyle(s: StyleId): void {
    this.state.style = s;
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
    for (const ed of edits) this.world.set(ed.x, ed.y, ed.z, ed.after);
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
  autoBuild(seed = Date.now()): void {
    const p = this.plot;
    const before = this.world.copyBox(p.minX, PLOT_Y, p.minZ, p.maxX, PLOT_Y + PLOT_MAX_HEIGHT, p.maxZ);
    const res = generateFortress(this.world, p, this.state.style, new Random(seed >>> 0));
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
    const rotating = input.buttonDown(2) || input.buttonDown(1);
    if (rotating) {
      this.orbitYaw -= input.mouseDX * 0.005;
      this.orbitPitch = clamp(this.orbitPitch - input.mouseDY * 0.005, -1.45, -0.05);
    }
    if (!input.isDown('ShiftLeft') && input.wheel !== 0 && this.state.tool !== 'prefab') this.orbitDist = clamp(this.orbitDist * (1 + input.wheel * 0.12), 8, 110);
    if (input.wheel !== 0 && this.state.tool === 'prefab' && !input.isDown('ShiftLeft')) this.setPrefabSize(this.state.prefabSize - Math.sign(input.wheel));
    if (input.wheel !== 0 && input.isDown('ShiftLeft')) this.orbitDist = clamp(this.orbitDist * (1 + input.wheel * 0.12), 8, 110);
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
    const ndc = new THREE.Vector2((input.cursorX / w) * 2 - 1, -(input.cursorY / h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const o = this.raycaster.ray.origin;
    const d = this.raycaster.ray.direction;
    const hit = this.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 200);
    this.cursorCell = null;
    this.cursorHitBlock = null;
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
    if (input.wasPressed('Digit1')) this.setTool('block');
    if (input.wasPressed('Digit2')) this.setTool('box');
    if (input.wasPressed('Digit3')) this.setTool('prefab');
    if (input.wasPressed('Digit4')) this.setTool('paint');
    if (input.wasPressed('Digit5')) this.setTool('erase');
    if (input.wasPressed('Digit6')) this.setTool('flag');
    if (input.wasPressed('Digit7')) this.setTool('spawn');
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
      if (st.tool === 'block' || st.tool === 'erase' || st.tool === 'paint' || st.tool === 'flag' || st.tool === 'spawn' || (st.tool === 'box' && !st.boxStart)) {
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
    }
    // Markers
    if (st.flag) {
      this.flagMarker.visible = true;
      this.flagMarker.position.set(st.flag.x + 0.5, st.flag.y, st.flag.z + 0.5);
    } else this.flagMarker.visible = false;
    if (st.spawn) {
      this.spawnMarker.visible = true;
      this.spawnMarker.position.set(st.spawn.x + 0.5, st.spawn.y + 0.05, st.spawn.z + 0.5);
    } else this.spawnMarker.visible = false;

    // Clicks (ignore when the cursor is over UI: UI elements stop propagation, so we check a flag set by BuildUI)
    if (!this.uiHover) {
      if (input.buttonPressed(0) && cell) this.primary(cell);
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
