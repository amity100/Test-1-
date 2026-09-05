import type { Plot } from '../world/Layout';
import { PLOT_Y, PLOT_MAX_HEIGHT } from '../world/Layout';
import { makeShape } from '../world/Voxel';
import type { Cell } from '../world/Reachability';

/**
 * Modular building pieces (the fast way to raise a fortress): walls, floors, ramps and roofs that
 * snap to a 5 m grid with 4 m storeys, like the tile system of build-battle shooters.
 * Walls and floors are editable cell by cell (doors, windows, slits, half walls, arches).
 */
export type PieceType = 'wall' | 'floor' | 'ramp' | 'roof';
export const PIECE_TYPES: PieceType[] = ['wall', 'floor', 'ramp', 'roof'];
/** Module footprint in blocks. */
export const MODULE = 5;
/** Storey height in blocks. */
export const STOREY = 4;
export const MODULES_PER_SIDE = 8;
export const MAX_LEVEL = Math.floor(PLOT_MAX_HEIGHT / STOREY) - 1;

export interface PiecePlacement {
  type: PieceType;
  /** Module indices inside the plot (0..7) and storey (0..MAX_LEVEL). */
  i: number;
  j: number;
  k: number;
  /** Wall side (0 -Z, 1 +X, 2 +Z, 3 -X) or ramp/roof rotation (0..3). */
  rot: number;
}

export interface PieceCell {
  x: number;
  y: number;
  z: number;
  shape: number;
  /** Roof blocks use the style's roof material instead of the chosen block. */
  roof: boolean;
  /** Index into the edit grid for editable pieces (-1 when not editable). */
  edit: number;
}

export interface PieceRecord extends PiecePlacement {
  key: string;
  /** Block value used for the piece body. */
  value: number;
  /** Open (removed) cells of the edit grid. */
  open: boolean[];
}

export function pieceKey(p: PiecePlacement): string {
  return `${p.type}:${p.i},${p.j},${p.k}:${p.type === 'wall' ? p.rot : 0}`;
}

/** Edit grid dimensions (columns x rows) for editable pieces. */
export function editGrid(type: PieceType): { cols: number; rows: number } | null {
  if (type === 'wall') return { cols: MODULE, rows: STOREY };
  if (type === 'floor') return { cols: MODULE, rows: MODULE };
  return null;
}

/** Wall presets as rows from the top (# solid, . open). */
export const WALL_PRESETS: Record<string, string[]> = {
  full: ['#####', '#####', '#####', '#####'],
  door: ['#####', '##..#', '##..#', '##..#'],
  gate: ['#####', '#...#', '#...#', '#...#'],
  window: ['#####', '#...#', '#...#', '#####'],
  slit: ['#####', '##.##', '##.##', '#####'],
  half: ['.....', '.....', '#####', '#####'],
  arch: ['#####', '##.##', '#...#', '#...#'],
  crenel: ['#.#.#', '#####', '#####', '#####'],
  pillars: ['#####', '#.#.#', '#.#.#', '#.#.#'],
};
export const WALL_PRESET_IDS = Object.keys(WALL_PRESETS);
/** Floor presets as rows (z from the module's -Z edge). */
export const FLOOR_PRESETS: Record<string, string[]> = {
  full: ['#####', '#####', '#####', '#####', '#####'],
  hatch: ['#####', '#####', '##.##', '#####', '#####'],
  hole: ['#####', '#...#', '#...#', '#...#', '#####'],
  ring: ['#####', '#...#', '#...#', '#...#', '#####'].map((r, i) => (i === 0 || i === 4 ? '#####' : '#...#')),
  half: ['#####', '#####', '#####', '.....', '.....'],
  bridge: ['..#..', '..#..', '..#..', '..#..', '..#..'].map(() => '.###.'),
};
export const FLOOR_PRESET_IDS = Object.keys(FLOOR_PRESETS);

export function presetToOpen(type: PieceType, id: string): boolean[] | null {
  const rows = type === 'wall' ? WALL_PRESETS[id] : type === 'floor' ? FLOOR_PRESETS[id] : undefined;
  const grid = editGrid(type);
  if (!rows || !grid) return null;
  const open: boolean[] = [];
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) open.push(rows[r][c] === '.');
  return open;
}

