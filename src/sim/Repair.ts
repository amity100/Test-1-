import type * as THREE from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';

/** A fortress block a blast took out, with what it was so it can be put back exactly. */
export interface DamagedCell {
  x: number;
  y: number;
  z: number;
  v: number;
  plotIndex: number;
}

/**
 * Live repair in Fortress War. Every fortress block a breach charge blows out is remembered with its
 * original value; a soldier who stands by the hole for a few seconds puts the blocks back, spending
 * the team's supplies. Bots claim a hole before walking to it so one breach does not draw the whole
 * garrison, and a cell somebody is standing in stays open rather than entombing them.
 */
export class RepairSystem {
  readonly cells: DamagedCell[] = [];
  private claims = new Map<number, DamagedCell>();
  /** Fired after blocks came back so the nav grid and the meshes refresh for that plot. */
  onChanged: ((plotIndex: number) => void) | null = null;
  /** Fired once per repair with the hole's centre and how many blocks returned. */
  onRepaired: ((pos: THREE.Vector3, cells: number) => void) | null = null;
  /** True when a living body overlaps the cell (set by the game). */
  occupied: ((x: number, y: number, z: number) => boolean) | null = null;

  constructor(private world: VoxelWorld) {}

  reset(): void {
    this.cells.length = 0;
    this.claims.clear();
  }

  record(x: number, y: number, z: number, v: number, plotIndex: number): void {
    if (v === 0 || this.cells.some((c) => c.x === x && c.y === y && c.z === z)) return;
    this.cells.push({ x, y, z, v, plotIndex });
  }

  count(plotIndex: number): number {
    let n = 0;
    for (const c of this.cells) if (c.plotIndex === plotIndex) n++;
    return n;
  }

  has(cell: DamagedCell): boolean {
    return this.cells.includes(cell);
  }

  static dist(c: DamagedCell, p: THREE.Vector3): number {
    return Math.hypot(c.x + 0.5 - p.x, c.y + 0.5 - (p.y + 0.9), c.z + 0.5 - p.z);
  }

  /** Damaged cells of a plot within r of a body at p. */
  near(p: THREE.Vector3, r: number, plotIndex: number): DamagedCell[] {
    const out: DamagedCell[] = [];
    for (const c of this.cells) if (c.plotIndex === plotIndex && RepairSystem.dist(c, p) <= r) out.push(c);
    return out;
  }

  /** The nearest hole on a plot that no other bot has claimed. */
  nearest(p: THREE.Vector3, plotIndex: number, claimant: number, skip?: Set<DamagedCell>): DamagedCell | null {
    let best: DamagedCell | null = null;
    let bestD = Infinity;
    for (const c of this.cells) {
      if (c.plotIndex !== plotIndex || skip?.has(c)) continue;
      const by = this.claimedBy(c);
      if (by >= 0 && by !== claimant) continue;
      const d = RepairSystem.dist(c, p);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  claim(id: number, cell: DamagedCell): void {
    this.claims.set(id, cell);
  }

  release(id: number): void {
    this.claims.delete(id);
  }

  claimedBy(cell: DamagedCell): number {
    for (const [id, c] of this.claims) if (c === cell || (c.x === cell.x && c.y === cell.y && c.z === cell.z)) return id;
    return -1;
  }

  /** Puts back up to max cells around p on a plot, nearest first; returns how many came back. */
  repair(p: THREE.Vector3, r: number, max: number, plotIndex: number): number {
    const list = this.near(p, r, plotIndex).sort((a, b) => RepairSystem.dist(a, p) - RepairSystem.dist(b, p));
    let n = 0;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const c of list) {
      if (n >= max) break;
      if (this.occupied?.(c.x, c.y, c.z)) continue;
      if (!this.world.set(c.x, c.y, c.z, c.v)) continue;
      this.cells.splice(this.cells.indexOf(c), 1);
      sx += c.x + 0.5;
      sy += c.y + 0.5;
      sz += c.z + 0.5;
      n++;
    }
    if (n > 0) {
      for (const [id, c] of [...this.claims]) if (!this.cells.includes(c)) this.claims.delete(id);
      this.onChanged?.(plotIndex);
      const centre = p.clone().set(sx / n, sy / n, sz / n);
      this.onRepaired?.(centre, n);
    }
    return n;
  }
}
