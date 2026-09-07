import type { VoxelWorld } from './VoxelWorld';
import { PLOT_Y, type Plot } from './Layout';
import type { StyleId } from './Styles';
import { Random } from '../core/Random';
import { bestHidingCells, checkReachability, type Cell } from './Reachability';
import { Architect, Plan, GRID, MAX_STOREYS, MAX_BLOCKS, applyField, type Tone, heroOrder } from '../build/Architect';

/**
 * Fortress plans for the bots (and the player's "surprise me" button): coarse room-block layouts
 * in the Architect's language, so the opponents' castles are built with exactly the same
 * vocabulary the player gets. Each archetype is an arena first: several entrances, a tall core,
 * roof terraces, bridges, colonnades, courtyards and rooms that connect on every storey.
 */
export type Archetype = 'keep' | 'citadel' | 'palace' | 'bastion' | 'temple' | 'spire';
export const ARCHETYPES: Archetype[] = ['keep', 'citadel', 'palace', 'bastion', 'temple', 'spire'];

export interface FortressResult {
  flag: Cell;
  spawn: Cell;
  blocks: number;
  archetype: Archetype;
  /** Doorway thresholds, every free room floor cell, and the flag hall's floor (for seeding traps). */
  entrances: Cell[];
  floors: Cell[];
  heroFloors: Cell[];
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

/** Tone roles per style family so the same archetype dresses differently. Tone 5 is the open colonnade. */
function tonesFor(style: StyleId): { main: Tone; alt: Tone; tower: Tone; top: Tone; gallery: Tone; base: Tone } {
  if (TECH.includes(style)) return { main: 0, alt: 1, tower: 4, top: 4, gallery: 5, base: 1 };
  if (style === 'candy') return { main: 0, alt: 1, tower: 3, top: 7, gallery: 5, base: 1 };
  if (style === 'desert') return { main: 0, alt: 1, tower: 2, top: 7, gallery: 5, base: 1 };
  return { main: 0, alt: 1, tower: 1, top: 7, gallery: 5, base: 1 };
}

function keep(s: Sketch, rng: Random, t: ReturnType<typeof tonesFor>): void {
  // Central keep 2x2 or 3x3, three to four storeys, towers on the four corners of the plot joined by
  // curtain walls with a gate gap, open galleries at storey two and a second tower bridging to the keep.
  const size = rng.next() < 0.5 ? 2 : 3;
  const i0 = 1;
  const j0 = 1;
  const storeys = rng.int(3, 4);
  for (let k = 0; k < storeys; k++) s.box(i0, j0, i0 + size - 1, j0 + size - 1, k, k === storeys - 1 && rng.next() < 0.5 ? t.top : k % 2 === 0 ? t.main : t.alt);
  const towerH = rng.int(4, 6);
  for (const ti of [0, GRID - 1]) for (const tj of [0, GRID - 1]) s.column(ti, tj, towerH, t.tower, t.top);
  // Curtain walls along the edges, one or two storeys, with a gap somewhere for a gate courtyard.
  const wallH = rng.int(1, 2);
  const gapSide = rng.int(0, 3);
  for (let k = 0; k < wallH; k++) {
    const a = 0;
    const b = GRID - 1;
    if (gapSide !== 0) s.line(a + 1, a, b - 1, a, k, t.alt);
    if (gapSide !== 1) s.line(b, a + 1, b, b - 1, k, t.alt);
    if (gapSide !== 2) s.line(a + 1, b, b - 1, b, k, t.alt);
    if (gapSide !== 3) s.line(a, a + 1, a, b - 1, k, t.alt);
  }
  // Open galleries over the curtain walls at storey two (arcades below when the wall is one storey).
  const bk = Math.min(2, storeys - 1);
  if (rng.next() < 0.8) s.put(i0, 0, bk, t.gallery);
  if (rng.next() < 0.8) s.put(GRID - 1, j0 + size - 1, bk, t.gallery);
  // A tower in the keep's tone one cell away from it: the gap turns into bridges.
  if (size === 2 && rng.next() < 0.8) s.column(i0 + 3, j0, storeys, t.main, t.main);
  // Overhanging balcony room on the keep front.
  if (rng.next() < 0.6) s.put(i0 + size, j0 + size - 1, 1, t.alt);
}

function citadel(s: Sketch, rng: Random, t: ReturnType<typeof tonesFor>): void {
  // Stepped hi-tech massing: a wide base, slimmer blocks above, a slab tower, one detached glass tower
  // joined by bridges on two storeys, a ground gallery and low pavilions for cover.
  const i0 = 0;
  const j0 = rng.int(0, 1);
  s.box(i0, j0, i0 + 2, j0 + 2, 0, t.base);
  s.box(i0 + 1, j0, i0 + 2, j0 + 1, 1, t.main);
  s.box(i0 + 2, j0, i0 + 2, j0 + 1, 2, t.top);
  s.put(i0 + 2, j0, 3, t.top);
  // Overhang for an arcade.
  s.put(i0 + 3, j0 + 1, 1, t.main);
  // Detached glass tower two cells from the slab: bridges span the gap on storeys two and three.
  s.column(i0 + 4, j0, 4, t.top, t.top);
  s.put(i0 + 3, j0, 0, t.gallery);
  if (rng.next() < 0.7) s.put(i0, j0 + 3, 0, t.alt);
  if (rng.next() < 0.7) s.put(i0 + 3, j0 + 3, 0, t.alt);
  if (rng.next() < 0.5) s.put(i0 + 4, j0 + 2, 0, t.alt);
}

function palace(s: Sketch, rng: Random, t: ReturnType<typeof tonesFor>): void {
  // Symmetric front: a wing with pitched roofs, a taller central hall, towers at the rear corners,
  // a first-floor rear gallery and a forecourt framed by two pavilions.
  const j0 = 2;
  s.box(0, j0, GRID - 1, j0, 0, t.main);
  for (const i of [0, 1, 3, 4]) s.put(i, j0, 1, t.top);
  for (let k = 0; k < 3; k++) s.box(2, j0, 2, j0 + 1, k, k === 2 ? t.top : t.alt);
  s.line(0, j0 + 1, GRID - 1, j0 + 1, 0, t.alt);
  s.line(1, j0 + 1, GRID - 2, j0 + 1, 1, t.gallery);
  s.column(0, j0 + 2, 4, t.tower, t.top);
  s.column(GRID - 1, j0 + 2, 4, t.tower, t.top);
  s.line(1, j0 + 2, GRID - 2, j0 + 2, 0, t.alt);
  // Forecourt: pavilions either side of the entrance cell.
  s.put(1, j0 - 1, 0, t.alt);
  s.put(3, j0 - 1, 0, t.alt);
  if (rng.next() < 0.5) s.put(2, j0 + 1, 3, t.tower);
}

function bastion(s: Sketch, rng: Random, t: ReturnType<typeof tonesFor>): void {
  // Sprawling low complex: an L of rooms around a courtyard, a partial first floor, a watchtower.
  s.box(0, 0, 3, 1, 0, t.base);
  s.box(0, 2, 1, 4, 0, t.base);
  s.box(1, 0, 2, 0, 1, t.main);
  s.put(0, 3, 1, t.main);
  s.put(2, 3, 0, t.alt); // closes the courtyard cell (2,2) on three sides
  s.put(2, 2, 1, t.alt); // overhang into the courtyard
  s.column(4, 3, 4, t.tower, t.top);
  s.put(4, 2, 0, t.alt);
  if (rng.next() < 0.5) s.put(4, 0, 0, t.main);
  if (rng.next() < 0.5) s.put(3, 4, 0, t.main);
}

function temple(s: Sketch, rng: Random, t: ReturnType<typeof tonesFor>): void {
  // Terraced platform: a hypostyle colonnade base, a stacked centre, corner pylons, galleries.
  s.box(1, 1, 3, 3, 0, t.gallery);
  s.put(2, 2, 1, t.main);
  s.put(2, 2, 2, t.alt);
  s.put(2, 2, 3, t.top);
  for (const [pi, pj] of [[0, 0], [GRID - 1, 0], [0, GRID - 1], [GRID - 1, GRID - 1]]) s.column(pi, pj, 3, t.tower, t.top);
  s.line(1, 0, 3, 0, 1, t.gallery);
  s.line(0, 1, 0, 3, 1, t.gallery);
  if (rng.next() < 0.6) s.put(4, 2, 0, t.alt);
  if (rng.next() < 0.6) s.put(2, 4, 0, t.alt);
}

function spire(s: Sketch, rng: Random, t: ReturnType<typeof tonesFor>): void {
  // A single tall tower inside a cloister ring, two flanking turrets and high galleries.
  const h = rng.int(5, 6);
  for (let k = 0; k < h; k++) s.put(2, 2, k, k === h - 1 ? t.top : k % 2 ? t.alt : t.main);
  for (let i = 0; i < GRID; i++) {
    if (i !== 2) s.put(i, 0, 0, t.gallery);
    if (i !== 2) s.put(i, GRID - 1, 0, t.gallery);
  }
  for (let j = 1; j < GRID - 1; j++) {
    s.put(0, j, 0, t.gallery);
    s.put(GRID - 1, j, 0, t.gallery);
  }
  s.column(0, 0, 4, t.tower, t.top);
  s.column(GRID - 1, GRID - 1, 4, t.tower, t.top);
  s.put(2, 1, 2, t.gallery);
  s.put(1, 2, 2, t.gallery);
  if (rng.next() < 0.7) s.put(3, 2, 2, t.gallery);
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
export function generateFortress(world: VoxelWorld, plot: Plot, style: StyleId, rng: Random, archetype?: Archetype, limit = MAX_BLOCKS): FortressResult {
  const arch = archetype ?? rng.pick(archetypesFor(style));
  const plan = planFortress(rng, style, limit, arch);
  const architect = new Architect(plot, style);
  let res = architect.generate(plan);
  applyField(world, plot, res.field);
  // Flag: the most buried room whose floor is reachable from outside; spawn nearby on another floor.
  let rooms = heroOrder(plan, res.rooms.filter((r) => r.floor.length > 0));
  let flag: Cell | null = null;
  for (const r of rooms) {
    const c = r.floor[Math.floor(r.floor.length / 2)];
    if (checkReachability(world, plot, c, c).ok) {
      // Make that room the hero hall (podium, gallery ring) and put the flag on the podium.
      plan.hero = Plan.index(r.i, r.j, r.k);
      res = architect.generate(plan);
      applyField(world, plot, res.field);
      rooms = heroOrder(plan, res.rooms.filter((rr) => rr.floor.length > 0));
      const spot = res.hero?.spot ?? null;
      if (spot && checkReachability(world, plot, spot, spot).ok) flag = { ...spot };
      else {
        const room = res.rooms.find((rr) => rr.i === r.i && rr.j === r.j && rr.k === r.k);
        const c2 = room && room.floor.length ? room.floor[Math.floor(room.floor.length / 2)] : c;
        if (checkReachability(world, plot, c2, c2).ok) flag = { ...c2 };
      }
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
  const heroCells = new Set(res.hero?.cells ?? []);
  const heroFloors = res.rooms.filter((r) => heroCells.has(Plan.index(r.i, r.j, r.k))).flatMap((r) => r.floor);
  return { flag, spawn, blocks: res.blocks, archetype: arch, entrances: res.entrances, floors: res.rooms.flatMap((r) => r.floor), heroFloors };
}

export { MAX_STOREYS };