/** World origin of a module. */
export function moduleOrigin(plot: Plot, i: number, j: number, k: number): Cell {
  return { x: plot.minX + i * MODULE, y: PLOT_Y + k * STOREY, z: plot.minZ + j * MODULE };
}

/**
 * Cells of a piece in world coordinates. Wall edit index = row (0 top .. 3 bottom) * 5 + column
 * (left to right when seen from outside the module); floor edit index = lz * 5 + lx.
 */
export function pieceCells(plot: Plot, p: PiecePlacement, open?: boolean[]): PieceCell[] {
  const o = moduleOrigin(plot, p.i, p.j, p.k);
  const out: PieceCell[] = [];
  const isOpen = (e: number): boolean => !!open && !!open[e];
  switch (p.type) {
    case 'wall': {
      for (let c = 0; c < MODULE; c++) {
        for (let ly = 0; ly < STOREY; ly++) {
          const row = STOREY - 1 - ly;
          const e = row * MODULE + c;
          if (isOpen(e)) continue;
          let lx = 0;
          let lz = 0;
          if (p.rot === 0) {
            lx = c;
            lz = 0;
          } else if (p.rot === 1) {
            lx = MODULE - 1;
            lz = c;
          } else if (p.rot === 2) {
            lx = MODULE - 1 - c;
            lz = MODULE - 1;
          } else {
            lx = 0;
            lz = MODULE - 1 - c;
          }
          out.push({ x: o.x + lx, y: o.y + ly, z: o.z + lz, shape: 0, roof: false, edit: e });
        }
      }
      break;
    }
    case 'floor': {
      for (let lz = 0; lz < MODULE; lz++)
        for (let lx = 0; lx < MODULE; lx++) {
          const e = lz * MODULE + lx;
          if (isOpen(e)) continue;
          out.push({ x: o.x + lx, y: o.y, z: o.z + lz, shape: 0, roof: false, edit: e });
        }
      break;
    }
    case 'ramp': {
      // Stairs rising one block per row towards the facing direction, solid underneath.
      const rise = makeShape('stairs', p.rot);
      for (let i = 0; i < MODULE; i++) {
        for (let w = 0; w < MODULE; w++) {
          let lx = 0;
          let lz = 0;
          if (p.rot === 0) {
            lx = i;
            lz = w;
          } else if (p.rot === 1) {
            lx = w;
            lz = i;
          } else if (p.rot === 2) {
            lx = MODULE - 1 - i;
            lz = w;
          } else {
            lx = w;
            lz = MODULE - 1 - i;
          }
          out.push({ x: o.x + lx, y: o.y + i, z: o.z + lz, shape: rise, roof: false, edit: -1 });
          for (let y = 0; y < i; y++) out.push({ x: o.x + lx, y: o.y + y, z: o.z + lz, shape: 0, roof: false, edit: -1 });
        }
      }
      break;
    }
    case 'roof': {
      // Stepped pyramid: outer ring of slopes, inner ring, peak.
      const c = (MODULE - 1) / 2;
      for (let lz = 0; lz < MODULE; lz++)
        for (let lx = 0; lx < MODULE; lx++) {
          const ring = Math.max(Math.abs(lx - c), Math.abs(lz - c));
          const ly = Math.round(c - ring);
          const dx = c - lx;
          const dz = c - lz;
          let shape = 0;
          if (ring > 0) {
            // Face the peak along the dominant axis.
            if (Math.abs(dx) > Math.abs(dz)) shape = makeShape('slope', dx > 0 ? 0 : 2);
            else if (Math.abs(dz) > Math.abs(dx)) shape = makeShape('slope', dz > 0 ? 1 : 3);
            else shape = makeShape('slope', dx > 0 ? 0 : 2);
          }
          out.push({ x: o.x + lx, y: o.y + ly, z: o.z + lz, shape, roof: true, edit: -1 });
          // Fill under the ring so the roof reads as a solid cap from below.
          if (ring < c) out.push({ x: o.x + lx, y: o.y + ly - 1, z: o.z + lz, shape: 0, roof: true, edit: -1 });
        }
      break;
    }
  }
  return out;
}

export function pieceCost(type: PieceType): number {
  switch (type) {
    case 'wall':
      return MODULE * STOREY;
    case 'floor':
      return MODULE * MODULE;
    case 'ramp':
      return (MODULE * MODULE * (MODULE + 1)) / 2;
    case 'roof':
      return MODULE * MODULE + 9;
  }
}

