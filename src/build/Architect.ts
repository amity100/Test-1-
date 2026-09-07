import type { Plot } from '../world/Layout';
import { PLOT_Y } from '../world/Layout';
import { STYLES, type StyleId, type BlockRole } from '../world/Styles';
import { Shape, makeShape, withShape, blockColor } from '../world/Voxel';
import type { Cell } from '../world/Reachability';

/**
 * The Architect turns a coarse plan of room blocks (tap a cell, get a building) into finished,
 * connected voxel architecture. Players and bots only decide *where* blocks go and which of eight
 * tones each block has; everything else is derived from the neighbourhood:
 *
 *  - walls, windows, doors, quoins, trims, plinths and lamps;
 *  - stairs between every storey and up to every flat roof (fighting platforms with parapets);
 *  - a grand outdoor stair on the approach side of a two-storey facade;
 *  - terrace doors wherever a room stands beside a lower roof;
 *  - bridges (with railings and arches underneath) between same-tone rooms across a gap;
 *  - courtyards with paving, a fountain or pylon, lamp posts and doors when a ground cell is
 *    enclosed on three or four sides;
 *  - open colonnades for the dark tone, pitched roofs with chimneys for the roof tone;
 *  - crowns on free-standing towers (machicolations and merlons, or an antenna with a beacon).
 *
 * Every structure is therefore both good looking and playable: rooms join their neighbours, every
 * floor and roof can be walked to, and the ground floor always has entrances.
 */

/** Room block footprint in metres (interiors are CELL-2 wide: six metres of fighting room). */
export const CELL = 8;
/** Storey height in rows (slab + three clear rows). */
export const STOREY_H = 4;
/** Cells per plot side (40 m plot). */
export const GRID = 5;
export const MAX_STOREYS = 8;
/** Rows of the voxel field above the plot floor (the highest parapet or spire fits). */
export const FIELD_H = MAX_STOREYS * STOREY_H + 4;
export const PLOT_W = GRID * CELL;
export const TONES = 8;
/** How many room blocks a fortress may hold. */
export const MAX_BLOCKS = 48;
/** Middle column of a face; interiors span columns 1..CELL-2. */
const MID = CELL >> 1;
/** First of the three stair-run columns (centred on the face). */
const RUN0 = MID - 1;
/** Layers of a pitched roof, each inset by one from the last. */
const ROOF_LAYERS = (CELL - 2) >> 1;
/** Tone whose exterior walls become open colonnades. */
export const COLONNADE_TONE = 5;
/** Tone that gets a pitched roof. */
export const ROOF_TONE = 7;

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

export interface BridgeInfo {
  i: number;
  j: number;
  k: number;
  side: number;
  length: number;
  /** Deck centres (feet level, world coordinates). */
  deck: Cell[];
}

export interface ArchitectResult {
  field: Uint16Array;
  /** Solid voxels in the field. */
  blocks: number;
  rooms: RoomInfo[];
  /** Ways in from outside as world cells at the doorway threshold (feet level). */
  entrances: Cell[];
  /** Roof terrace and bridge deck centres (feet level, world coordinates). */
  roofSpots: Cell[];
  /** Where stairs were placed (debug and tests). */
  stairs: { i: number; j: number; k: number; side: number; kind: 'up' | 'roof' }[];
  bridges: BridgeInfo[];
  /** Courtyard cells (ground storey) and whether they open to the outside. */
  courts: { i: number; j: number; open: boolean }[];
  /** Grand outdoor stairs: the ground block they lean on, the side and the cell they occupy. */
  outerStairs: { i: number; j: number; side: number; cell: [number, number] }[];
  terraceDoors: number;
  /** Free-standing towers that received a crown. */
  crowns: number;
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
  /** Open colonnade: corner posts, a slender centre pillar, everything else air. */
  colonnade: boolean;
  /** Knee-high rail in the colonnade openings (upper storeys). */
  rail: boolean;
}

interface StairPlan {
  side: number;
  /** Local (x,z) of the three steps, in climbing order. */
  run: [number, number][];
  kind: 'up' | 'roof';
}

/** Everything derived from the plan before carving (doors and reservations). */
interface Derived {
  doors: Map<number, Set<number>>;
  terrace: Set<string>;
  court: Set<string>;
  outer: Set<string>;
  bridgeDoor: Set<string>;
  blind: Set<string>;
  /** Ground cells taken by outdoor stairs (plan index at k = 0). */
  reserved: Set<number>;
  /** Bridge deck cells (plan index). */
  deck: Set<number>;
  courtOpen: Map<number, boolean>;
  bridges: { i: number; j: number; k: number; side: number; length: number }[];
  outerStairs: { i: number; j: number; side: number; cell: [number, number] }[];
}

const CASTLE_STYLES: StyleId[] = ['medieval', 'gothic', 'desert'];
/** Interior roof cells in order of preference for the terrace spot (centre first). */
const ROOF_SPOT_PREFS: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let lz = 1; lz < CELL - 1; lz++) for (let lx = 1; lx < CELL - 1; lx++) out.push([lx, lz]);
  const c = (CELL - 1) / 2;
  return out.sort((a, b) => Math.hypot(a[0] - c, a[1] - c) - Math.hypot(b[0] - c, b[1] - c));
})();
const TECH_STYLES: StyleId[] = ['modern', 'neon'];

