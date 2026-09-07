import * as THREE from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Terrain } from '../world/Terrain';
import type { Input } from '../core/Input';
import type { Plot } from '../world/Layout';
import { PLOT_Y, PLOT_MAX_HEIGHT } from '../world/Layout';
import type { StyleId } from '../world/Styles';
import { PALETTE, blockColor } from '../world/Voxel';
import { checkReachability, bestHidingCells, reachableFromOutside, type Cell, type ReachResult } from '../world/Reachability';
import { Architect, Plan, CELL, STOREY_H, GRID, MAX_STOREYS, MAX_BLOCKS, SIDES, applyField, floatingComponents, type ArchitectResult, type Tone, heroOrder } from './Architect';
import { planFortress, type Archetype } from '../world/FortressGen';
import { FlagMesh } from '../render/FlagMesh';
import { Random } from '../core/Random';
import { Emitter } from '../core/Events';
import type { TrapKind, TrapSystem } from '../sim/Traps';
import { clamp, damp } from '../core/MathUtil';

export type BuilderTool = 'build' | 'erase' | 'flag' | 'trap';

export interface BuilderEvents extends Record<string, unknown> {
  change: Record<string, never>;
  placed: { i: number; j: number; k: number };
  removed: { i: number; j: number; k: number };
  invalid: { key: string };
  /** Cells that turned solid this edit (for dust puffs). */
  placedCells: { cells: Cell[] };
  trapPlaced: { kind: TrapKind };
  trapRemoved: { kind: TrapKind };
}

interface Snapshot {
  cells: Uint8Array;
  flag: Cell | null;
  spawn: Cell | null;
  hero?: number;
}

/** A cell face the pointer is aiming at, resolved to what a tap would do. */
export interface Aim {
  /** Cell that would receive a new block (null when nothing can be built there). */
  add: [number, number, number] | null;
  /** Existing block under the pointer (null on empty ground). */
  hit: [number, number, number] | null;
}

const TAP_PX = 12;
const LONG_PRESS_MS = 480;

/**
 * Tap-to-grow fortress editor: tap a spot to grow a room block there, tap a block's face to add
 * a neighbour, long press (or right click) to remove, pick a tone from the palette. The Architect
 * turns the coarse plan into finished architecture after every edit. One finger orbits, two fingers
 * pan and zoom; the mouse drags to orbit, wheel zooms and middle-drag pans.
 */
export class Builder {
  readonly events = new Emitter<BuilderEvents>();
  readonly plan = new Plan();
  readonly architect: Architect;
  tone: Tone = 0;
  tool: BuilderTool = 'build';
  /** Defender traps (set by the game); the kind the trap tool places. */
  traps: TrapSystem | null = null;
  trapKind: TrapKind = 'spikes';
  flag: Cell | null = null;
  spawn: Cell | null = null;
  reach: ReachResult = { ok: false, reason: 'noFlag' };
  result: ArchitectResult | null = null;
  /** Latest plot camera focus, orbit angles and distance. */
  private focus = new THREE.Vector3();
  private orbitYaw = 0.75;
  private orbitPitch = -0.62;
  private orbitDist = 62;
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private group = new THREE.Group();
  private ghost: THREE.Mesh;
  private ghostEdges: THREE.LineSegments;
  private flagMarker: FlagMesh;
  private spawnMarker: THREE.Mesh;
  private plotFrame: THREE.LineSegments;
  private gridHelper: THREE.GridHelper;
  private popMesh: THREE.InstancedMesh;
  private pops: { x: number; y: number; z: number; t: number; color: THREE.Color }[] = [];
  private raycaster = new THREE.Raycaster();
  private active = false;
  private dirtyValidate = true;
  private validateTimer = 0;
  private press: { x: number; y: number; moved: number; button: number; at: number } | null = null;
  private lastAim: Aim = { add: null, hit: null };
  private lastCursor = { x: 0, y: 0 };
  /** Set while a UI element is under the mouse so clicks there never build. */
  uiHover = false;
  debugLast = '';