/** True when the module indices are inside the plot and the storey is buildable. */
export function moduleValid(i: number, j: number, k: number): boolean {
  return i >= 0 && i < MODULES_PER_SIDE && j >= 0 && j < MODULES_PER_SIDE && k >= 0 && k <= MAX_LEVEL;
}

/**
 * Snaps an aim point to a piece placement. `point` is where the cursor ray hits (a block face or
 * the ground), `normal` the hit face normal, `viewDir` the horizontal camera direction.
 */
export function snapPiece(plot: Plot, type: PieceType, point: { x: number; y: number; z: number }, normal: { x: number; y: number; z: number }, viewDir: { x: number; z: number }, rotOverride: number | null): PiecePlacement | null {
  // Nudge into the air cell in front of the hit face so vertical faces select the neighbouring module.
  const px = point.x + normal.x * 0.02;
  const pz = point.z + normal.z * 0.02;
  const py = point.y + normal.y * 0.02;
  const fi = (px - plot.minX) / MODULE;
  const fj = (pz - plot.minZ) / MODULE;
  const i = Math.floor(fi);
  const j = Math.floor(fj);
  // Storey: floors and roofs sit on the level of the surface aimed at; walls fill the storey above it.
  const k = Math.max(0, Math.round((py - PLOT_Y) / STOREY));
  if (!moduleValid(i, j, k)) return null;
  let rot = 0;
  if (type === 'wall') {
    if (rotOverride !== null) rot = rotOverride;
    else {
      // Nearest edge of the module footprint to the aim point.
      const u = fi - i;
      const v = fj - j;
      const d = [v, 1 - u, 1 - v, u]; // -Z, +X, +Z, -X
      let best = 0;
      for (let s = 1; s < 4; s++) if (d[s] < d[best]) best = s;
      rot = best;
      // Aiming at a vertical face picks the edge that face belongs to when it is closer than the nearest.
      if (Math.abs(normal.x) > 0.5 || Math.abs(normal.z) > 0.5) {
        const faceSide = normal.z > 0.5 ? 0 : normal.x < -0.5 ? 1 : normal.z < -0.5 ? 2 : 3;
        if (d[faceSide] < 0.35) rot = faceSide;
      }
    }
  } else if (type === 'ramp') {
    if (rotOverride !== null) rot = rotOverride;
    else rot = Math.abs(viewDir.x) >= Math.abs(viewDir.z) ? (viewDir.x >= 0 ? 0 : 2) : viewDir.z >= 0 ? 1 : 3;
  } else rot = rotOverride ?? 0;
  return { type, i, j, k, rot };
}

/**
 * Locates the edit cell of a wall/floor under a ray hit on one of its blocks: returns the edit
 * index of the block, or -1.
 */
export function editIndexOfCell(plot: Plot, rec: PieceRecord, cell: Cell): number {
  const cells = pieceCells(plot, rec);
  for (const c of cells) if (c.x === cell.x && c.y === cell.y && c.z === cell.z) return c.edit;
  return -1;
}

/** World-space centre and size of an edit cell (for tile overlays). */
export function editCellBox(plot: Plot, rec: PieceRecord, e: number): { cx: number; cy: number; cz: number; sx: number; sy: number; sz: number } {
  const o = moduleOrigin(plot, rec.i, rec.j, rec.k);
  if (rec.type === 'floor') {
    const lx = e % MODULE;
    const lz = Math.floor(e / MODULE);
    return { cx: o.x + lx + 0.5, cy: o.y + 0.5, cz: o.z + lz + 0.5, sx: 0.92, sy: 0.92, sz: 0.92 };
  }
  const c = e % MODULE;
  const row = Math.floor(e / MODULE);
  const ly = STOREY - 1 - row;
  let lx = 0;
  let lz = 0;
  if (rec.rot === 0) {
    lx = c;
    lz = 0;
  } else if (rec.rot === 1) {
    lx = MODULE - 1;
    lz = c;
  } else if (rec.rot === 2) {
    lx = MODULE - 1 - c;
    lz = MODULE - 1;
  } else {
    lx = 0;
    lz = MODULE - 1 - c;
  }
  return { cx: o.x + lx + 0.5, cy: o.y + ly + 0.5, cz: o.z + lz + 0.5, sx: 0.92, sy: 0.92, sz: 0.92 };
}
