import type { VoxelWorld } from './VoxelWorld';
import { PLOT_Y, type Plot } from './Layout';
import type { StyleId } from './Styles';
import { Random } from '../core/Random';
import { bestHidingCells, checkReachability, type Cell } from './Reachability';
import { Architect, Plan, GRID, MAX_STOREYS, applyField, type Tone } from '../build/Architect';

/**
 * Fortress plans for the bots (and the player's "surprise me" button): coarse room-block layouts
 * in the Architect's language, so the opponents' castles are built with exactly the same
 * vocabulary the player gets. Each archetype is an arena first: several entrances, a tall core,
 * roof terraces, bridges with arcades underneath, and rooms that connect on every storey.
 */
export type Archetype = 'keep' | 'citadel' | 'palace' | 'bastion' | 'temple' | 'spire';
export const ARCHETYPES: Archetype[] = ['keep', 'citadel', 'palace', 'bastion', 'temple', 'spire'];

export interface FortressResult {
  flag: Cell;
  spawn: Cell;
  blocks: number;
  archetype: Archetype;
}

const TECH: StyleId[] = ['modern', 'neon'];

/** Archetypes that read well in a style (tech styles get the flat, glassy ones more often). */
function archetypesFor(style: StyleId): Archetype[] {
  if (TECH.includes(style)) return ['citadel', 'citadel', 'bastion', 'spire', 'keep', 'temple'];
  if (style === 'candy' || style === 'desert') return ['palace', 'palace', 'temple', 'keep', 'spire', 'bastion'];
  return ['keep', 'keep', 'spire', 'palace', 'bastion', 'temple'];
}

class Sketch {
  readonly plan = new Plan();
  constructor(
    private rng: Random,
    private limit: number,
  ) {}
  get count(): number {
    return this.plan.count();
  }
  /** Adds a block when inside the grid and under budget. */
  put(i: number, j: number, k: number, tone: Tone): boolean {
    if (!Plan.inside(i, j, k) || this.plan.has(i, j, k) || this.count >= this.limit) return false;
    this.plan.set(i, j, k, tone);
    return true;
  }
  column(i: number, j: number, storeys: number, tone: Tone, topTone: Tone = tone): void {
    for (let k = 0; k < storeys; k++) this.put(i, j, k, k === storeys - 1 ? topTone : tone);
  }
  box(i0: number, j0: number, i1: number, j1: number, k: number, tone: Tone): void {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.put(i, j, k, tone);
  }
  /** Straight run of blocks between two cells (inclusive), one storey. */
  line(i0: number, j0: number, i1: number, j1: number, k: number, tone: Tone): void {
    const di = Math.sign(i1 - i0);
    const dj = Math.sign(j1 - j0);
    let i = i0;
    let j = j0;
    for (let n = 0; n < 16; n++) {
      this.put(i, j, k, tone);
      if (i === i1 && j === j1) break;
      if (i !== i1) i += di;
      else j += dj;
    }
  }
  chance(p: number): boolean {
    return this.rng.next() < p;
  }
}

/** Tone roles per style family so the same archetype dresses differently. */
function tonesFor(style: StyleId): { main: Tone; alt: Tone; tower: Tone; top: Tone; bridge: Tone; base: Tone } {
  if (TECH.includes(style)) return { main: 0, alt: 1, tower: 4, top: 4, bridge: 5, base: 5 };
  if (style === 'candy') return { main: 0, alt: 1, tower: 3, top: 7, bridge: 2, base: 1 };
  if (style === 'desert') return { main: 0, alt: 1, tower: 2, top: 7, bridge: 2, base: 1 };
  return { main: 0, alt: 1, tower: 1, top: 7, bridge: 2, base: 5 };
}

