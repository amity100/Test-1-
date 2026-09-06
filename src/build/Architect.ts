import type { Plot } from '../world/Layout';
import { PLOT_Y } from '../world/Layout';
import { STYLES, type StyleId, type BlockRole } from '../world/Styles';
import { Shape, makeShape, withShape, blockColor } from '../world/Voxel';
import type { Cell } from '../world/Reachability';

/**
 * The Architect turns a coarse plan of room blocks (Townscaper style: tap a cell, get a building)
 * into finished, connected voxel architecture. Players and bots only decide *where* blocks go and
 * which of eight tones each block has; walls, doors, windows, stairs, roofs, parapets, balconies,
 * arcades and trims are all derived from the neighbourhood, so every structure is both good
 * looking and playable: every room joins its neighbours, every storey has stairs, roofs are
 * fighting platforms with access, and the ground floor always has entrances.
 */

/** Room block footprint in metres. */
export const CELL = 5;
/** Storey height in rows (slab + three clear rows). */
export const STOREY_H = 4;
/** Cells per plot side (40 m plot). */
export const GRID = 8;
export const MAX_STOREYS = 8;
/** Rows of the voxel field above the plot floor (the highest parapet or spire fits). */
export const FIELD_H = MAX_STOREYS * STOREY_H + 4;
export const PLOT_W = GRID * CELL;
export const TONES = 8;
/** How many room blocks a fortress may hold. */
export const MAX_BLOCKS = 64;

export type Tone = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Plan cells hold 0 (empty) or tone + 1. */
export class Plan {
  readonly cells: Uint8Array;
  constructor(cells?: Uint8Array) {
    this.cells = cells ? new Uint8Array(cells) : new Uint8Array(GRID * GRID * MAX_STOREYS);
  }
  static index(i: number, j: number, k: number): number {
    return (k * GRID + j) * GRID + i;
  }
  static coords(idx: number): [number, number, number] {
    return [idx % GRID, Math.floor(idx / GRID) % GRID, Math.floor(idx / (GRID * GRID))];
  }
  static inside(i: number, j: number, k: number): boolean {
    return i >= 0 && i < GRID && j >= 0 && j < GRID && k >= 0 && k < MAX_STOREYS;
  }
  has(i: number, j: number, k: number): boolean {
    return Plan.inside(i, j, k) && this.cells[Plan.index(i, j, k)] !== 0;
  }
  tone(i: number, j: number, k: number): Tone {
    return Math.max(0, this.cells[Plan.index(i, j, k)] - 1) as Tone;
  }
  set(i: number, j: number, k: number, tone: Tone | null): void {
    if (!Plan.inside(i, j, k)) return;
    this.cells[Plan.index(i, j, k)] = tone === null ? 0 : tone + 1;
  }
  count(): number {
    let n = 0;
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i]) n++;
    return n;
  }
  clone(): Plan {
    return new Plan(this.cells);
  }
  equals(o: Plan): boolean {
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] !== o.cells[i]) return false;
    return true;
  }
  /** Highest occupied storey index plus one. */
  height(): number {
    for (let k = MAX_STOREYS - 1; k >= 0; k--) for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) if (this.cells[Plan.index(i, j, k)]) return k + 1;
    return 0;
  }
  /** Occupied cells, lowest storey first. */
  occupied(): [number, number, number][] {
    const out: [number, number, number][] = [];
    for (let k = 0; k < MAX_STOREYS; k++) for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) if (this.cells[Plan.index(i, j, k)]) out.push([i, j, k]);
    return out;
  }
  /** Serialises to a compact string (for blueprints and tests). */
  encode(): string {
    let s = '';
    for (let n = 0; n < this.cells.length; n++) s += this.cells[n].toString(36);
    return s;
  }
  static decode(s: string): Plan {
    const p = new Plan();
    for (let n = 0; n < Math.min(s.length, p.cells.length); n++) p.cells[n] = parseInt(s[n], 36) || 0;
    return p;
  }
}

