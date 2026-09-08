import * as THREE from 'three';
import { Emitter } from '../core/Events';
import type { Input } from '../core/Input';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Plot } from '../world/Layout';
import type { Cell } from '../world/Reachability';
import { TRAP_KINDS, TRAP_COST, TRAP_SLOTS, type TrapKind, type TrapReason, type TrapSystem, type Trap } from '../sim/Traps';

export interface FortifyEvents extends Record<string, unknown> {
  placed: { kind: TrapKind; trap: Trap };
  removed: { kind: TrapKind };
  invalid: { key: string };
  /** Selected kind or slot count changed. */
  change: Record<string, never>;
}

/** What the crosshair rests on this frame. */
export interface FortifyAim {
  /** The floor cell under the crosshair inside the fortress, or null. */
  cell: Cell | null;
  /** Footprint the selected trap would take (or the aimed trap covers). */
  cells: Cell[];
  reason: TrapReason | null;
  /** One of the builder's own traps under the crosshair (the action becomes "take back"). */
  existing: Trap | null;
}

/** How far ahead the builder can set a trap (metres). */
export const FORTIFY_REACH = 7.5;
const KIND_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];

/**
 * The trap walk after the build: the builder stands inside their own fortress in first person, picks
 * a trap kind and sets it on the floor under the crosshair (click / the PLACE button); aiming at one
 * of their traps takes it back. A translucent pad shows the footprint and whether it fits.
 */
export class Fortify {
  readonly events = new Emitter<FortifyEvents>();
  kind: TrapKind = 'spikes';
  readonly aim: FortifyAim = { cell: null, cells: [], reason: null, existing: null };
  active = false;
  /** Traps set during this walk (the instruction card retires after the first). */
  placements = 0;
  /** Team walks: who is placing and how many slots are theirs (the plot total is shared with teammates). */
  ownerId = -1;
  personal = TRAP_SLOTS;
  private ghost: THREE.InstancedMesh;
  private ghostMat: THREE.MeshBasicMaterial;
  private matrix = new THREE.Matrix4();
  private fwd = new THREE.Vector3();