function keep(s: Sketch, rng: Random, t: ReturnType<typeof tonesFor>): void {
  // Central keep 2x2 or 3x3, three to four storeys, towers on the diagonals joined by curtain walls.
  const size = rng.next() < 0.5 ? 2 : 3;
  const i0 = size === 2 ? 3 : 2;
  const j0 = i0;
  const storeys = rng.int(3, 4);
  for (let k = 0; k < storeys; k++) s.box(i0, j0, i0 + size - 1, j0 + size - 1, k, k === storeys - 1 && rng.next() < 0.5 ? t.top : k % 2 === 0 ? t.main : t.alt);
  const ring = size === 2 ? [1, 6] : [0, 7];
  const towerH = rng.int(4, 6);
  for (const ti of ring) for (const tj of ring) s.column(ti, tj, towerH, t.tower, t.top);
  // Curtain walls along the ring, one or two storeys, with a gap somewhere for a gate courtyard.
  const wallH = rng.int(1, 2);
  const gapSide = rng.int(0, 3);
  for (let k = 0; k < wallH; k++) {
    const a = ring[0];
    const b = ring[1];
    if (gapSide !== 0) s.line(a + 1, a, b - 1, a, k, t.alt);
    if (gapSide !== 1) s.line(b, a + 1, b, b - 1, k, t.alt);
    if (gapSide !== 2) s.line(a + 1, b, b - 1, b, k, t.alt);
    if (gapSide !== 3) s.line(a, a + 1, a, b - 1, k, t.alt);
  }
  // Sky bridges from the keep to two towers at storey 2 (arcades below).
  const bk = Math.min(2, storeys - 1);
  const mid = i0 + Math.floor(size / 2);
  if (rng.next() < 0.8) s.line(mid, j0 - 1, mid, ring[0] + 1, bk, t.bridge);
  if (rng.next() < 0.8) s.line(i0 + size, mid, ring[1] - 1, mid, bk, t.bridge);
  // Overhanging balcony rooms on the keep front.
  if (rng.next() < 0.6) s.put(i0 - 1, j0 + size - 1, 1, t.alt);
}

function citadel(s: Sketch, rng: Random, t: ReturnType<typeof tonesFor>): void {
  // Stepped hi-tech massing: wide glassy base, a slimmer block above, a slab tower, one detached
  // service tower joined by a sky bridge. Some blocks overhang the base for arcades.
  const i0 = rng.int(1, 2);
  const j0 = rng.int(1, 2);
  s.box(i0, j0, i0 + 3, j0 + 3, 0, t.base);
  s.box(i0 + 1, j0, i0 + 3, j0 + 2, 1, t.main);
  s.box(i0 + 2, j0 + 1, i0 + 3, j0 + 2, 2, t.top);
  s.box(i0 + 2, j0 + 1, i0 + 3, j0 + 1, 3, t.top);
  s.put(i0 + 3, j0 + 1, 4, t.tower);
  // Overhangs.
  s.put(i0 + 4, j0 + 1, 1, t.main);
  s.put(i0 + 4, j0 + 2, 1, t.main);
  s.put(i0, j0 + 4, 1, t.alt);
  // Detached tower and bridge.
  const ti = Math.min(GRID - 1, i0 + 5);
  const tj = Math.min(GRID - 1, j0 + 4);
  s.column(ti, tj, 4, t.tower, t.tower);
  s.line(i0 + 4, j0 + 3, ti, j0 + 3, 2, t.bridge);
  s.put(ti, tj - 1, 2, t.bridge);
  // Low pavilions around for cover.
  if (rng.next() < 0.7) s.put(i0 - 1, j0 + 1, 0, t.alt);
  if (rng.next() < 0.7) s.put(i0 + 1, j0 - 1, 0, t.alt);
}

