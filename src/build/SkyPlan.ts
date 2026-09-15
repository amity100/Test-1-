/**
 * The plan behind the sky arenas. Everything built in Sky Flag lives on one island-wide grid of
 * cells — eight metres square, six metres per storey — and the voxel world is only a rendering of
 * it. A cell holds one module (a deck, a stair tower, a ramp, a bridge or a piece of an arena);
 * cells that touch belong to one structure, and a structure is what the generator dresses in
 * marble, gold and stone.
 */

export const CELL = 8;
/** Blocks from one floor to the next: five clear, one slab. */
export const STOREY = 6;
/** Highest floor a cell may sit at (the world ceiling is 255 blocks). */
export const MAX_FLOOR = 236;

export type SkyKind = 'deck' | 'tower' | 'ramp' | 'bridge' | 'arena' | 'arenaPart';

export interface SkyCell {
  i: number;
  j: number;
  /**
   * Absolute height of the cell's floor slab; the surface walked on is one block higher. Storeys
   * are six blocks apart, but the grid is not global: a structure takes its phase from the ground
   * it started on, so the first deck always lands at the builder's feet instead of inside a hill.
   */
  y: number;
  kind: SkyKind;
  /** Entity id of the builder. */
  owner: number;
  /** Palette index of the builder's colour. */
  color: number;
  /** Facing 0 +X, 1 +Z, 2 -X, 3 -Z (ramps, towers, bridges). */
  dir: number;
  /** Cells placed by one tap share a group id, so a module is one thing to remove or refund. */
  group: number;
  /** For `arenaPart`: the key of the arena centre that owns the blocks. */
  host?: number;
  placedAt: number;
}

/** Packs a cell address into one integer (i, j may be negative; y is 0..255). */
export function cellKey(i: number, j: number, y: number): number {
  return ((i + 512) * 1024 + (j + 512)) * 256 + y;
}

/** The four side directions, in the order of the facing codes. */
export const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** World block coordinate of a cell's lowest-x corner. */
export function cellX(i: number): number {
  return i * CELL;
}
export function cellZ(j: number): number {
  return j * CELL;
}
/** Cell column that contains a world position. */
export function cellOf(x: number, z: number): [number, number] {
  return [Math.floor(x / CELL), Math.floor(z / CELL)];
}

/** Packs a cell column (the ground plan address, without a height). */
function colKey(i: number, j: number): number {
  return (i + 512) * 1024 + (j + 512);
}

export class SkyPlan {
  readonly cells = new Map<number, SkyCell>();
  /** Floors present in each column, so "the level I stand on" is a lookup, not a search. */
  private columns = new Map<number, number[]>();
  private nextGroup = 1;

  group(): number {
    return this.nextGroup++;
  }

  get(i: number, j: number, y: number): SkyCell | undefined {
    return this.cells.get(cellKey(i, j, y));
  }
  has(i: number, j: number, y: number): boolean {
    return this.cells.has(cellKey(i, j, y));
  }
  set(c: SkyCell): void {
    const key = cellKey(c.i, c.j, c.y);
    if (!this.cells.has(key)) {
      const col = colKey(c.i, c.j);
      const ys = this.columns.get(col);
      if (ys) ys.push(c.y);
      else this.columns.set(col, [c.y]);
    }
    this.cells.set(key, c);
  }
  remove(i: number, j: number, y: number): SkyCell | undefined {
    const key = cellKey(i, j, y);
    const c = this.cells.get(key);
    if (!c) return undefined;
    this.cells.delete(key);
    const ys = this.columns.get(colKey(i, j));
    if (ys) {
      const at = ys.indexOf(y);
      if (at >= 0) ys.splice(at, 1);
    }
    return c;
  }

  /** The floor of this column closest to `y`, within `tol` blocks; null when the column is empty there. */
  nearestInColumn(i: number, j: number, y: number, tol: number): number | null {
    const ys = this.columns.get(colKey(i, j));
    if (!ys || ys.length === 0) return null;
    let best: number | null = null;
    let bestD = tol + 0.001;
    for (const cy of ys) {
      const d = Math.abs(cy - y);
      if (d < bestD) {
        bestD = d;
        best = cy;
      }
    }
    return best;
  }
  get size(): number {
    return this.cells.size;
  }
  clear(): void {
    this.cells.clear();
    this.columns.clear();
    this.nextGroup = 1;
  }

  /** The four side neighbours on the same floor (undefined where there is nothing). */
  sides(i: number, j: number, y: number): (SkyCell | undefined)[] {
    return DIRS.map(([dx, dz]) => this.get(i + dx, j + dz, y));
  }
  below(i: number, j: number, y: number): SkyCell | undefined {
    return y >= STOREY ? this.get(i, j, y - STOREY) : undefined;
  }
  above(i: number, j: number, y: number): SkyCell | undefined {
    return this.get(i, j, y + STOREY);
  }

  /** Every cell of one tap. */
  groupCells(group: number): SkyCell[] {
    const out: SkyCell[] = [];
    for (const c of this.cells.values()) if (c.group === group) out.push(c);
    return out;
  }

  /** The cell and everything it touches (sides on the same storey, and directly above or below). */
  structureOf(start: SkyCell, limit = 400): SkyCell[] {
    const seen = new Set<number>([cellKey(start.i, start.j, start.y)]);
    const out: SkyCell[] = [start];
    for (let head = 0; head < out.length && out.length < limit; head++) {
      const c = out[head];
      const near = [...this.sides(c.i, c.j, c.y), this.below(c.i, c.j, c.y), this.above(c.i, c.j, c.y)];
      for (const n of near) {
        if (!n) continue;
        const key = cellKey(n.i, n.j, n.y);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(n);
      }
    }
    return out;
  }

  /** Cells whose generated blocks depend on this one: itself, its side neighbours and the cells above and below. */
  dependents(i: number, j: number, y: number): SkyCell[] {
    const out: SkyCell[] = [];
    const push = (c: SkyCell | undefined): void => {
      if (c) out.push(c);
    };
    push(this.get(i, j, y));
    for (const [dx, dz] of DIRS) {
      push(this.get(i + dx, j + dz, y));
      // A ramp one storey down and one cell across feeds the parapet gap of this cell.
      push(this.get(i + dx, j + dz, y - STOREY));
      push(this.get(i + dx, j + dz, y + STOREY));
    }
    push(this.below(i, j, y));
    push(this.above(i, j, y));
    // An arena is drawn from its centre, so touching any part means redrawing the whole thing.
    const here = this.get(i, j, y);
    if (here?.kind === 'arenaPart' && here.host !== undefined) {
      const host = this.cells.get(here.host);
      if (host) out.push(host);
    }
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const n = this.get(i + di, j + dj, y);
        if (n?.kind === 'arena') out.push(n);
      }
    return out;
  }

  /** Walkable top surfaces: the middle of every cell that can be stood on, highest first. */
  standing(): { x: number; y: number; z: number; cell: SkyCell }[] {
    const out: { x: number; y: number; z: number; cell: SkyCell }[] = [];
    for (const c of this.cells.values()) {
      if (c.kind === 'tower' || c.kind === 'ramp' || c.kind === 'arenaPart') continue;
      out.push({ x: cellX(c.i) + CELL / 2, y: c.y + 1, z: cellZ(c.j) + CELL / 2, cell: c });
    }
    out.sort((a, b) => b.y - a.y);
    return out;
  }
}