  constructor(
    private world: VoxelWorld,
    private terrain: Terrain,
    readonly plot: Plot,
    readonly style: StyleId,
    private input: Input,
    private camera: THREE.PerspectiveCamera,
    private scene: THREE.Scene,
  ) {
    this.architect = new Architect(plot, style);
    this.focus.set(plot.cx + 0.5, PLOT_Y + 6, plot.cz + 0.5);
    const ghostGeo = new THREE.BoxGeometry(CELL - 0.1, STOREY_H - 0.1, CELL - 0.1);
    this.ghost = new THREE.Mesh(ghostGeo, new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.22, depthWrite: false }));
    this.ghostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(ghostGeo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
    this.ghost.add(this.ghostEdges);
    this.ghost.visible = false;
    this.flagMarker = new FlagMesh(new THREE.Color(0x00e5ff));
    this.flagMarker.group.visible = false;
    this.spawnMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 24), new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.8 }));
    this.spawnMarker.visible = false;
    const box = new THREE.Box3(new THREE.Vector3(plot.minX, PLOT_Y, plot.minZ), new THREE.Vector3(plot.maxX + 1, PLOT_Y + 2, plot.maxZ + 1));
    const frameGeo = new THREE.BoxGeometry(box.max.x - box.min.x, 0.05, box.max.z - box.min.z);
    this.plotFrame = new THREE.LineSegments(new THREE.EdgesGeometry(frameGeo), new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.5 }));
    this.plotFrame.position.set(plot.cx + 0.5, PLOT_Y + 0.04, plot.cz + 0.5);
    this.gridHelper = new THREE.GridHelper(GRID * CELL, GRID, 0x00e5ff, 0x00e5ff);
    const gm = this.gridHelper.material as THREE.LineBasicMaterial;
    gm.transparent = true;
    gm.opacity = 0.22;
    gm.depthWrite = false;
    this.gridHelper.position.set(plot.cx + 0.5, PLOT_Y + 0.03, plot.cz + 0.5);
    this.popMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false }), 96);
    this.popMesh.count = 0;
    this.popMesh.frustumCulled = false;
    this.group.add(this.ghost, this.flagMarker.group, this.spawnMarker, this.plotFrame, this.gridHelper, this.popMesh);
    this.group.visible = false;
    scene.add(this.group);
  }

  /** Editor overlays (ghost, markers, grid) so they can be hidden for screenshots. */
  get visuals(): THREE.Group {
    return this.group;
  }

  get blocks(): number {
    return this.plan.count();
  }

  get budget(): number {
    return MAX_BLOCKS;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Tone swatch colours for the palette UI. */
  swatches(): string[] {
    const out: string[] = [];
    for (let t = 0; t < 8; t++) out.push(this.architect.swatchHex(t as Tone, PALETTE));
    return out;
  }

  enter(): void {
    this.active = true;
    this.group.visible = true;
    this.input.exitPointerLock();
    this.frame();
    this.updateCamera(1);
    this.updateCamera(1);
    this.dirtyValidate = true;
  }

  exit(): void {
    this.active = false;
    this.group.visible = false;
    this.press = null;
  }

  dispose(): void {
    this.exit();
    this.scene.remove(this.group);
    this.flagMarker.dispose();
  }

  /** Recentres the camera on the plot at a distance that shows the whole structure. */
  frame(): void {
    const h = this.plan.height();
    this.focus.set(this.plot.cx + 0.5, PLOT_Y + 3 + h * STOREY_H * 0.45, this.plot.cz + 0.5);
    this.orbitDist = clamp(56 + h * 5, 40, 110);
  }

  setTool(t: BuilderTool): void {
    if (this.tool === t) return;
    this.tool = t;
    this.press = null;
    this.events.emit('change', {});
  }

  setTone(t: Tone): void {
    this.tone = t;
    this.events.emit('change', {});
  }

  setTrapKind(k: TrapKind): void {
    this.trapKind = k;
    if (this.tool !== 'trap') this.setTool('trap');
    this.events.emit('change', {});
  }

  /** Trap slots used on this plot. */
  get trapSlots(): number {
    return this.traps ? this.traps.slotsUsed(this.plot.index) : 0;
  }

  // ------------------------------------------------------------------ editing
  private snapshot(): Snapshot {
    return { cells: new Uint8Array(this.plan.cells), flag: this.flag, spawn: this.spawn, hero: this.plan.hero };
  }

  private restore(s: Snapshot): void {
    this.plan.cells.set(s.cells);
    this.plan.hero = s.hero ?? -1;
    this.flag = s.flag;
    this.spawn = s.spawn;
    this.regenerate();
  }

  private commit(before: Snapshot): void {
    this.undoStack.push(before);
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo(): void {
    const s = this.undoStack.pop();
    if (!s) return;
    this.redoStack.push(this.snapshot());
    this.restore(s);
    this.debugLast = 'undo';
  }

  redo(): void {
    const s = this.redoStack.pop();
    if (!s) return;
    this.undoStack.push(this.snapshot());
    this.restore(s);
    this.debugLast = 'redo';
  }

  /** Adds a block at a plan cell with the current tone. */
  addBlock(i: number, j: number, k: number, tone: Tone = this.tone): boolean {
    if (!Plan.inside(i, j, k) || this.plan.has(i, j, k)) return false;
    if (this.plan.count() >= MAX_BLOCKS) {
      this.events.emit('invalid', { key: 'budgetFull' });
      return false;
    }
    const before = this.snapshot();
    this.plan.set(i, j, k, tone);
    this.commit(before);
    this.regenerate();
    this.events.emit('placed', { i, j, k });
    this.debugLast = `add:${i},${j},${k}:${tone}`;
    return true;
  }

  removeBlock(i: number, j: number, k: number): boolean {
    if (!this.plan.has(i, j, k)) return false;
    // Rooms above must keep something to stand on (a hanging room could never get stairs).
    const trial = this.plan.clone();
    trial.set(i, j, k, null);
    if (floatingComponents(trial).length > 0) {
      this.events.emit('invalid', { key: 'unsupported' });
      this.debugLast = `unsupported:${i},${j},${k}`;
      return false;
    }
    const before = this.snapshot();
    this.plan.set(i, j, k, null);
    this.commit(before);
    this.regenerate();
    this.events.emit('removed', { i, j, k });
    this.debugLast = `remove:${i},${j},${k}`;
    return true;
  }

  /** Repaints a block with the current tone (tap with the build tool on an existing block's own cell). */
  paintBlock(i: number, j: number, k: number, tone: Tone = this.tone): boolean {
    if (!this.plan.has(i, j, k) || this.plan.tone(i, j, k) === tone) return false;
    const before = this.snapshot();
    this.plan.set(i, j, k, tone);
    this.commit(before);
    this.regenerate();
    this.debugLast = `paint:${i},${j},${k}:${tone}`;
    return true;
  }

  clearAll(): void {
    if (this.plan.count() === 0 && !this.flag) return;
    const before = this.snapshot();
    this.plan.cells.fill(0);
    this.plan.hero = -1;
    this.flag = null;
    this.spawn = null;
    this.commit(before);
    this.regenerate();
  }

  /** Replaces the plan with a generated fortress (a starting point the player can edit). */
  autoBuild(seed = Date.now(), archetype?: Archetype): void {
    const before = this.snapshot();
    const rng = new Random(seed);
    const plan = planFortress(rng, this.style, MAX_BLOCKS, archetype);
    this.plan.cells.set(plan.cells);
    this.plan.hero = -1;
    this.flag = null;
    this.spawn = null;
    this.commit(before);
    this.regenerate();
    this.ensureMarkers(rng);
    this.debugLast = `auto:${this.plan.count()}`;
  }

  /** Places the flag inside a room block; the spawn follows when unset. */
  placeFlagIn(i: number, j: number, k: number): boolean {
    let room = this.result?.rooms.find((r) => r.i === i && r.j === j && r.k === k);
    if (!room || room.floor.length === 0) {
      this.events.emit('invalid', { key: 'flagBlocked' });
      return false;
    }
    const before = this.snapshot();
    // The flag room becomes the hero hall: podium in the middle, gallery ring above when covered.
    const idx = Plan.index(i, j, k);
    if (this.plan.hero !== idx) {
      this.plan.hero = idx;
      this.regenerate();
      room = this.result?.rooms.find((r) => r.i === i && r.j === j && r.k === k) ?? room;
    }
    const spot = this.result?.hero?.spot ?? null;
    let best: Cell;
    if (spot && this.freeCell(spot)) best = spot;
    else {
      const cx = this.plot.minX + i * CELL + 2;
      const cz = this.plot.minZ + j * CELL + 2;
      best = room.floor[0];
      let bestD = Infinity;
      for (const c of room.floor) {
        const d = Math.abs(c.x - cx) + Math.abs(c.z - cz);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
    }
    this.flag = { ...best };
    if (!this.spawn || !this.freeCell(this.spawn)) this.spawn = { ...best };
    this.commit(before);
    this.dirtyValidate = true;
    this.events.emit('change', {});
    this.debugLast = `flag:${i},${j},${k}`;
    return true;
  }

  private freeCell(c: Cell): boolean {
    return this.world.get(c.x, c.y, c.z) === 0 && this.world.get(c.x, c.y + 1, c.z) === 0 && this.world.get(c.x, c.y - 1, c.z) !== 0;
  }

  /** Regenerates the architecture for the current plan and writes the difference into the world. */
  private regenerate(): void {
    const res = this.architect.generate(this.plan);
    const changed = applyField(this.world, this.plot, res.field);
    this.result = res;
    this.traps?.validate(this.plot.index);
    // Markers survive only while their cell is still free floor.
    if (this.flag && !this.freeCell(this.flag)) this.flag = null;
    if (this.spawn && !this.freeCell(this.spawn)) this.spawn = null;
    if (!this.flag) this.spawn = null;
    const solid: Cell[] = [];
    for (const c of changed) {
      const v = this.world.get(c.x, c.y, c.z);
      if (v !== 0) solid.push(c);
    }
    // Pop a spread sample so a whole room appearing still reads as a burst.
    const step = Math.max(1, Math.floor(solid.length / 48));
    for (let n = 0; n < solid.length && this.pops.length < 96; n += step) {
      const c = solid[n];
      this.pops.push({ x: c.x, y: c.y, z: c.z, t: 0, color: new THREE.Color(PALETTE[blockColor(this.world.get(c.x, c.y, c.z))] ?? '#ffffff') });
    }
    if (solid.length) this.events.emit('placedCells', { cells: solid.filter((_, n) => n % Math.max(1, Math.floor(solid.length / 10)) === 0).slice(0, 12) });
    this.dirtyValidate = true;
    this.events.emit('change', {});
  }

  validateNow(): ReachResult {
    this.reach = checkReachability(this.world, this.plot, this.flag, this.spawn);
    this.dirtyValidate = false;
    return this.reach;
  }

  /** Picks a hidden flag and a nearby spawn when the player left them out or unreachable. */
  ensureMarkers(rng: Random): void {
    this.validateNow();
    if (this.flag && this.reach.ok) return;
    // Prefer the deepest generated room (made the hero hall, flag on its podium); fall back to the
    // reachability heuristic.
    const rooms = heroOrder(this.plan, (this.result?.rooms ?? []).filter((r) => r.floor.length > 0));
    for (const r of rooms.slice(0, 6)) {
      this.plan.hero = Plan.index(r.i, r.j, r.k);
      this.regenerate();
      const room = this.result?.rooms.find((rr) => rr.i === r.i && rr.j === r.j && rr.k === r.k);
      const spot = this.result?.hero?.spot ?? null;
      const c = spot && this.freeCell(spot) ? spot : room && room.floor.length ? room.floor[Math.floor(room.floor.length / 2)] : null;
      if (!c) continue;
      this.flag = { ...c };
      this.spawn = { ...c };
      if (this.validateNow().ok) return;
    }
    this.plan.hero = -1;
    this.regenerate();
    const cands = bestHidingCells(this.world, this.plot, 8);
    const flag = cands.length ? rng.pick(cands) : { x: this.plot.cx, y: PLOT_Y, z: this.plot.cz };
    this.flag = flag;
    const reach = reachableFromOutside(this.world, this.plot);
    let spawn: Cell | null = null;
    let best = -Infinity;
    for (const r of reach.values()) {
      if (r.x < this.plot.minX || r.x > this.plot.maxX || r.z < this.plot.minZ || r.z > this.plot.maxZ) continue;
      const d = Math.abs(r.x - flag.x) + Math.abs(r.z - flag.z);
      if (d < 2 || d > 12) continue;
      const s = r.dist + rng.next();
      if (s > best) {
        best = s;
        spawn = { x: r.x, y: r.y, z: r.z };
      }
    }
    this.spawn = spawn ?? { ...flag };
    this.validateNow();
    this.events.emit('change', {});
  }

  // ------------------------------------------------------------------ picking
  /** Resolves what a tap at a screen position would do. */
  aim(sx: number, sy: number): Aim {
    const ndc = new THREE.Vector2((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const ray = this.raycaster.ray;
    const hit = this.world.raycast(ray.origin.x, ray.origin.y, ray.origin.z, ray.direction.x, ray.direction.y, ray.direction.z, 260);
    const p = this.plot;
    const cellOf = (x: number, z: number): [number, number] => [Math.floor((x - p.minX) / CELL), Math.floor((z - p.minZ) / CELL)];
    if (!hit) {
      // Empty ground: intersect the plot floor plane.
      const t = (PLOT_Y - ray.origin.y) / ray.direction.y;
      if (!(t > 0)) return { add: null, hit: null };
      const gx = ray.origin.x + ray.direction.x * t;
      const gz = ray.origin.z + ray.direction.z * t;
      const [i, j] = cellOf(gx, gz);
      if (i < 0 || i >= GRID || j < 0 || j >= GRID) return { add: null, hit: null };
      return { add: this.plan.has(i, j, 0) ? null : [i, j, 0], hit: null };
    }
    const [i, j] = cellOf(hit.x + 0.5, hit.z + 0.5);
    if (i < 0 || i >= GRID || j < 0 || j >= GRID) return { add: null, hit: null };
    if (hit.y < PLOT_Y) {
      // Ground block inside the plot.
      return { add: this.plan.has(i, j, 0) ? null : [i, j, 0], hit: null };
    }
    const kRaw = Math.floor((hit.y - PLOT_Y) / STOREY_H);
    let owner: [number, number, number] | null = null;
    if (this.plan.has(i, j, kRaw)) owner = [i, j, kRaw];
    else if (kRaw > 0 && this.plan.has(i, j, kRaw - 1)) owner = [i, j, kRaw - 1]; // roof, parapet, spire
    if (!owner) {
      // Loose geometry in an empty cell (balcony, arcade pillar, doorstep): build right here.
      const k = Math.min(kRaw, MAX_STOREYS - 1);
      return { add: this.plan.has(i, j, k) ? null : [i, j, k], hit: null };
    }
    let target: [number, number, number] | null = null;
    if (hit.ny > 0.5) target = [owner[0], owner[1], owner[2] + 1];
    else if (hit.ny < -0.5) target = [owner[0], owner[1], owner[2] - 1];
    else {
      const s = hit.nx > 0.5 ? 1 : hit.nx < -0.5 ? 3 : hit.nz > 0.5 ? 2 : 0;
      target = [owner[0] + SIDES[s][0], owner[1] + SIDES[s][1], owner[2]];
    }
    if (!Plan.inside(target[0], target[1], target[2]) || this.plan.has(target[0], target[1], target[2])) target = null;
    return { add: target, hit: owner };
  }

  /** Performs the current tool at a screen position. */
  tapAt(sx: number, sy: number): boolean {
    const a = this.aim(sx, sy);
    this.lastAim = a;
    switch (this.tool) {
      case 'build':
        if (a.add) return this.addBlock(a.add[0], a.add[1], a.add[2]);
        if (a.hit) return this.paintBlock(a.hit[0], a.hit[1], a.hit[2]);
        return false;
      case 'erase':
        if (a.hit) return this.removeBlock(a.hit[0], a.hit[1], a.hit[2]);
        return false;
      case 'flag':
        if (a.hit) return this.placeFlagIn(a.hit[0], a.hit[1], a.hit[2]);
        this.events.emit('invalid', { key: 'flagNeedsRoom' });
        return false;
      case 'trap': {
        const cell = this.pickFloor(sx, sy);
        if (!cell || !this.traps) {
          this.events.emit('invalid', { key: 'trapNeedsFloor' });
          return false;
        }
        const existing = this.traps.at(cell);
        if (existing) {
          this.traps.remove(existing);
          this.events.emit('trapRemoved', { kind: existing.kind });
          this.events.emit('change', {});
          return true;
        }
        if (this.flag && cell.x === this.flag.x && cell.z === this.flag.z && cell.y === this.flag.y) {
          this.events.emit('invalid', { key: 'trapTaken' });
          return false;
        }
        const r = this.traps.place(this.trapKind, cell, this.plot.index);
        if (typeof r === 'string') {
          this.events.emit('invalid', { key: r });
          return false;
        }
        this.events.emit('trapPlaced', { kind: r.kind });
        this.events.emit('change', {});
        this.debugLast = `trap:${r.kind}`;
        return true;
      }
    }
  }

  /** The free floor cell under the cursor (a room floor inside the plot): where traps go. */
  pickFloor(sx: number, sy: number): Cell | null {
    const ndc = new THREE.Vector2((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const ray = this.raycaster.ray;
    const hit = this.world.raycast(ray.origin.x, ray.origin.y, ray.origin.z, ray.direction.x, ray.direction.y, ray.direction.z, 260);
    if (!hit || hit.ny < 0.5) return null;
    const c: Cell = { x: hit.x, y: hit.y + 1, z: hit.z };
    if (c.x < this.plot.minX || c.x > this.plot.maxX || c.z < this.plot.minZ || c.z > this.plot.maxZ || c.y <= PLOT_Y) return null;
    if (this.world.get(c.x, c.y, c.z) !== 0 || this.world.get(c.x, c.y + 1, c.z) !== 0) return null;
    return c;
  }

  longPressAt(sx: number, sy: number): boolean {
    const a = this.aim(sx, sy);
    if (a.hit) return this.removeBlock(a.hit[0], a.hit[1], a.hit[2]);
    return false;
  }

  // ------------------------------------------------------------------ frame
  update(dt: number): void {
    if (!this.active) return;
    this.handleInput(dt);
    this.updateCamera(dt);
    this.updateOverlays(dt);
  }

  private handleInput(dt: number): void {
    const input = this.input;
    const v = input.virtual;
    // Camera: two fingers / wheel / drags.
    if (v.zoom !== 0) this.orbitDist = clamp(this.orbitDist * (1 + v.zoom * 0.6), 18, 120);
    if (input.wheel !== 0) this.orbitDist = clamp(this.orbitDist * (1 + input.wheel * 0.12), 18, 120);
    if (v.panX !== 0 || v.panY !== 0) this.panBy(v.panX, v.panY);
    if (input.isTouch) {
      if (v.lookDX !== 0 || v.lookDY !== 0) {
        this.orbitYaw -= v.lookDX * 0.006;
        this.orbitPitch = clamp(this.orbitPitch - v.lookDY * 0.006, -1.4, -0.12);
      }
      if (v.tapped && !this.uiHover) {
        if (v.longPress) this.longPressAt(v.tapX, v.tapY);
        else this.tapAt(v.tapX, v.tapY);
      }
      return;
    }
    // Mouse: press, then either a short click (act) or a drag (orbit / pan).
    const cx = input.cursorX;
    const cy = input.cursorY;
    const dx = cx - this.lastCursor.x;
    const dy = cy - this.lastCursor.y;
    this.lastCursor = { x: cx, y: cy };
    for (const b of [0, 1, 2]) {
      if (input.buttonPressed(b) && !this.uiHover && !this.press) {
        const at = input.buttonDownAt(b);
        this.press = { x: at.x, y: at.y, moved: 0, button: b, at: performance.now() };
      }
    }
    if (this.press) {
      this.press.moved += Math.abs(dx) + Math.abs(dy);
      if (input.buttonDown(this.press.button) && this.press.moved >= TAP_PX) {
        if (this.press.button === 1) this.panBy(dx, dy);
        else {
          this.orbitYaw -= dx * 0.005;
          this.orbitPitch = clamp(this.orbitPitch - dy * 0.005, -1.4, -0.12);
        }
      }
      if (input.buttonReleased(this.press.button)) {
        const p = this.press;
        this.press = null;
        // Tap or drag is decided from where the button went down and came up (hardware events), so a
        // slow frame between the two can never turn a click into an orbit.
        const up = input.buttonUpAt(p.button);
        const travel = Math.hypot(up.x - p.x, up.y - p.y);
        if (travel < TAP_PX) {
          const held = input.buttonHeldMs(p.button);
          if (p.button === 2 || held >= LONG_PRESS_MS) this.longPressAt(up.x, up.y);
          else if (p.button === 0) this.tapAt(up.x, up.y);
        }
      }
    }
    // Keyboard camera.
    const speed = 26 * dt;
    const ax = input.axisX();
    const ay = input.axisY();
    if (ax !== 0 || ay !== 0) {
      const right = new THREE.Vector3(Math.cos(this.orbitYaw), 0, -Math.sin(this.orbitYaw));
      const fwd = new THREE.Vector3(-Math.sin(this.orbitYaw), 0, -Math.cos(this.orbitYaw));
      this.focus.addScaledVector(right, ax * speed).addScaledVector(fwd, ay * speed);
    }
    if (input.wasPressed('KeyQ')) this.orbitYaw += Math.PI / 4;
    if (input.wasPressed('KeyE')) this.orbitYaw -= Math.PI / 4;
    if (input.wasPressed('KeyF')) this.frame();
    if (input.wasPressed('KeyZ')) {
      if (input.modsOf('KeyZ')?.shift) this.redo();
      else this.undo();
    }
    if (input.wasPressed('KeyY')) this.redo();
    for (let t = 1; t <= 8; t++) if (input.wasPressed(`Digit${t}`)) this.setTone((t - 1) as Tone);
    if (input.wasPressed('KeyX')) this.setTool(this.tool === 'erase' ? 'build' : 'erase');
    if (input.wasPressed('KeyG')) this.setTool(this.tool === 'flag' ? 'build' : 'flag');
    if (input.wasPressed('KeyT')) this.setTool(this.tool === 'trap' ? 'build' : 'trap');
  }

  private panBy(dx: number, dy: number): void {
    const k = this.orbitDist * 0.0016;
    const right = new THREE.Vector3(Math.cos(this.orbitYaw), 0, -Math.sin(this.orbitYaw));
    const fwd = new THREE.Vector3(-Math.sin(this.orbitYaw), 0, -Math.cos(this.orbitYaw));
    this.focus.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k);
  }

  private updateCamera(dt: number): void {
    const p = this.plot;
    this.focus.x = clamp(this.focus.x, p.minX - 6, p.maxX + 7);
    this.focus.z = clamp(this.focus.z, p.minZ - 6, p.maxZ + 7);
    this.focus.y = clamp(this.focus.y, PLOT_Y + 2, PLOT_Y + PLOT_MAX_HEIGHT);
    const cp = Math.cos(this.orbitPitch);
    const off = new THREE.Vector3(Math.sin(this.orbitYaw) * cp, -Math.sin(this.orbitPitch), Math.cos(this.orbitYaw) * cp).multiplyScalar(this.orbitDist);
    const target = this.focus.clone().add(off);
    target.y = Math.max(target.y, this.terrain.heightAt(target.x, target.z) + 2);
    this.camera.position.x = damp(this.camera.position.x, target.x, 12, dt);
    this.camera.position.y = damp(this.camera.position.y, target.y, 12, dt);
    this.camera.position.z = damp(this.camera.position.z, target.z, 12, dt);
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
  }

  private updateOverlays(dt: number): void {
    // Hover ghost (mouse only; touch acts on tap).
    this.ghost.visible = false;
    if (!this.input.isTouch && !this.uiHover && this.tool === 'trap') {
      // Trap tool: a thin pad on the floor cell under the cursor, green when it can go there.
      const c = this.pickFloor(this.input.cursorX, this.input.cursorY);
      if (c && this.traps) {
        const w = this.trapKind === 'trapdoor' ? 2 : 1;
        const ok = this.traps.at(c) !== null || this.traps.canPlace(this.trapKind, c, this.plot.index) === null;
        this.ghost.visible = true;
        this.ghost.scale.set(w / (CELL - 0.1), 0.24 / (STOREY_H - 0.1), w / (CELL - 0.1));
        this.ghost.position.set(c.x + w / 2, c.y + 0.12, c.z + w / 2);
        (this.ghost.material as THREE.MeshBasicMaterial).color.setHex(ok ? 0x39ff14 : 0xff4655);
        (this.ghostEdges.material as THREE.LineBasicMaterial).color.setHex(ok ? 0x39ff14 : 0xff4655);
      }
    } else if (!this.input.isTouch && !this.uiHover) {
      this.ghost.scale.set(1, 1, 1);
      const a = this.aim(this.input.cursorX, this.input.cursorY);
      const mat = this.ghost.material as THREE.MeshBasicMaterial;
      const target = this.tool === 'build' ? a.add : a.hit;
      if (target) {
        this.ghost.visible = true;
        this.ghost.position.set(this.plot.minX + target[0] * CELL + CELL / 2, PLOT_Y + target[2] * STOREY_H + STOREY_H / 2, this.plot.minZ + target[1] * CELL + CELL / 2);
        const hex = this.tool === 'erase' ? 0xff4655 : this.tool === 'flag' ? 0xffb300 : 0x00e5ff;
        mat.color.setHex(hex);
        (this.ghostEdges.material as THREE.LineBasicMaterial).color.setHex(this.tool === 'build' ? 0xffffff : hex);
      }
    }
    // Markers.
    if (this.flag) {
      this.flagMarker.group.visible = true;
      this.flagMarker.group.position.set(this.flag.x + 0.5, this.flag.y, this.flag.z + 0.5);
      this.flagMarker.update(dt, this.camera.position);
    } else this.flagMarker.group.visible = false;
    if (this.spawn && (this.spawn.x !== this.flag?.x || this.spawn.z !== this.flag?.z)) {
      this.spawnMarker.visible = true;
      this.spawnMarker.position.set(this.spawn.x + 0.5, this.spawn.y + 0.05, this.spawn.z + 0.5);
    } else this.spawnMarker.visible = false;
    // Pops.
    if (this.pops.length) {
      const m = new THREE.Matrix4();
      let n = 0;
      for (let i = this.pops.length - 1; i >= 0; i--) {
        const pp = this.pops[i];
        pp.t += dt;
        if (pp.t > 0.26) {
          this.pops.splice(i, 1);
          continue;
        }
        const k = pp.t / 0.26;
        const sc = 1.3 - 0.3 * k;
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
    // Debounced validation.
    if (this.dirtyValidate) {
      this.validateTimer += dt;
      if (this.validateTimer > 0.25) {
        this.validateTimer = 0;
        this.validateNow();
        this.events.emit('change', {});
      }
    }
  }

  // ------------------------------------------------------------------ debug
  debugState(): Record<string, unknown> {
    return {
      blocks: this.plan.count(),
      height: this.plan.height(),
      tone: this.tone,
      tool: this.tool,
      flag: this.flag,
      spawn: this.spawn,
      traps: this.traps ? this.traps.traps.filter((tr) => tr.plotIndex === this.plot.index).map((tr) => tr.kind) : [],
      reach: this.reach,
      voxels: this.result?.blocks ?? 0,
      rooms: this.result?.rooms.length ?? 0,
      entrances: this.result?.entrances.length ?? 0,
      last: this.debugLast,
      yaw: +this.orbitYaw.toFixed(2),
      pitch: +this.orbitPitch.toFixed(2),
      dist: +this.orbitDist.toFixed(1),
      focus: this.focus.toArray().map((v) => +v.toFixed(1)),
      undo: this.undoStack.length,
      aim: this.lastAim,
    };
  }
}