function palace(s: Sketch, rng: Random, t: ReturnType<typeof tonesFor>): void {
  // Symmetric front: two wings with pitched roofs, a taller central hall, towers at the wing ends,
  // and a rear gallery on the first floor.
  const j0 = 3;
  const i0 = 1;
  const i1 = 6;
  // Wings (ground + roofed first floor).
  s.box(i0, j0, i1, j0 + 1, 0, t.main);
  for (let i = i0; i <= i1; i++) if (i < 3 || i > 4) s.put(i, j0, 1, t.top);
  // Central hall three storeys wide two.
  for (let k = 0; k < 3; k++) s.box(3, j0, 4, j0 + 1, k, k === 2 ? t.top : t.alt);
  // Rear gallery.
  s.line(i0, j0 + 2, i1, j0 + 2, 0, t.alt);
  s.line(i0 + 1, j0 + 2, i1 - 1, j0 + 2, 1, t.bridge);
  // End towers.
  s.column(i0, j0 + 2, 4, t.tower, t.top);
  s.column(i1, j0 + 2, 4, t.tower, t.top);
  // Forecourt pavilions.
  if (rng.next() < 0.6) s.put(2, j0 - 2, 0, t.alt);
  if (rng.next() < 0.6) s.put(5, j0 - 2, 0, t.alt);
  s.put(3, j0 + 1, 3, t.tower);
}

function bastion(s: Sketch, rng: Random, t: ReturnType<typeof tonesFor>): void {
  // Sprawling low complex: an L of rooms, a partial first floor with overhangs, a watchtower.
  const i0 = rng.int(1, 2);
  const j0 = rng.int(1, 2);
  s.box(i0, j0, i0 + 4, j0 + 1, 0, t.base);
  s.box(i0, j0 + 2, i0 + 1, j0 + 4, 0, t.base);
  s.box(i0 + 1, j0, i0 + 3, j0, 1, t.main);
  s.put(i0, j0 + 3, 1, t.main);
  s.put(i0 + 2, j0 + 2, 1, t.alt); // overhang into the courtyard
  s.put(i0 + 2, j0 + 2, 0, t.alt);
  s.column(i0 + 4, j0 + 3, 4, t.tower, t.top);
  s.line(i0 + 4, j0 + 2, i0 + 4, j0 + 2, 0, t.alt);
  s.put(i0 + 4, j0 + 1, 1, t.alt);
  if (rng.next() < 0.5) s.put(i0 + 5, j0, 0, t.main);
  if (rng.next() < 0.5) s.put(i0 - 1, j0 + 4, 0, t.main);
}

function temple(s: Sketch, rng: Random, t: ReturnType<typeof tonesFor>): void {
  // Terraced platform: a broad base, a stacked centre, corner pylons, a colonnade bridge.
  const i0 = 2;
  const j0 = 2;
  s.box(i0, j0, i0 + 3, j0 + 3, 0, t.base);
  s.box(i0 + 1, j0 + 1, i0 + 2, j0 + 2, 1, t.main);
  s.box(i0 + 1, j0 + 1, i0 + 2, j0 + 2, 2, t.alt);
  s.put(i0 + 1, j0 + 1, 3, t.top);
  s.put(i0 + 2, j0 + 2, 3, t.top);
  for (const [pi, pj] of [[i0 - 1, j0 - 1], [i0 + 4, j0 - 1], [i0 - 1, j0 + 4], [i0 + 4, j0 + 4]]) s.column(pi, pj, 3, t.tower, t.top);
  s.line(i0, j0 - 1, i0 + 3, j0 - 1, 1, t.bridge);
  s.line(i0 - 1, j0, i0 - 1, j0 + 3, 1, t.bridge);
  if (rng.next() < 0.6) s.put(i0 + 4, j0 + 1, 0, t.alt);
}