function hash(a: number, b: number, c: number, d = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647 + d * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

const faceKey = (idx: number, s: number): string => `${idx}:${s}`;

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

/**
 * Upper components that stand on nothing: a group of blocks on storey k >= 1 without a single
 * block beneath any of its cells. Such rooms cannot receive stairs, so editors refuse to create them.
 */
export function floatingComponents(plan: Plan): number[][] {
  const out: number[][] = [];
  for (let k = 1; k < MAX_STOREYS; k++) {
    for (const cells of components(plan, k)) {
      const supported = cells.some((idx) => {
        const [i, j] = Plan.coords(idx);
        return plan.has(i, j, k - 1);
      });
      if (!supported) out.push(cells);
    }
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
  /** Writes only into air. */
  fill(x: number, y: number, z: number, v: number): void {
    if (this.inside(x, y, z) && this.data[this.idx(x, y, z)] === 0) this.data[this.idx(x, y, z)] = v;
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
    const v = tone === ROOF_TONE ? this.roles.roof : this.wallValue(tone);
    return palette[blockColor(v)] ?? '#888888';
  }

  private world(x: number, y: number, z: number): Cell {
    return { x: this.plot.minX + x, y: PLOT_Y + y, z: this.plot.minZ + z };
  }

  // ------------------------------------------------------------------ generation
  generate(plan: Plan): ArchitectResult {
    const F = new Field();
    const D = this.derive(plan);
    const hasDoor = (idx: number, side: number): boolean => D.doors.get(idx)?.has(side) ?? false;

    // ---- Stairs: each upper component is reached from below; each top component reaches its roof.
    const stairs = new Map<number, StairPlan>();
    const cellKey = (c: [number, number]): string => `${c[0]},${c[1]}`;
    const planStair = (idx: number, kind: 'up' | 'roof'): void => {
      const [i, j, k] = Plan.coords(idx);
      const tone = plan.tone(i, j, k);
      const lower = stairs.get(Plan.index(i, j, k - 1)) ?? null;
      let best = -1;
      let bestScore = -Infinity;
      // Placements 0..3 lean on a wall; 4..7 run through the middle of the room (climbing +X, +Z,
      // -X, -Z) and are the fallback when every wall has a doorway.
      for (let s = 0; s < 8; s++) {
        let score = 0;
        let exterior = false;
        let merged = false;
        if (s < 4) {
          const [dx, dz] = SIDES[s];
          exterior = !plan.has(i + dx, j + dz, k);
          merged = !exterior && plan.tone(i + dx, j + dz, k) === tone;
          // Blocking a doorway or an open colonnade with the run is bad; breaking the stair below is fatal.
          if (hasDoor(idx, s)) score -= 1000;
          if (this.isColonnade(plan, i, j, k, s, tone)) score -= 1000;
        } else score -= 200;
        const run = this.stairRun(i, j, s);
        if (lower) {
          // The stair below climbs through this floor: its second and third steps need head room
          // above them, its exit hole must keep a floor cell beside it, and this stair's first step
          // must itself be approachable from real floor rather than from a hole.
          const lowerCells = new Set(lower.run.map(cellKey));
          const fatal = new Set([cellKey(lower.run[1]), cellKey(lower.run[2])]);
          const runCells = new Set(run.map(cellKey));
          const exits = this.approaches(i, j, lower.run[2], lower.run[1]);
          const approaches = this.approaches(i, j, run[0], run[1]);
          let bad = run.some((c) => fatal.has(cellKey(c)));
          if (exits.every((c) => runCells.has(cellKey(c)))) bad = true;
          if (approaches.every((c) => lowerCells.has(cellKey(c)))) bad = true;
          if (bad) score -= 100000;
          else if (run.some((c) => lowerCells.has(cellKey(c)))) score -= 30;
          if (s < 4 && lower.side < 4 && s === (lower.side + 2) % 4) score += 50;
        }
        if (s < 4 && !merged) score += 3; // lean the stair on a real wall
        score += (hash(i, j, k, s + 20) % 10) / 10;
        if (score > bestScore) {
          bestScore = score;
          best = s;
        }
      }
      stairs.set(idx, { side: best, run: this.stairRun(i, j, best), kind });
    };
    for (let k = 1; k < MAX_STOREYS; k++) {
      for (const cells of components(plan, k)) {
        const candidates = cells.filter((idx) => {
          const [i, j] = Plan.coords(idx);
          return plan.has(i, j, k - 1) && !stairs.has(Plan.index(i, j, k - 1));
        });
        if (candidates.length === 0) continue;
        const want = 1 + Math.floor((cells.length - 1) / 4);
        for (const idx of this.pickSpread(candidates, want, k)) planStair(idx - GRID * GRID, 'up');
      }
    }
    // Every continuous roof terrace (adjacent tops of one storey, taller blocks split them) gets its
    // own roof stair, so no terrace depends on a door from elsewhere.
    for (let k = 0; k < MAX_STOREYS; k++) {
      for (const tops of this.terraces(plan, k)) {
        const cands = tops.filter((idx) => !stairs.has(idx));
        if (cands.length === 0) continue;
        const want = 1 + Math.floor((cands.length - 1) / 5);
        for (const idx of this.pickSpread(cands, want, k + 100)) planStair(idx, 'roof');
      }
    }

    // ---- Carve every block.
    const holes: [number, number, number][] = [];
    const entrances: Cell[] = [];
    const roofSpots: Cell[] = [];
    const roomBase: { i: number; j: number; k: number; tone: Tone; depth: number }[] = [];
    let crowns = 0;
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
      const lamps: [number, number, number][] = [];
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
        const key = faceKey(idx, s);
        const face = this.faceFor(plan, D, i, j, k, s, tone, exterior, hasDoor(idx, s), stair?.side === s);
        for (let c = 0; c < CELL; c++) {
          for (let ly = 1; ly < STOREY_H; ly++) {
            let v = wall;
            if (face?.colonnade) {
              if (c === 0 || c === CELL - 1) v = wall;
              else if (c === 2) v = withShape(this.roles.pillar, Shape.PILLAR);
              else v = face.rail && ly === 1 ? withShape(this.roles.trim, Shape.SLAB) : 0;
            } else {
              const open = face !== null && ((face.cols.includes(c) && face.rows.includes(ly)) || face.extra.some(([ec, er]) => ec === c && er === ly));
              if (open) v = 0;
              else if (face && face.glassCols.includes(c)) v = this.roles.glass;
              else if (face && face.frame && (c === face.cols[0] - 1 || c === face.cols[face.cols.length - 1] + 1) && ly <= Math.max(...face.rows) + 1) v = this.roles.trim;
              else if (exterior && tone === 0 && (c === 0 || c === CELL - 1)) v = this.roles.wallAlt; // quoins
            }
            F.set(...this.faceCell(x0, y0, z0, s, c, ly), v);
          }
        }
        if (!exterior || !face) continue;
        const chosenDoor = hasDoor(idx, s);
        if (face.colonnade) {
          // An open colonnade picked as an entrance is one: register the threshold behind a bay.
          if (k === 0 && chosenDoor && !D.court.has(key)) entrances.push(this.world(...this.faceCell(x0, y0, z0, s, 1, 1)));
          continue;
        }
        if (face.door) {
          const [fx, fy, fz] = this.faceCell(x0, y0, z0, s, MID, 1);
          const court = D.court.has(key);
          if (k === 0) {
            // Doors onto a closed courtyard are interior; everything else at ground level is a way in.
            if (!court || D.courtOpen.get(Plan.index(i + dx, j + dz, 0)) === true) entrances.push(this.world(fx, fy, fz));
            // A step outside the sill.
            for (const c of face.cols) {
              const [cx, , cz] = this.faceCell(x0, y0, z0, s, c, 1);
              F.fill(cx + dx, 0, cz + dz, withShape(this.roles.stairs, makeShape('stairs', (s + 1) % 4)));
            }
          } else if (D.outer.has(key)) {
            entrances.push(this.world(fx, fy, fz));
          }
          // Lamps flank the doorway (set once every face is written so a corner post keeps its lamp).
          lamps.push(this.faceCell(x0, y0, z0, s, 0, 2), this.faceCell(x0, y0, z0, s, CELL - 1, 2));
        }
        if (face.balcony) this.balcony(F, x0, y0, z0, s);
      }
      for (const [lx, ly, lz] of lamps) if (F.get(lx, ly, lz) !== 0) F.set(lx, ly, lz, this.roles.light);

      // Stairs.
      if (stair) {
        // The stairwell opening spans the whole run: climbing a step needs head room one row above
        // the head (the navigation rule for a jump), so even the first step's column stays open.
        for (let n = 0; n < 3; n++) {
          const [sx, sz] = stair.run[n];
          for (let ly = 1; ly <= n; ly++) F.set(sx, y0 + ly, sz, this.roles.stairs);
          F.set(sx, y0 + n + 1, sz, withShape(this.roles.stairs, makeShape('stairs', stair.side % 4)));
          holes.push([sx, y0 + STOREY_H, sz]);
          if (stair.kind === 'roof') holes.push([sx, y0 + STOREY_H + 1, sz]);
        }
      }

      // Roof.
      if (!above) {
        const pitched = tone === ROOF_TONE;
        const roofY = y0 + STOREY_H;
        for (let lz = 0; lz < CELL; lz++) for (let lx = 0; lx < CELL; lx++) F.set(x0 + lx, roofY, z0 + lz, pitched ? this.roles.roof : this.roles.floor);
        if (pitched) this.pitchedRoof(F, plan, i, j, k);
        else {
          this.parapet(F, plan, i, j, k, wall);
          const crown = k >= 1 && this.isolated(plan, i, j, k) && below && this.isolated(plan, i, j, k - 1);
          if (crown) {
            crowns++;
            this.crown(F, x0, roofY, z0, wall);
          }
          // The terrace spot must be real floor: never over the roof stair's hole or under a mast.
          const runCells = new Set(stair ? stair.run.map(([rx, rz]) => `${rx},${rz}`) : []);
          const spot = ROOF_SPOT_PREFS.find(([lx, lz]) => !runCells.has(`${x0 + lx},${z0 + lz}`) && !(crown && !this.castle && lx === MID && lz === MID)) ?? [MID, MID];
          roofSpots.push(this.world(x0 + spot[0], roofY + 1, z0 + spot[1]));
          if (this.tech && !stair && !crown && hash(i, j, k, 7) % 3 === 0) F.set(x0 + CELL - 3, roofY + 1, z0 + 1, withShape(this.roles.pillar, 0));
        }
      }

      // Arcade under an overhang.
      if (k > 0 && !below) {
        const open: number[] = [];
        for (let s = 0; s < 4; s++) if (!plan.has(i + SIDES[s][0], j + SIDES[s][1], k - 1)) open.push(s);
        this.undercroft(F, x0, y0, z0, open);
      }

      // Cover crates in wide halls (never over a stairwell or on a stair).
      if (!stair && !stairs.has(Plan.index(i, j, k - 1)) && this.inWideHall(plan, i, j, k) && hash(i, j, k, 3) % 3 === 0) {
        const cx = hash(i, j, k, 4) % 2 === 0 ? 1 : CELL - 2;
        const cz = hash(i, j, k, 5) % 2 === 0 ? 1 : CELL - 2;
        F.set(x0 + cx, y0 + 1, z0 + cz, this.roles.floor);
        F.set(x0 + cx, y0 + 1, z0 + cz + (cz === 1 ? 1 : -1), this.roles.floor);
      }

      let enclosure = 0;
      for (const [dx, dz] of SIDES) if (plan.has(i + dx, j + dz, k)) enclosure++;
      roomBase.push({ i, j, k, tone, depth: k * 3 + enclosure + (above ? 2 : 0) });
    }

    // ---- Derived structures: bridges, courtyards, outdoor stairs.
    const bridges: BridgeInfo[] = [];
    for (const b of D.bridges) {
      const deck = this.bridge(F, b);
      for (const c of deck) roofSpots.push(c);
      bridges.push({ ...b, deck });
    }
    const courts: ArchitectResult['courts'] = [];
    for (const [cidx, open] of D.courtOpen) {
      const [ci, cj] = Plan.coords(cidx);
      this.courtyard(F, ci, cj);
      courts.push({ i: ci, j: cj, open });
    }
    for (const st of D.outerStairs) this.outerStair(F, st);

    // ---- Stairwell holes, then room floors.
    for (const [x, y, z] of holes) F.set(x, y, z, 0);
    const rooms: RoomInfo[] = roomBase.map((r) => {
      const x0 = r.i * CELL;
      const z0 = r.j * CELL;
      const y0 = r.k * STOREY_H;
      const floor: Cell[] = [];
      for (let lz = 1; lz < CELL - 1; lz++)
        for (let lx = 1; lx < CELL - 1; lx++) {
          if (F.get(x0 + lx, y0, z0 + lz) !== 0 && F.get(x0 + lx, y0 + 1, z0 + lz) === 0 && F.get(x0 + lx, y0 + 2, z0 + lz) === 0) floor.push(this.world(x0 + lx, y0 + 1, z0 + lz));
        }
      return { ...r, floor };
    });

    let blocks = 0;
    for (let n = 0; n < F.data.length; n++) if (F.data[n]) blocks++;
    const stairList = [...stairs.entries()].map(([idx, st]) => {
      const [i, j, k] = Plan.coords(idx);
      return { i, j, k, side: st.side, kind: st.kind };
    });
    return { field: F.data, blocks, rooms, entrances, roofSpots, stairs: stairList, bridges, courts, outerStairs: D.outerStairs, terraceDoors: D.terrace.size, crowns };
  }

  // ------------------------------------------------------------------ derivation
  /** Doors and reservations that the carving pass and the stair planner both respect. */
  private derive(plan: Plan): Derived {
    const D: Derived = {
      doors: new Map(),
      terrace: new Set(),
      court: new Set(),
      outer: new Set(),
      bridgeDoor: new Set(),
      blind: new Set(),
      reserved: new Set(),
      deck: new Set(),
      courtOpen: new Map(),
      bridges: [],
      outerStairs: [],
    };
    const addDoor = (idx: number, side: number): void => {
      if (!D.doors.has(idx)) D.doors.set(idx, new Set());
      D.doors.get(idx)!.add(side);
    };
    const count = plan.count();

    // ---- 0. Grand outdoor stairs: a two-storey facade with a free cell in front, preferably on the
    // approach side, gets a broad flight up to a first-floor door.
    const stairCands: { i: number; j: number; side: number; score: number; n: [number, number] }[] = [];
    for (let j = 0; j < GRID; j++)
      for (let i = 0; i < GRID; i++) {
        if (!plan.has(i, j, 0) || !plan.has(i, j, 1)) continue;
        for (let s = 0; s < 4; s++) {
          const [dx, dz] = SIDES[s];
          const ni = i + dx;
          const nj = j + dz;
          if (!Plan.inside(ni, nj, 0) || plan.has(ni, nj, 0) || plan.has(ni, nj, 1) || plan.has(ni, nj, 2)) continue;
          let score = s === this.frontSide ? 10 : (s + 2) % 4 === this.frontSide ? 1 : 5;
          if (!Plan.inside(ni + dx, nj + dz, 0) || !plan.has(ni + dx, nj + dz, 0)) score += 2; // open approach beyond the flight
          score += (hash(i, j, s, 31) % 100) / 100;
          stairCands.push({ i, j, side: s, score, n: [ni, nj] });
        }
      }
    stairCands.sort((a, b) => b.score - a.score);
    const wantOuter = count >= 16 ? 2 : count >= 2 ? 1 : 0;
    for (const c of stairCands) {
      if (D.outerStairs.length >= wantOuter) break;
      if (D.outerStairs.some((o) => (o.i === c.i && o.j === c.j) || (o.cell[0] === c.n[0] && o.cell[1] === c.n[1]))) continue;
      D.outerStairs.push({ i: c.i, j: c.j, side: c.side, cell: c.n });
      D.reserved.add(Plan.index(c.n[0], c.n[1], 0));
      D.blind.add(faceKey(Plan.index(c.i, c.j, 0), c.side));
      addDoor(Plan.index(c.i, c.j, 1), c.side);
      D.outer.add(faceKey(Plan.index(c.i, c.j, 1), c.side));
    }
    const reservedAt = (i: number, j: number): boolean => Plan.inside(i, j, 0) && D.reserved.has(Plan.index(i, j, 0));

    // ---- 1. Entrances: every ground component gets a gate towards the front plus more doors.
    for (const cells of components(plan, 0)) {
      const faces: { idx: number; side: number; score: number }[] = [];
      for (const idx of cells) {
        const [i, j] = Plan.coords(idx);
        for (let s = 0; s < 4; s++) {
          const [dx, dz] = SIDES[s];
          if (plan.has(i + dx, j + dz, 0)) continue;
          if (D.blind.has(faceKey(idx, s)) || reservedAt(i + dx, j + dz)) continue;
          let score = s === this.frontSide ? 10 : (s + 2) % 4 === this.frontSide ? 2 : 5;
          if (!Plan.inside(i + dx, j + dz, 0)) score += 3; // opens straight onto the field
          if (plan.has(i + dx, j + dz, 1)) score -= 1; // under an overhang
          score += (hash(i, j, s) % 100) / 100;
          faces.push({ idx, side: s, score });
        }
      }
      faces.sort((a, b) => b.score - a.score);
      const want = cells.length >= 6 ? 3 : 2;
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

    // ---- 3. Terrace doors: a room beside a lower flat roof opens onto it.
    for (const [i, j, k] of plan.occupied()) {
      if (k === 0) continue;
      for (let s = 0; s < 4; s++) {
        const [dx, dz] = SIDES[s];
        const ni = i + dx;
        const nj = j + dz;
        if (!Plan.inside(ni, nj, k) || plan.has(ni, nj, k) || !plan.has(ni, nj, k - 1) || plan.tone(ni, nj, k - 1) === ROOF_TONE) continue;
        const idx = Plan.index(i, j, k);
        addDoor(idx, s);
        D.terrace.add(faceKey(idx, s));
      }
    }

    // ---- 4. Bridges: same-tone rooms facing each other across one or two empty cells.
    for (const [i, j, k] of plan.occupied()) {
      if (k === 0) continue;
      const tone = plan.tone(i, j, k);
      for (const s of [1, 2]) {
        const [dx, dz] = SIDES[s];
        const free = (n: number): boolean => {
          const ci = i + dx * n;
          const cj = j + dz * n;
          return Plan.inside(ci, cj, k) && !plan.has(ci, cj, k) && !plan.has(ci, cj, k - 1) && !(k === 1 && reservedAt(ci, cj));
        };
        const end = (n: number): boolean => {
          const ci = i + dx * n;
          const cj = j + dz * n;
          return Plan.inside(ci, cj, k) && plan.has(ci, cj, k) && plan.tone(ci, cj, k) === tone;
        };
        let length = 0;
        if (free(1) && end(2)) length = 1;
        else if (free(1) && free(2) && end(3)) length = 2;
        if (!length) continue;
        const idx = Plan.index(i, j, k);
        const endIdx = Plan.index(i + dx * (length + 1), j + dz * (length + 1), k);
        addDoor(idx, s);
        addDoor(endIdx, (s + 2) % 4);
        D.bridgeDoor.add(faceKey(idx, s));
        D.bridgeDoor.add(faceKey(endIdx, (s + 2) % 4));
        for (let n = 1; n <= length; n++) D.deck.add(Plan.index(i + dx * n, j + dz * n, k));
        D.bridges.push({ i, j, k, side: s, length });
      }
    }

    // ---- 5. Courtyards: an empty ground cell enclosed on three or four sides.
    for (let j = 0; j < GRID; j++)
      for (let i = 0; i < GRID; i++) {
        if (plan.has(i, j, 0) || reservedAt(i, j)) continue;
        const enclosing: number[] = [];
        for (let s = 0; s < 4; s++) if (plan.has(i + SIDES[s][0], j + SIDES[s][1], 0)) enclosing.push(s);
        if (enclosing.length < 3) continue;
        D.courtOpen.set(Plan.index(i, j, 0), enclosing.length === 3);
        for (const s of enclosing) {
          const nIdx = Plan.index(i + SIDES[s][0], j + SIDES[s][1], 0);
          const facing = (s + 2) % 4;
          addDoor(nIdx, facing);
          D.court.add(faceKey(nIdx, facing));
        }
      }
    return D;
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

  /**
   * The three step cells of a stair in climbing order: placements 0..3 lean on that wall one cell
   * inward, placements 4..7 run through the middle of the room climbing +X, +Z, -X, -Z.
   */
  private stairRun(i: number, j: number, s: number): [number, number][] {
    const x0 = i * CELL;
    const z0 = j * CELL;
    const run: [number, number][] = [];
    if (s >= 4) {
      // Middle placements climb along the shape facing (+X, +Z, -X, -Z), so the run is listed from
      // the low end to the high end in that direction.
      const dir = s - 4;
      for (let n = 0; n < 3; n++) {
        const t = dir === 0 || dir === 1 ? RUN0 + n : RUN0 + 2 - n;
        run.push(dir === 0 || dir === 2 ? [x0 + t, z0 + MID] : [x0 + MID, z0 + t]);
      }
      return run;
    }
    const [dx, dz] = SIDES[s];
    for (let c = RUN0; c < RUN0 + 3; c++) {
      const [fx, , fz] = this.faceCell(x0, 0, z0, s, c, 0);
      run.push([fx - dx, fz - dz]);
    }
    return run;
  }

  /** Interior cells next to a step from which it can be climbed (walls and the next step excluded). */
  private approaches(i: number, j: number, step: [number, number], next: [number, number]): [number, number][] {
    const x0 = i * CELL;
    const z0 = j * CELL;
    const out: [number, number][] = [];
    for (const [dx, dz] of SIDES) {
      const c: [number, number] = [step[0] + dx, step[1] + dz];
      if (c[0] <= x0 || c[0] >= x0 + CELL - 1 || c[1] <= z0 || c[1] >= z0 + CELL - 1) continue;
      if (c[0] === next[0] && c[1] === next[1]) continue;
      out.push(c);
    }
    return out;
  }

  /** Connected groups of walkable roof cells on storey k: tops with nothing above and no pitched roof. */
  private terraces(plan: Plan, k: number): number[][] {
    const isTop = (i: number, j: number): boolean => plan.has(i, j, k) && !plan.has(i, j, k + 1) && plan.tone(i, j, k) !== ROOF_TONE;
    const seen = new Set<number>();
    const out: number[][] = [];
    for (let j = 0; j < GRID; j++)
      for (let i = 0; i < GRID; i++) {
        const start = Plan.index(i, j, k);
        if (!isTop(i, j) || seen.has(start)) continue;
        const group: number[] = [];
        const stack = [start];
        seen.add(start);
        while (stack.length) {
          const idx = stack.pop()!;
          group.push(idx);
          const [ci, cj] = Plan.coords(idx);
          for (const [dx, dz] of SIDES) {
            if (!isTop(ci + dx, cj + dz)) continue;
            const n = Plan.index(ci + dx, cj + dz, k);
            if (seen.has(n)) continue;
            seen.add(n);
            stack.push(n);
          }
        }
        out.push(group);
      }
    return out;
  }

  private isolated(plan: Plan, i: number, j: number, k: number): boolean {
    for (const [dx, dz] of SIDES) if (plan.has(i + dx, j + dz, k)) return false;
    return true;
  }

  /** A wall that becomes a colonnade: the dark tone on either side of a non-merged face. */
  private isColonnade(plan: Plan, i: number, j: number, k: number, s: number, tone: Tone): boolean {
    if (tone === COLONNADE_TONE) return true;
    const [dx, dz] = SIDES[s];
    return plan.has(i + dx, j + dz, k) && plan.tone(i + dx, j + dz, k) === COLONNADE_TONE;
  }

  private faceFor(plan: Plan, D: Derived, i: number, j: number, k: number, s: number, tone: Tone, exterior: boolean, door: boolean, noBalcony: boolean): Face | null {
    const base: Face = { cols: [], rows: [], extra: [], glassCols: [], door: false, balcony: false, frame: false, colonnade: false, rail: false };
    const idx = Plan.index(i, j, k);
    if (D.blind.has(faceKey(idx, s))) return null;
    if (this.isColonnade(plan, i, j, k, s, tone)) return { ...base, colonnade: true, rail: exterior && k >= 1 };
    // Openings are laid out around the middle of the face: gates and doorways four columns wide with
    // an arched top, windows two columns in from the corners.
    const gate: number[] = [MID - 2, MID - 1, MID, MID + 1];
    const arch: [number, number][] = [[MID - 1, 3], [MID, 3]];
    const win: number[] = [2, CELL - 3];
    if (door) {
      if (exterior) return { ...base, cols: gate, rows: [1, 2], extra: arch, door: true, frame: true };
      return { ...base, cols: gate, rows: [1, 2], extra: arch };
    }
    if (!exterior) return { ...base, cols: [MID - 1, MID], rows: [1, 2, 3] };
    const [dx, dz] = SIDES[s];
    const ni = i + dx;
    const nj = j + dz;
    const freeOutside = Plan.inside(ni, nj, k) && !plan.has(ni, nj, k) && !plan.has(ni, nj, k - 1) && !D.deck.has(Plan.index(ni, nj, k)) && !(k === 1 && D.reserved.has(Plan.index(ni, nj, 0)));
    if (!noBalcony && k >= 1 && s === this.frontSide && freeOutside && hash(i, j, k, 9) % 2 === 0) {
      return { ...base, cols: [MID - 1, MID, MID + 1], rows: [1, 2], balcony: true };
    }
    if (tone === 4 || this.tech) {
      const glassCols: number[] = [];
      for (let c = 1; c < CELL - 1; c++) if (c !== MID - 1 && c !== MID) glassCols.push(c);
      return { ...base, cols: [MID - 1, MID], rows: [2, 3], glassCols };
    }
    if (k === 0) return { ...base, cols: win, rows: [2] };
    if (this.castle) return { ...base, cols: win, rows: [2, 3] };
    return { ...base, cols: win, rows: [2, 3], extra: arch };
  }

  /** Two-deep terrace outside the wall with a railing, entered through the single door of the face. */
  private balcony(F: Field, x0: number, y0: number, z0: number, s: number): void {
    const [dx, dz] = SIDES[s];
    for (let c = MID - 1; c <= MID + 1; c++) {
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
      if (plan.has(i + dx, j + dz, k) && plan.tone(i + dx, j + dz, k) !== ROOF_TONE) continue; // the terrace continues
      for (let c = 0; c < CELL; c++) {
        const [fx, , fz] = this.faceCell(x0, 0, z0, s, c, 0);
        const corner = c === 0 || c === CELL - 1;
        const v = this.castle ? (corner || c % 2 === 0 ? wall : 0) : corner ? this.roles.trim : withShape(this.roles.trim, Shape.FENCE);
        F.fill(fx, y, fz, v);
      }
    }
  }

  /** Crown of a free-standing tower: castles get a machicolation ring and tall corner merlons, other styles a mast with a beacon. */
  private crown(F: Field, x0: number, roofY: number, z0: number, wall: number): void {
    if (this.castle) {
      for (let s = 0; s < 4; s++) {
        const [dx, dz] = SIDES[s];
        for (let c = 0; c < CELL; c++) {
          const [fx, , fz] = this.faceCell(x0, 0, z0, s, c, 0);
          F.fill(fx + dx, roofY, fz + dz, withShape(this.roles.trim, Shape.SLAB_TOP));
        }
      }
      for (const [lx, lz] of [[-1, -1], [CELL, -1], [-1, CELL], [CELL, CELL]] as [number, number][]) F.fill(x0 + lx, roofY, z0 + lz, withShape(this.roles.trim, Shape.SLAB_TOP));
      for (const [lx, lz] of [[0, 0], [CELL - 1, 0], [0, CELL - 1], [CELL - 1, CELL - 1]] as [number, number][]) F.fill(x0 + lx, roofY + 2, z0 + lz, wall);
      return;
    }
    for (let y = roofY + 1; y <= roofY + 3; y++) F.fill(x0 + MID, y, z0 + MID, withShape(this.roles.pillar, Shape.PILLAR));
    F.fill(x0 + MID, roofY + 4, z0 + MID, this.roles.light);
  }

  private pitchedRoof(F: Field, plan: Plan, i: number, j: number, k: number): void {
    const x0 = i * CELL;
    const z0 = j * CELL;
    const base = k * STOREY_H + STOREY_H;
    const shared = (s: number): boolean => {
      const [dx, dz] = SIDES[s];
      return plan.has(i + dx, j + dz, k) && !plan.has(i + dx, j + dz, k + 1) && plan.tone(i + dx, j + dz, k) === ROOF_TONE;
    };
    for (let layer = 1; layer <= ROOF_LAYERS; layer++) {
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
    const alone = !shared(0) && !shared(1) && !shared(2) && !shared(3);
    if (alone) F.set(x0 + MID, base + ROOF_LAYERS + 1, z0 + MID, withShape(this.roles.trim, Shape.PILLAR));
    // Chimney on one shoulder of the roof.
    if (hash(i, j, k, 11) % 2 === 0) {
      const cx = x0 + (hash(i, j, k, 12) % 2 === 0 ? 1 : CELL - 2);
      const cz = z0 + (hash(i, j, k, 13) % 2 === 0 ? 1 : CELL - 2);
      F.fill(cx, base + 2, cz, this.roles.trim);
      F.fill(cx, base + 3, cz, withShape(this.roles.trim, Shape.PILLAR));
    }
  }

  /** Beams along the open sides and corner pillars down to the ground under something that floats. */
  private undercroft(F: Field, x0: number, y0: number, z0: number, openSides: number[]): void {
    for (const s of openSides) {
      for (let c = 0; c < CELL; c++) {
        const [fx, , fz] = this.faceCell(x0, 0, z0, s, c, 0);
        F.fill(fx, y0 - 1, fz, withShape(this.roles.trim, Shape.SLAB_TOP));
      }
    }
    for (const [lx, lz] of [[0, 0], [CELL - 1, 0], [0, CELL - 1], [CELL - 1, CELL - 1]] as [number, number][]) {
      if (F.get(x0 + lx, y0 - 1, z0 + lz) !== 0 && F.get(x0 + lx, y0 - 1, z0 + lz) !== withShape(this.roles.trim, Shape.SLAB_TOP)) continue;
      F.set(x0 + lx, y0 - 1, z0 + lz, withShape(this.roles.pillar, 0)); // capital
      for (let y = y0 - 2; y >= 0; y--) {
        if (F.get(x0 + lx, y, z0 + lz) !== 0) break;
        F.set(x0 + lx, y, z0 + lz, withShape(this.roles.pillar, Shape.PILLAR));
      }
    }
  }

  /** Deck, railings and undercroft of a bridge; returns the deck centres (feet level, world). */
  private bridge(F: Field, b: { i: number; j: number; k: number; side: number; length: number }): Cell[] {
    const [dx, dz] = SIDES[b.side];
    const y0 = b.k * STOREY_H;
    const out: Cell[] = [];
    for (let n = 1; n <= b.length; n++) {
      const ci = b.i + dx * n;
      const cj = b.j + dz * n;
      const x0 = ci * CELL;
      const z0 = cj * CELL;
      // Deck: trim edges along the rails, floor down the middle.
      for (let lz = 0; lz < CELL; lz++)
        for (let lx = 0; lx < CELL; lx++) {
          const across = dx !== 0 ? lz : lx;
          F.set(x0 + lx, y0, z0 + lz, across === 0 || across === CELL - 1 ? this.roles.trim : this.roles.floor);
        }
      // Railings on both long edges.
      for (const edge of [0, CELL - 1]) {
        for (let t = 0; t < CELL; t++) {
          const lx = dx !== 0 ? t : edge;
          const lz = dx !== 0 ? edge : t;
          const v = this.castle ? (t % 2 === 0 ? this.wallValue(0) : withShape(this.wallValue(0), Shape.SLAB)) : withShape(this.roles.trim, Shape.FENCE);
          F.fill(x0 + lx, y0 + 1, z0 + lz, v);
        }
      }
      // Clear the crossing height above the deck (a second bridge or a balcony may not block it).
      for (let ly = 2; ly < STOREY_H; ly++) for (let lz = 1; lz < CELL - 1; lz++) for (let lx = 1; lx < CELL - 1; lx++) F.set(x0 + lx, y0 + ly, z0 + lz, 0);
      this.undercroft(F, x0, y0, z0, [(b.side + 1) % 4, (b.side + 3) % 4]);
      out.push(this.world(x0 + MID, y0 + 1, z0 + MID));
    }
    return out;
  }

  /** Paving details of a courtyard cell: lamp posts in the corners and a fountain or pylon in the middle. */
  private courtyard(F: Field, i: number, j: number): void {
    const x0 = i * CELL;
    const z0 = j * CELL;
    for (const [lx, lz] of [[0, 0], [CELL - 1, 0], [0, CELL - 1], [CELL - 1, CELL - 1]] as [number, number][]) {
      F.fill(x0 + lx, 0, z0 + lz, withShape(this.roles.pillar, Shape.PILLAR));
      F.fill(x0 + lx, 1, z0 + lz, withShape(this.roles.pillar, Shape.PILLAR));
      F.fill(x0 + lx, 2, z0 + lz, this.roles.light);
    }
    if (this.tech) {
      for (const [lx, lz] of [[MID - 1, MID - 1], [MID + 1, MID - 1], [MID - 1, MID + 1], [MID + 1, MID + 1]] as [number, number][]) F.fill(x0 + lx, 0, z0 + lz, withShape(this.roles.floor, Shape.SLAB));
      for (let y = 0; y <= 2; y++) F.fill(x0 + MID, y, z0 + MID, y === 2 ? this.roles.light : withShape(this.roles.pillar, 0));
      return;
    }
    for (let lz = MID - 1; lz <= MID + 1; lz++) for (let lx = MID - 1; lx <= MID + 1; lx++) if (lx !== MID || lz !== MID) F.fill(x0 + lx, 0, z0 + lz, withShape(this.roles.trim, Shape.SLAB));
    F.fill(x0 + MID, 0, z0 + MID, this.roles.wallAlt);
    F.fill(x0 + MID, 1, z0 + MID, withShape(this.roles.pillar, Shape.PILLAR));
    F.fill(x0 + MID, 2, z0 + MID, this.roles.light);
  }

  /** A broad five-step flight in the cell in front of a facade, climbing to the first-floor door. */
  private outerStair(F: Field, st: { i: number; j: number; side: number; cell: [number, number] }): void {
    const [dx, dz] = SIDES[st.side];
    const bx0 = st.i * CELL;
    const bz0 = st.j * CELL;
    const rot = (st.side + 1) % 4; // climbing towards the block
    const stepBlock = withShape(this.roles.stairs, makeShape('stairs', rot));
    // Five steps (one per row of the storey) three columns wide, flanked by low walls, in the part of
    // the cell nearest the facade; the rest of the cell stays open ground in front of the flight.
    for (let t = 0; t <= STOREY_H; t++) {
      const y = STOREY_H - t;
      for (let c = MID - 2; c <= MID + 2; c++) {
        const [fx, , fz] = this.faceCell(bx0, 0, bz0, st.side, c, 0);
        const cx = fx + dx * (t + 1);
        const cz = fz + dz * (t + 1);
        const rail = c === MID - 2 || c === MID + 2;
        for (let yy = 0; yy < y; yy++) F.set(cx, yy, cz, rail ? this.wallValue(0) : this.roles.wallAlt);
        F.set(cx, y, cz, rail ? this.wallValue(0) : stepBlock);
        if (rail && t === STOREY_H) F.set(cx, y + 1, cz, this.roles.light); // lamps at the foot of the flight
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