/** Side of a cell: 0 -Z, 1 +X, 2 +Z, 3 -X (outward normals). */
export const SIDES: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export interface RoomInfo {
  i: number;
  j: number;
  k: number;
  tone: Tone;
  /** Interior floor cells (feet level, world coordinates) that are free of stairs and crates. */
  floor: Cell[];
  /** How buried the room is: storeys up plus enclosed sides plus a block above. */
  depth: number;
}

export interface ArchitectResult {
  field: Uint16Array;
  /** Solid voxels in the field. */
  blocks: number;
  rooms: RoomInfo[];
  /** Ground entrances as world cells at the doorway threshold (feet level). */
  entrances: Cell[];
  /** Roof terrace centres (feet level, world coordinates). */
  roofSpots: Cell[];
  /** Where stairs were placed (debug and tests). */
  stairs: { i: number; j: number; k: number; side: number; kind: 'up' | 'roof' }[];
}

interface Face {
  /** Open columns (0..4 along the face) and rows (1..3 above the slab). */
  cols: number[];
  rows: number[];
  /** Extra open cells [col,row] (stepped arch tops). */
  extra: [number, number][];
  /** Columns filled with glass where not open. */
  glassCols: number[];
  door: boolean;
  balcony: boolean;
  /** Trim frame around the opening. */
  frame: boolean;
}

interface StairPlan {
  side: number;
  /** Local (x,z) of the three steps, in climbing order. */
  run: [number, number][];
  kind: 'up' | 'roof';
}

const CASTLE_STYLES: StyleId[] = ['medieval', 'gothic', 'desert'];
const TECH_STYLES: StyleId[] = ['modern', 'neon'];