function spire(s: Sketch, rng: Random, t: ReturnType<typeof tonesFor>): void {
  // A single tall tower over a courtyard ring, two flanking turrets and a high bridge.
  const i0 = 3;
  const j0 = 3;
  const h = rng.int(5, 6);
  for (let k = 0; k < h; k++) s.box(i0, j0, i0 + 1, j0 + 1, k, k === h - 1 ? t.top : k % 2 ? t.alt : t.main);
  // Ring courtyard at ground level with gaps.
  for (let i = 1; i <= 6; i++) {
    if (i !== 3) s.put(i, 1, 0, t.base);
    if (i !== 4) s.put(i, 6, 0, t.base);
  }
  for (let j = 2; j <= 5; j++) {
    if (j !== 4) s.put(1, j, 0, t.base);
    if (j !== 3) s.put(6, j, 0, t.base);
  }
  s.column(1, 1, 4, t.tower, t.top);
  s.column(6, 6, 4, t.tower, t.top);
  s.line(2, 1, i0 - 1, 1, 2, t.bridge);
  s.line(i0, 2, i0, 2, 2, t.bridge);
  if (rng.next() < 0.7) s.line(6, 5, 6, j0 + 2, 2, t.bridge);
  s.put(i0 + 1, j0 + 2, 2, t.bridge);
}

const BUILDERS: Record<Archetype, (s: Sketch, rng: Random, t: ReturnType<typeof tonesFor>) => void> = { keep, citadel, palace, bastion, temple, spire };

/** A fortress plan in the Architect's block language, connected and under budget. */
export function planFortress(rng: Random, style: StyleId, limit: number, archetype?: Archetype): Plan {
  const arch = archetype ?? rng.pick(archetypesFor(style));
  const s = new Sketch(rng, limit);
  BUILDERS[arch](s, rng, tonesFor(style));
  dropFloating(s.plan);
  return s.plan;
}

/** Removes blocks that are not connected to the ground through faces (keeps every plan playable). */
function dropFloating(plan: Plan): void {
  const ok = new Uint8Array(plan.cells.length);
  const stack: number[] = [];
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) if (plan.has(i, j, 0)) stack.push(Plan.index(i, j, 0));
  for (const idx of stack) ok[idx] = 1;
  while (stack.length) {
    const idx = stack.pop()!;
    const [i, j, k] = Plan.coords(idx);
    for (const [di, dj, dk] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      const nk = k + dk;
      if (!plan.has(ni, nj, nk)) continue;
      const n = Plan.index(ni, nj, nk);
      if (ok[n]) continue;
      ok[n] = 1;
      stack.push(n);
    }
  }
  for (let n = 0; n < plan.cells.length; n++) if (plan.cells[n] && !ok[n]) plan.cells[n] = 0;
}

/** Builds a bot fortress on its plot and returns flag and spawn cells. */
export function generateFortress(world: VoxelWorld, plot: Plot, style: StyleId, rng: Random, archetype?: Archetype, limit = 64): FortressResult {
  const arch = archetype ?? rng.pick(archetypesFor(style));
  const plan = planFortress(rng, style, limit, arch);
  const architect = new Architect(plot, style);
  const res = architect.generate(plan);
  applyField(world, plot, res.field);
  // Flag: the most buried room whose floor is reachable from outside; spawn nearby on another floor.
  const rooms = res.rooms.filter((r) => r.floor.length > 0).sort((a, b) => b.depth - a.depth);
  let flag: Cell | null = null;
  for (const r of rooms) {
    const c = r.floor[Math.floor(r.floor.length / 2)];
    if (checkReachability(world, plot, c, c).ok) {
      flag = { ...c };
      break;
    }
  }
  if (!flag) {
    const cands = bestHidingCells(world, plot, 6);
    flag = cands.length ? rng.pick(cands) : { x: plot.cx, y: PLOT_Y, z: plot.cz };
  }
  let spawn: Cell = { ...flag };
  const spots = [...res.roofSpots, ...rooms.flatMap((r) => r.floor.slice(0, 2))].filter((c) => {
    const d = Math.abs(c.x - flag!.x) + Math.abs(c.z - flag!.z);
    return d >= 3 && d <= 14 && world.get(c.x, c.y, c.z) === 0 && world.get(c.x, c.y + 1, c.z) === 0;
  });
  if (spots.length) spawn = { ...rng.pick(spots) };
  return { flag, spawn, blocks: res.blocks, archetype: arch };
}

export { MAX_STOREYS };