  constructor(
    private world: VoxelWorld,
    private traps: TrapSystem,
    readonly plot: Plot,
    private input: Input,
    private camera: THREE.PerspectiveCamera,
    private scene: THREE.Scene,
  ) {
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.42, depthWrite: false });
    this.ghost = new THREE.InstancedMesh(new THREE.BoxGeometry(0.94, 0.1, 0.94), this.ghostMat, 8);
    this.ghost.count = 0;
    this.ghost.visible = false;
    this.ghost.frustumCulled = false;
    this.ghost.renderOrder = 4;
    scene.add(this.ghost);
  }

  enter(): void {
    this.active = true;
    this.placements = 0;
  }

  exit(): void {
    this.active = false;
    this.ghost.count = 0;
    this.ghost.visible = false;
  }

  dispose(): void {
    this.exit();
    this.scene.remove(this.ghost);
    this.ghost.geometry.dispose();
    this.ghostMat.dispose();
  }

  /** Slots used: the builder's own when placing for a team, else everything on the plot. */
  get slots(): number {
    return this.ownerId >= 0 ? this.traps.slotsUsedBy(this.plot.index, this.ownerId) : this.traps.slotsUsed(this.plot.index);
  }
  get slotsTotal(): number {
    return this.ownerId >= 0 ? this.personal : this.traps.slotsFor(this.plot.index);
  }
  /** The builder's traps, for the picker to show what is already set. */
  get mine(): Trap[] {
    return this.traps.traps.filter((t) => t.plotIndex === this.plot.index);
  }

  setKind(k: TrapKind): void {
    if (this.kind === k) return;
    this.kind = k;
    this.events.emit('change', {});
  }

  cycle(dir: number): void {
    const i = TRAP_KINDS.indexOf(this.kind);
    this.setKind(TRAP_KINDS[(i + dir + TRAP_KINDS.length) % TRAP_KINDS.length]);
  }

  /** True when the selected kind still fits the slot budget. */
  affordable(kind: TrapKind = this.kind): boolean {
    return this.slots + TRAP_COST[kind] <= this.slotsTotal;
  }

  update(dt: number): void {
    void dt;
    if (!this.active) return;
    const input = this.input;
    for (let i = 0; i < KIND_KEYS.length && i < TRAP_KINDS.length; i++) if (input.wasPressed(KIND_KEYS[i])) this.setKind(TRAP_KINDS[i]);
    if (input.wheel > 0) this.cycle(1);
    else if (input.wheel < 0) this.cycle(-1);
    this.computeAim();
    this.drawGhost();
    if (!input.enabled) return;
    const primary = input.firePressed();
    const secondary = input.buttonPressed(2);
    if (primary) {
      if (this.aim.existing) this.remove(this.aim.existing);
      else if (this.aim.cell) this.place();
      else this.events.emit('invalid', { key: 'fortifyAimFloor' });
    } else if (secondary && this.aim.existing) this.remove(this.aim.existing);
  }

  /** The floor cell under the crosshair: a floor's top face, or the floor in front of a wall the ray hits. */
  private computeAim(): void {
    const a = this.aim;
    a.cell = null;
    a.cells = [];
    a.reason = null;
    a.existing = null;
    const o = this.camera.position;
    const d = this.fwd.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const hit = this.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, FORTIFY_REACH);
    if (!hit) return;
    let cx: number;
    let cy: number;
    let cz: number;
    if (hit.ny > 0.5) {
      cx = hit.x;
      cy = hit.y + 1;
      cz = hit.z;
    } else {
      // A wall or ceiling: step a little off the face and drop to the floor below that point.
      cx = Math.floor(hit.px + hit.nx * 0.3);
      cz = Math.floor(hit.pz + hit.nz * 0.3);
      const y0 = Math.floor(hit.py + hit.ny * 0.3);
      let found = -1;
      for (let k = 0; k < 4; k++) {
        if (this.world.get(cx, y0 - k, cz) === 0 && this.world.get(cx, y0 - k - 1, cz) !== 0) {
          found = y0 - k;
          break;
        }
      }
      if (found < 0) return;
      cy = found;
    }
    const c: Cell = { x: cx, y: cy, z: cz };
    const existing = this.traps.at(c);
    if (existing && existing.plotIndex === this.plot.index && (this.ownerId < 0 || existing.ownerId === this.ownerId || existing.ownerId < 0)) {
      a.existing = existing;
      a.cell = c;
      a.cells = existing.cells;
      return;
    }
    const pv = this.traps.preview(this.kind, c, this.plot.index);
    a.cell = c;
    a.cells = pv.cells;
    a.reason = pv.reason;
  }

  private drawGhost(): void {
    const a = this.aim;
    const n = Math.min(this.ghost.instanceMatrix.count, a.cells.length);
    this.ghost.count = n;
    this.ghost.visible = n > 0;
    for (let i = 0; i < n; i++) {
      const c = a.cells[i];
      this.matrix.makeTranslation(c.x + 0.5, c.y + 0.06, c.z + 0.5);
      this.ghost.setMatrixAt(i, this.matrix);
    }
    this.ghost.instanceMatrix.needsUpdate = true;
    this.ghostMat.color.setHex(a.existing ? 0xffb300 : a.reason ? 0xff4655 : 0x39ff14);
  }

  place(): boolean {
    if (!this.aim.cell) return false;
    if (!this.affordable()) {
      this.events.emit('invalid', { key: 'trapNoSlots' });
      return false;
    }
    const r = this.traps.place(this.kind, this.aim.cell, this.plot.index, this.ownerId);
    if (typeof r === 'string') {
      this.events.emit('invalid', { key: r });
      return false;
    }
    this.placements++;
    this.events.emit('placed', { kind: r.kind, trap: r });
    this.events.emit('change', {});
    return true;
  }

  remove(t: Trap): void {
    this.traps.remove(t);
    this.events.emit('removed', { kind: t.kind });
    this.events.emit('change', {});
  }
}