function hash(a: number, b: number, c: number, d = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647 + d * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

/** Connected groups of occupied cells on one storey (face adjacency), as plan indices. */
export function components(plan: Plan, k: number): number[][] {
  const seen = new Set<number>();
  const out: number[][] = [];
  for (let j = 0; j < GRID; j++)
    for (let i = 0; i < GRID; i++) {
      const start = Plan.index(i, j, k);
      if (!plan.has(i, j, k) || seen.has(start)) continue;
      const group: number[] = [];
      const stack = [start];
      seen.add(start);
      while (stack.length) {
        const idx = stack.pop()!;
        group.push(idx);
        const [ci, cj] = Plan.coords(idx);
        for (const [dx, dz] of SIDES) {
          const ni = ci + dx;
          const nj = cj + dz;
          if (!plan.has(ni, nj, k)) continue;
          const nidx = Plan.index(ni, nj, k);
          if (seen.has(nidx)) continue;
          seen.add(nidx);
          stack.push(nidx);
        }
      }
      out.push(group);
    }
  return out;
}

/** Voxel field over the plot: x,z 0..39, y 0..FIELD_H-1 above the plot floor. */
export class Field {
  readonly data = new Uint16Array(PLOT_W * FIELD_H * PLOT_W);
  inside(x: number, y: number, z: number): boolean {
    return x >= 0 && x < PLOT_W && z >= 0 && z < PLOT_W && y >= 0 && y < FIELD_H;
  }
  idx(x: number, y: number, z: number): number {
    return (y * PLOT_W + z) * PLOT_W + x;
  }
  get(x: number, y: number, z: number): number {
    return this.inside(x, y, z) ? this.data[this.idx(x, y, z)] : 0;
  }
  set(x: number, y: number, z: number, v: number): void {
    if (this.inside(x, y, z)) this.data[this.idx(x, y, z)] = v;
  }
}

export class Architect {
  private readonly castle: boolean;
  private readonly tech: boolean;
  private readonly roles: Record<BlockRole, number>;
  /** Side facing the island centre: where attackers come from. */
  readonly frontSide: number;

  constructor(
    private plot: Plot,
    readonly style: StyleId,
  ) {
    this.castle = CASTLE_STYLES.includes(style);
    this.tech = TECH_STYLES.includes(style);
    this.roles = STYLES[style].roles;
    const fx = -plot.cx;
    const fz = -plot.cz;
    this.frontSide = Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 1 : 3) : fz > 0 ? 2 : 0;
  }

  /** Wall block value for a tone. */
  wallValue(tone: Tone): number {
    const r = this.roles;
    switch (tone) {
      case 0: return r.wall;
      case 1: return r.wallAlt;
      case 2: return r.trim;
      case 3: return r.accent;
      case 4: return r.glass;
      case 5: return withShape(r.pillar, 0);
      case 6: return r.floor;
      case 7: return r.wall;
    }
  }

  /** Swatch colour (hex) of a tone for the UI; tone 7 shows the roof it produces. */
  swatchHex(tone: Tone, palette: string[]): string {
    const v = tone === 7 ? this.roles.roof : this.wallValue(tone);
    return palette[blockColor(v)] ?? '#888888';
  }

  // ------------------------------------------------------------------ generation
  generate(plan: Plan): ArchitectResult {
    const F = new Field();
    const doors = new Map<number, Set<number>>();
    const addDoor = (idx: number, side: number): void => {
      if (!doors.has(idx)) doors.set(idx, new Set());
      doors.get(idx)!.add(side);
    };
    const hasDoor = (idx: number, side: number): boolean => doors.get(idx)?.has(side) ?? false;

    // ---- 1. Entrances: every ground component gets a gate towards the front plus more doors.
    for (const cells of components(plan, 0)) {
      const faces: { idx: number; side: number; score: number }[] = [];
      for (const idx of cells) {
        const [i, j] = Plan.coords(idx);
        for (let s = 0; s < 4; s++) {
          const [dx, dz] = SIDES[s];
          if (plan.has(i + dx, j + dz, 0)) continue;
          let score = s === this.frontSide ? 10 : (s + 2) % 4 === this.frontSide ? 2 : 5;
          if (!Plan.inside(i + dx, j + dz, 0)) score += 3; // opens straight onto the field
          if (plan.has(i + dx, j + dz, 1)) score -= 1; // under an overhang
          score += (hash(i, j, s) % 100) / 100;
          faces.push({ idx, side: s, score });
        }
      }
      faces.sort((a, b) => b.score - a.score);
      const want = cells.length >= 10 ? 3 : 2;
      const chosen: typeof faces = [];
      for (const f of faces) {
        if (chosen.length >= want) break;
        if (chosen.some((c) => c.idx === f.idx)) continue;
        // The second door goes on another side when any other side is available.
        if (chosen.length >= 1 && chosen.every((c) => c.side === f.side) && faces.some((g) => g.side !== f.side && !chosen.some((c) => c.idx === g.idx))) continue;
        chosen.push(f);
      }
      for (const f of chosen) addDoor(f.idx, f.side);
    }

    // ---- 2. Doorways between neighbours of different tones (same tone merges into one hall).
    for (const [i, j, k] of plan.occupied()) {
      for (const s of [1, 2]) {
        const [dx, dz] = SIDES[s];
        if (!plan.has(i + dx, j + dz, k)) continue;
        if (plan.tone(i, j, k) === plan.tone(i + dx, j + dz, k)) continue;
        addDoor(Plan.index(i, j, k), s);
        addDoor(Plan.index(i + dx, j + dz, k), (s + 2) % 4);
      }
    }

    // ---- 3. Stairs: each upper component is reached from below; each top component reaches its roof.
    const stairs = new Map<number, StairPlan>();
    const holesBelow = (i: number, j: number, k: number): Set<string> => {
      const below = stairs.get(Plan.index(i, j, k - 1));
      const out = new Set<string>();
      if (below) for (let n = 0; n < 3; n++) out.add(`${below.run[n][0] - i * CELL},${below.run[n][1] - j * CELL}`);
      return out;
    };
    const planStair = (idx: number, kind: 'up' | 'roof'): void => {
      const [i, j, k] = Plan.coords(idx);
      const tone = plan.tone(i, j, k);
      const avoid = holesBelow(i, j, k);
      const belowSide = stairs.get(Plan.index(i, j, k - 1))?.side ?? -1;
      let best = -1;
      let bestScore = -Infinity;
      for (let s = 0; s < 4; s++) {
        const [dx, dz] = SIDES[s];
        const exterior = !plan.has(i + dx, j + dz, k);
        let score = 0;
        // Never block a doorway with the run.
        if (hasDoor(idx, s)) score -= 1000;
        // Stairwells of consecutive storeys must not stack: the opposite side of the stair below is
        // ideal, and every step cell that sits over the opening below costs dearly.
        const run = this.stairRun(i, j, k, s);
        let overlap = 0;
        for (const [rx, rz] of run) if (avoid.has(`${rx - i * CELL},${rz - j * CELL}`)) overlap++;
        score -= overlap * 60;
        if (belowSide >= 0 && s === (belowSide + 2) % 4) score += 50;
        const merged = !exterior && plan.tone(i + dx, j + dz, k) === tone;
        if (!merged) score += 3; // lean the stair on a real wall
        score += (hash(i, j, k, s + 20) % 10) / 10;
        if (score > bestScore) {
          bestScore = score;
          best = s;
        }
      }
      stairs.set(idx, { side: best, run: this.stairRun(i, j, k, best), kind });
    };
    for (let k = 1; k < MAX_STOREYS; k++) {
      for (const cells of components(plan, k)) {
        const candidates = cells.filter((idx) => {
          const [i, j] = Plan.coords(idx);
          return plan.has(i, j, k - 1) && !stairs.has(Plan.index(i, j, k - 1));
        });
        if (candidates.length === 0) continue;
        const want = 1 + Math.floor((cells.length - 1) / 5);
        for (const idx of this.pickSpread(candidates, want, k)) planStair(idx - GRID * GRID, 'up');
      }
    }
    for (let k = 0; k < MAX_STOREYS; k++) {
      for (const cells of components(plan, k)) {
        const tops = cells.filter((idx) => {
          const [i, j] = Plan.coords(idx);
          return !plan.has(i, j, k + 1) && plan.tone(i, j, k) !== 7 && !stairs.has(idx);
        });
        if (tops.length === 0) continue;
        const want = 1 + Math.floor((tops.length - 1) / 6);
        for (const idx of this.pickSpread(tops, want, k + 100)) planStair(idx, 'roof');
      }
    }

    // ---- 4. Carve every block.
    const holes: [number, number, number][] = [];
    const entrances: Cell[] = [];
    const roofSpots: Cell[] = [];
    const roomBase: { i: number; j: number; k: number; tone: Tone; depth: number }[] = [];
    for (const [i, j, k] of plan.occupied()) {
      const idx = Plan.index(i, j, k);
      const tone = plan.tone(i, j, k);
      const x0 = i * CELL;
      const z0 = j * CELL;
      const y0 = k * STOREY_H;
      const wall = this.wallValue(tone);
      const above = plan.has(i, j, k + 1);
      const below = plan.has(i, j, k - 1);
      const stair = stairs.get(idx) ?? null;

      // Slab: plinth ring on the ground storey, trim string course above, floor inside.
      for (let lz = 0; lz < CELL; lz++)
        for (let lx = 0; lx < CELL; lx++) {
          const edge = lx === 0 || lx === CELL - 1 || lz === 0 || lz === CELL - 1;
          F.set(x0 + lx, y0, z0 + lz, edge ? (k === 0 ? withShape(this.roles.pillar, 0) : this.roles.trim) : tone === 4 ? this.roles.trim : this.roles.floor);
        }
      for (let ly = 1; ly < STOREY_H; ly++) for (let lz = 1; lz < CELL - 1; lz++) for (let lx = 1; lx < CELL - 1; lx++) F.set(x0 + lx, y0 + ly, z0 + lz, 0);

      // Walls.
      for (let s = 0; s < 4; s++) {
        const [dx, dz] = SIDES[s];
        const neighbour = plan.has(i + dx, j + dz, k);
        const merged = neighbour && plan.tone(i + dx, j + dz, k) === tone;
        const owner = !neighbour || idx < Plan.index(i + dx, j + dz, k);
        if (merged) {
          // Open hall: the owner clears the boundary strip, corner posts stay as columns.
          if (owner) for (let c = 1; c < CELL - 1; c++) for (let ly = 1; ly < STOREY_H; ly++) F.set(...this.faceCell(x0, y0, z0, s, c, ly), 0);
          continue;
        }
        if (neighbour && !owner) continue;
        const exterior = !neighbour;
        const face = this.faceFor(plan, i, j, k, s, tone, exterior, hasDoor(idx, s), stair?.side === s);
        for (let c = 0; c < CELL; c++) {
          for (let ly = 1; ly < STOREY_H; ly++) {
            let v = wall;
            const open = face !== null && ((face.cols.includes(c) && face.rows.includes(ly)) || face.extra.some(([ec, er]) => ec === c && er === ly));
            if (open) v = 0;
            else if (face && face.glassCols.includes(c)) v = this.roles.glass;
            else if (face && face.frame && (c === face.cols[0] - 1 || c === face.cols[face.cols.length - 1] + 1) && ly <= Math.max(...face.rows) + 1) v = this.roles.trim;
            else if (exterior && tone === 0 && (c === 0 || c === CELL - 1)) v = this.roles.wallAlt; // quoins
            F.set(...this.faceCell(x0, y0, z0, s, c, ly), v);
          }
        }
        if (!exterior || !face) continue;
        if (face.door) {
          const [fx, fy, fz] = this.faceCell(x0, y0, z0, s, 2, 1);
          if (k === 0) {
            entrances.push({ x: this.plot.minX + fx, y: PLOT_Y + fy, z: this.plot.minZ + fz });
            // A step outside the sill.
            for (const c of face.cols) {
              const [cx, , cz] = this.faceCell(x0, y0, z0, s, c, 1);
              if (F.inside(cx + dx, 0, cz + dz) && F.get(cx + dx, 0, cz + dz) === 0) F.set(cx + dx, 0, cz + dz, withShape(this.roles.stairs, makeShape('stairs', (s + 1) % 4)));
            }
          }
          // Lamps flank the doorway.
          F.set(...this.faceCell(x0, y0, z0, s, 0, 2), this.roles.light);
          F.set(...this.faceCell(x0, y0, z0, s, CELL - 1, 2), this.roles.light);
        }
        if (face.balcony) this.balcony(F, x0, y0, z0, s);
      }

      // Stairs.
      if (stair) {
        // The stairwell opening spans the whole run: climbing a step needs head room one row above
        // the head (the navigation rule for a jump), so even the first step's column stays open.
        for (let n = 0; n < 3; n++) {
          const [sx, sz] = stair.run[n];
          for (let ly = 1; ly <= n; ly++) F.set(sx, y0 + ly, sz, this.roles.stairs);
          F.set(sx, y0 + n + 1, sz, withShape(this.roles.stairs, makeShape('stairs', stair.side)));
          holes.push([sx, y0 + STOREY_H, sz]);
          if (stair.kind === 'roof') holes.push([sx, y0 + STOREY_H + 1, sz]);
        }
      }

      // Roof.
      if (!above) {
        const pitched = tone === 7;
        const roofY = y0 + STOREY_H;
        for (let lz = 0; lz < CELL; lz++) for (let lx = 0; lx < CELL; lx++) F.set(x0 + lx, roofY, z0 + lz, pitched ? this.roles.roof : this.roles.floor);
        if (pitched) this.pitchedRoof(F, plan, i, j, k);
        else {
          this.parapet(F, plan, i, j, k, wall);
          roofSpots.push({ x: this.plot.minX + x0 + 2, y: PLOT_Y + roofY + 1, z: this.plot.minZ + z0 + 2 });
          if (this.tech && !stair && hash(i, j, k, 7) % 3 === 0) F.set(x0 + 3, roofY + 1, z0 + 1, withShape(this.roles.pillar, 0));
        }
      }

      // Arcade under an overhang.
      if (k > 0 && !below) this.arcade(F, plan, i, j, k);

      // Cover crates in wide halls (never over a stairwell or on a stair).
      if (!stair && !stairs.has(Plan.index(i, j, k - 1)) && this.inWideHall(plan, i, j, k) && hash(i, j, k, 3) % 3 === 0) {
        const cx = hash(i, j, k, 4) % 2 === 0 ? 1 : 3;
        const cz = hash(i, j, k, 5) % 2 === 0 ? 1 : 3;
        F.set(x0 + cx, y0 + 1, z0 + cz, this.roles.floor);
        F.set(x0 + cx, y0 + 1, z0 + cz + (cz === 1 ? 1 : -1), this.roles.floor);
      }

      let enclosure = 0;
      for (const [dx, dz] of SIDES) if (plan.has(i + dx, j + dz, k)) enclosure++;
      roomBase.push({ i, j, k, tone, depth: k * 3 + enclosure + (above ? 2 : 0) });
    }

    // ---- 5. Stairwell holes, then room floors.
    for (const [x, y, z] of holes) F.set(x, y, z, 0);
    const rooms: RoomInfo[] = roomBase.map((r) => {
      const x0 = r.i * CELL;
      const z0 = r.j * CELL;
      const y0 = r.k * STOREY_H;
      const floor: Cell[] = [];
      for (let lz = 1; lz < CELL - 1; lz++)
        for (let lx = 1; lx < CELL - 1; lx++) {
          if (F.get(x0 + lx, y0, z0 + lz) !== 0 && F.get(x0 + lx, y0 + 1, z0 + lz) === 0 && F.get(x0 + lx, y0 + 2, z0 + lz) === 0) floor.push({ x: this.plot.minX + x0 + lx, y: PLOT_Y + y0 + 1, z: this.plot.minZ + z0 + lz });
        }
      return { ...r, floor };
    });

    let blocks = 0;
    for (let n = 0; n < F.data.length; n++) if (F.data[n]) blocks++;
    const stairList = [...stairs.entries()].map(([idx, st]) => {
      const [i, j, k] = Plan.coords(idx);
      return { i, j, k, side: st.side, kind: st.kind };
    });
    return { field: F.data, blocks, rooms, entrances, roofSpots, stairs: stairList };
  }

  // ------------------------------------------------------------------ helpers
  /** Picks `want` cells spread apart (deterministic farthest-first). */
  private pickSpread(cands: number[], want: number, seed: number): number[] {
    const sorted = [...cands].sort((a, b) => hash(a, seed, 1) - hash(b, seed, 1));
    const out: number[] = [sorted[0]];
    while (out.length < Math.min(want, cands.length)) {
      let best = -1;
      let bestD = -1;
      for (const c of sorted) {
        if (out.includes(c)) continue;
        const [cx, cz] = Plan.coords(c);
        let d = Infinity;
        for (const o of out) {
          const [ox, oz] = Plan.coords(o);
          d = Math.min(d, Math.abs(ox - cx) + Math.abs(oz - cz));
        }
        if (d > bestD) {
          bestD = d;
          best = c;
        }
      }
      if (best < 0) break;
      out.push(best);
    }
    return out;
  }

  /** Field coordinates of column c (0..4) and row ly on side s of the block at local origin (x0,y0,z0). */
  private faceCell(x0: number, y0: number, z0: number, s: number, c: number, ly: number): [number, number, number] {
    switch (s) {
      case 0: return [x0 + c, y0 + ly, z0];
      case 1: return [x0 + CELL - 1, y0 + ly, z0 + c];
      case 2: return [x0 + CELL - 1 - c, y0 + ly, z0 + CELL - 1];
      default: return [x0, y0 + ly, z0 + CELL - 1 - c];
    }
  }

  /** The three step cells of a stair leaning on side s, one cell inward from the wall, in climbing order. */
  private stairRun(i: number, j: number, k: number, s: number): [number, number][] {
    const x0 = i * CELL;
    const z0 = j * CELL;
    const [dx, dz] = SIDES[s];
    const run: [number, number][] = [];
    for (let c = 1; c <= 3; c++) {
      const [fx, , fz] = this.faceCell(x0, 0, z0, s, c, 0);
      run.push([fx - dx, fz - dz]);
    }
    void k;
    return run;
  }

  private faceFor(plan: Plan, i: number, j: number, k: number, s: number, tone: Tone, exterior: boolean, door: boolean, noBalcony = false): Face | null {
    const base: Face = { cols: [], rows: [], extra: [], glassCols: [], door: false, balcony: false, frame: false };
    if (door) {
      if (exterior) return { ...base, cols: [1, 2, 3], rows: [1, 2], extra: [[2, 3]], door: true, frame: true };
      return { ...base, cols: [1, 2], rows: [1, 2, 3] };
    }
    if (!exterior) return { ...base, cols: [1, 2], rows: [1, 2, 3] };
    const [dx, dz] = SIDES[s];
    if (!noBalcony && k >= 1 && s === this.frontSide && Plan.inside(i + dx, j + dz, k) && !plan.has(i + dx, j + dz, k) && !plan.has(i + dx, j + dz, k - 1) && hash(i, j, k, 9) % 2 === 0) {
      return { ...base, cols: [2], rows: [1, 2], balcony: true };
    }
    if (tone === 4 || this.tech) return { ...base, cols: [2], rows: [2, 3], glassCols: [1, 3] };
    if (k === 0) return { ...base, cols: [1, 3], rows: [2] };
    if (this.castle) return { ...base, cols: [1, 3], rows: [2, 3] };
    return { ...base, cols: [1, 3], rows: [2, 3], extra: [[2, 3]] };
  }

  /** Two-deep terrace outside the wall with a railing, entered through the single door of the face. */
  private balcony(F: Field, x0: number, y0: number, z0: number, s: number): void {
    const [dx, dz] = SIDES[s];
    for (let c = 1; c <= 3; c++) {
      const [fx, , fz] = this.faceCell(x0, y0, z0, s, c, 0);
      for (let d = 1; d <= 2; d++) {
        const bx = fx + dx * d;
        const bz = fz + dz * d;
        if (!F.inside(bx, y0, bz)) continue;
        F.set(bx, y0, bz, this.roles.trim);
        if (d === 2) F.set(bx, y0 + 1, bz, withShape(this.roles.trim, Shape.FENCE));
      }
    }
  }

  private parapet(F: Field, plan: Plan, i: number, j: number, k: number, wall: number): void {
    const x0 = i * CELL;
    const z0 = j * CELL;
    const y = k * STOREY_H + STOREY_H + 1;
    for (let s = 0; s < 4; s++) {
      const [dx, dz] = SIDES[s];
      if (plan.has(i + dx, j + dz, k + 1)) continue; // a taller neighbour's wall stands here
      if (plan.has(i + dx, j + dz, k) && plan.tone(i + dx, j + dz, k) !== 7) continue; // the terrace continues
      for (let c = 0; c < CELL; c++) {
        const [fx, , fz] = this.faceCell(x0, 0, z0, s, c, 0);
        const corner = c === 0 || c === CELL - 1;
        const v = this.castle ? (corner || c % 2 === 0 ? wall : 0) : corner ? this.roles.trim : withShape(this.roles.trim, Shape.FENCE);
        if (F.get(fx, y, fz) === 0) F.set(fx, y, fz, v);
      }
    }
  }

  private pitchedRoof(F: Field, plan: Plan, i: number, j: number, k: number): void {
    const x0 = i * CELL;
    const z0 = j * CELL;
    const base = k * STOREY_H + STOREY_H;
    const shared = (s: number): boolean => {
      const [dx, dz] = SIDES[s];
      return plan.has(i + dx, j + dz, k) && !plan.has(i + dx, j + dz, k + 1) && plan.tone(i + dx, j + dz, k) === 7;
    };
    for (let layer = 1; layer <= 2; layer++) {
      const y = base + layer;
      const zLo = shared(0) ? 0 : layer;
      const zHi = shared(2) ? CELL - 1 : CELL - 1 - layer;
      const xLo = shared(3) ? 0 : layer;
      const xHi = shared(1) ? CELL - 1 : CELL - 1 - layer;
      for (let lz = zLo; lz <= zHi; lz++)
        for (let lx = xLo; lx <= xHi; lx++) {
          const eN = lz === zLo && !shared(0);
          const eS = lz === zHi && !shared(2);
          const eW = lx === xLo && !shared(3);
          const eE = lx === xHi && !shared(1);
          const edges = (eN ? 1 : 0) + (eS ? 1 : 0) + (eW ? 1 : 0) + (eE ? 1 : 0);
          let shape = 0;
          if (edges === 1) shape = eE ? makeShape('slope', 2) : eW ? makeShape('slope', 0) : eS ? makeShape('slope', 3) : makeShape('slope', 1);
          F.set(x0 + lx, y, z0 + lz, withShape(this.roles.roof, shape));
        }
    }
    if (!shared(0) && !shared(1) && !shared(2) && !shared(3)) F.set(x0 + 2, base + 3, z0 + 2, withShape(this.roles.trim, Shape.PILLAR));
  }

  /** Beam and corner pillars under a block that has nothing beneath it. */
  private arcade(F: Field, plan: Plan, i: number, j: number, k: number): void {
    const x0 = i * CELL;
    const z0 = j * CELL;
    const y0 = k * STOREY_H;
    for (let s = 0; s < 4; s++) {
      const [dx, dz] = SIDES[s];
      if (plan.has(i + dx, j + dz, k - 1)) continue;
      for (let c = 0; c < CELL; c++) {
        const [fx, , fz] = this.faceCell(x0, 0, z0, s, c, 0);
        if (F.get(fx, y0 - 1, fz) === 0) F.set(fx, y0 - 1, fz, withShape(this.roles.trim, Shape.SLAB_TOP));
      }
    }
    for (const [lx, lz] of [[0, 0], [CELL - 1, 0], [0, CELL - 1], [CELL - 1, CELL - 1]] as [number, number][]) {
      F.set(x0 + lx, y0 - 1, z0 + lz, withShape(this.roles.pillar, 0)); // capital
      for (let y = y0 - 2; y >= 0; y--) {
        if (F.get(x0 + lx, y, z0 + lz) !== 0) break;
        F.set(x0 + lx, y, z0 + lz, withShape(this.roles.pillar, Shape.PILLAR));
      }
    }
  }

  private inWideHall(plan: Plan, i: number, j: number, k: number): boolean {
    const tone = plan.tone(i, j, k);
    let same = 0;
    for (const [dx, dz] of SIDES) if (plan.has(i + dx, j + dz, k) && plan.tone(i + dx, j + dz, k) === tone) same++;
    return same >= 2;
  }
}

/** Applies a generated field to the world inside the plot, returning the cells that changed. */
export function applyField(world: { get(x: number, y: number, z: number): number; set(x: number, y: number, z: number, v: number): boolean }, plot: Plot, field: Uint16Array): Cell[] {
  const changed: Cell[] = [];
  for (let y = 0; y < FIELD_H; y++)
    for (let z = 0; z < PLOT_W; z++)
      for (let x = 0; x < PLOT_W; x++) {
        const v = field[(y * PLOT_W + z) * PLOT_W + x];
        const wx = plot.minX + x;
        const wy = PLOT_Y + y;
        const wz = plot.minZ + z;
        if (world.get(wx, wy, wz) !== v) {
          world.set(wx, wy, wz, v);
          changed.push({ x: wx, y: wy, z: wz });
        }
      }
  return changed;
}
