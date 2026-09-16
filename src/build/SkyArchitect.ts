import * as THREE from 'three';
import { Mat, SKY_DEEP_PALETTE, SKY_PLAYER_PALETTE, encodeBlock, makeShape, withShape } from '../world/Voxel';
import type { Terrain } from '../world/Terrain';
import { CELL, DIRS, STOREY, SkyPlan, cellX, cellZ, type SkyCell } from './SkyPlan';
import { skinAt, type Skin } from './SkySkins';

/**
 * The sky architect. It takes one cell of the plan, looks at what stands around it, and returns the
 * finished building for it — in the language of a modern citadel in the clouds: light cladding
 * drawn with dark frames, band windows of glass, floors that end in a deep fascia beam, glass
 * balustrades between posts of light in the builder's colour, grand stairs with a glowing handrail,
 * cable-deck bridges, stadium bowls with light masts, and under every floating floor a stepped keel
 * with a crystal core. Nothing is decorative only — every floor is stood on, every portal is walked
 * through, every balustrade is fought over, and every glass pane can be shot out.
 */

/** Packs a block position into one integer key. */
export function posKey(x: number, y: number, z: number): number {
  return ((x + 4096) * 8192 + (z + 4096)) * 256 + y;
}
export function posOf(key: number): [number, number, number] {
  const y = key % 256;
  const rest = (key - y) / 256;
  const z = (rest % 8192) - 4096;
  const x = (rest - (z + 4096)) / 8192 - 4096;
  return [x, y, z];
}

/** Rotates a cell-local position authored for facing +X onto facing `r`. */
export function rotLocal(lx: number, lz: number, r: number): [number, number] {
  switch (((r % 4) + 4) % 4) {
    case 0:
      return [lx, lz];
    case 1:
      return [CELL - 1 - lz, lx];
    case 2:
      return [CELL - 1 - lx, CELL - 1 - lz];
    default:
      return [lz, CELL - 1 - lx];
  }
}

const AIR = 0;

/** A thin light in the builder's colour: a post or a rail, bright so it reads from afar. */
function neon(color: number): number {
  return encodeBlock(Mat.CRYSTAL, color);
}
/** A solid block of light in the builder's colour, in the deep shade so a cube glows rather than glares. */
function crystal(color: number): number {
  return encodeBlock(Mat.CRYSTAL, SKY_DEEP_PALETTE + (((color - SKY_PLAYER_PALETTE) % 12) + 12) % 12);
}
const SLAB = makeShape('slab');
const SLAB_TOP = makeShape('slabTop');
const FENCE = makeShape('fence');
const PILLAR = makeShape('pillar');

/** Deterministic variation per cell, so two halls side by side are not twins. */
function hash(a: number, b: number, c: number): number {
  let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

/** The blocks of one cell, collected before they go into the world. */
export class Emit {
  readonly blocks = new Map<number, number>();
  set(x: number, y: number, z: number, v: number): void {
    if (y < 1 || y > 250) return;
    this.blocks.set(posKey(x, y, z), v);
  }
  /** Marks a position as deliberately empty (carves through whatever a lower rule wrote). */
  clear(x: number, y: number, z: number): void {
    if (y < 1 || y > 250) return;
    this.blocks.set(posKey(x, y, z), AIR);
  }
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v: number): void {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, v);
  }
  /** What this cell has put at a position so far: air both for untouched space and for a carved hole. */
  at(x: number, y: number, z: number): number {
    return this.blocks.get(posKey(x, y, z)) ?? AIR;
  }
}

/** Writes cell-local positions (authored facing +X) into the world, turned to the cell's facing. */
class Pen {
  constructor(
    private e: Emit,
    private x0: number,
    private z0: number,
    private r: number,
  ) {}
  put(lx: number, lz: number, y: number, v: number): void {
    const [ax, az] = rotLocal(lx, lz, this.r);
    this.e.set(this.x0 + ax, y, this.z0 + az, v);
  }
  box(lx0: number, lz0: number, y0: number, lx1: number, lz1: number, y1: number, v: number): void {
    for (let lx = lx0; lx <= lx1; lx++) for (let lz = lz0; lz <= lz1; lz++) for (let y = y0; y <= y1; y++) this.put(lx, lz, y, v);
  }
}

/** Cell-local position of the t-th block along a side (0 +X, 1 +Z, 2 -X, 3 -Z). */
function alongSide(side: number, t: number): [number, number] {
  switch (side) {
    case 0:
      return [CELL - 1, t];
    case 1:
      return [t, CELL - 1];
    case 2:
      return [0, t];
    default:
      return [t, 0];
  }
}

/** Where a stair tower needs its ceiling left open, in cell-local coordinates. */
const HOLE = { lx0: 3, lx1: 5, lz0: 3, lz1: 5 };
/** The portal on a hall face: three blocks wide, four tall. */
const PORTAL_FROM = 3;
const PORTAL_TO = 5;
/**
 * How far up a grand flight its side wall opens when a floor stands beside its foot. Without this
 * the two long sides of a stair are a six-block wall, and a neighbour a stride away from the first
 * step has to walk the whole way round to use it.
 */
const STAIR_GATE_UNTIL = 3;

/** First step of a flight whose head would be crushed by a floor one storey up. */
const STAIR_HEAD_FROM = 5;
/**
 * The service stair every roofed floor gets: an open flight of single steps along a strip one block
 * in from a long edge, up to the opening it comes through in the floor above. The strip is chosen
 * to come up where the floor above leaves room to stand, and successive floors of a stack take
 * alternate strips, so a tall building is a switchback around its own light well.
 */
const STAIR_STRIPS = [1, CELL - 2, 2, CELL - 3];
/** First and last column a service stair may occupy: never the edge rows, which carry the rails. */
const STAIR_LX0 = 1;
const STAIR_LX1 = CELL - 2;
/** How many of the top steps the floor above stays open over, for the head of whoever climbs them. */
const STAIR_HEAD = 3;
/** The light well cut into a floor that stands over another: four blocks long, this many deep. */
const WELL_ROWS = 2;
/** A service stair, once decided: its frame, the strip it climbs along, and how many steps it has. */
interface Service {
  r: number;
  strip: number;
  steps: number;
}
/** The column beside a strip, toward the middle of the cell: where the handrail stands. */
function kerbOf(strip: number): number {
  return strip < CELL / 2 ? strip + 1 : strip - 1;
}
/**
 * The rows of the light well that goes with a strip: the middle of the cell, one row in from the
 * stair's handrail, so a walkway is left on both sides of it and the floor stays one floor.
 */
function wellRows(strip: number): [number, number] {
  return strip < CELL / 2 ? [strip + 2, strip + 1 + WELL_ROWS] : [strip - 1 - WELL_ROWS, strip - 2];
}

export class SkyArchitect {
  constructor(
    private plan: SkyPlan,
    private terrain: Terrain,
  ) {}

  /** Every block of one cell. Neighbours are read from the plan, so a cell knows its own edges. */
  generate(c: SkyCell): Map<number, number> {
    const e = new Emit();
    const S = skinAt(c.skin);
    // A building cuts into the hill it stands against: clear the room before dressing it, so a
    // portal never opens into earth and a hall is always a hall.
    if (c.kind !== 'arenaPart') this.carve(e, c);
    switch (c.kind) {
      case 'deck':
        this.floor(e, c, S, true);
        // A floor with sky over it is a terrace; with another floor over it, a room as well — one
        // that can always be left upward.
        this.terrace(e, c, S);
        this.service(e, c, S);
        this.link(e, c, S);
        this.cover(e, c, S);
        this.under(e, c, S);
        break;
      case 'tower':
        this.floor(e, c, S, false);
        this.hall(e, c, S);
        this.under(e, c, S);
        break;
      case 'ramp':
        this.stair(e, c, S);
        this.under(e, c, S);
        break;
      case 'bridge':
        this.bridge(e, c, S);
        break;
      case 'arena':
        this.stadium(e, c, S);
        break;
      case 'arenaPart':
        break;
    }
    return e.blocks;
  }

  /** Empties the space a module occupies, so terrain never fills its rooms. */
  private carve(e: Emit, c: SkyCell): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y;
    if (c.kind === 'arena') {
      const cx = x0 + CELL / 2;
      const cz = z0 + CELL / 2;
      for (let x = Math.floor(cx - 12); x <= Math.ceil(cx + 12); x++)
        for (let z = Math.floor(cz - 12); z <= Math.ceil(cz + 12); z++) {
          if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > 12) continue;
          for (let h = 1; h <= 4; h++) e.clear(x, y + h, z);
        }
      return;
    }
    for (let lx = 0; lx < CELL; lx++) for (let lz = 0; lz < CELL; lz++) for (let h = 1; h <= 5; h++) e.clear(x0 + lx, y + h, z0 + lz);
    // A step of apron outside the walls, so a portal cut into a hillside is still a portal.
    for (let lx = -1; lx <= CELL; lx++)
      for (let lz = -1; lz <= CELL; lz++) {
        if (lx >= 0 && lx < CELL && lz >= 0 && lz < CELL) continue;
        for (let h = 1; h <= 4; h++) e.clear(x0 + lx, y + h, z0 + lz);
      }
  }

  // ---- shared helpers -------------------------------------------------------

  /** True when nothing stands beside this cell on that side. */
  private open(c: SkyCell, side: number): boolean {
    const [dx, dz] = DIRS[side];
    return !this.plan.get(c.i + dx, c.j + dz, c.y);
  }

  /** A stair one storey down that climbs into this cell from `side` (its landing is our floor). */
  private rampAt(c: SkyCell, side: number): boolean {
    const [dx, dz] = DIRS[side];
    const back = this.plan.get(c.i - dx, c.j - dz, c.y - STOREY);
    return !!back && back.kind === 'ramp' && back.dir === side;
  }

  /**
   * The side of this floor that carries a flight up to the floor a storey above it next door, or
   * -1 when there is none. One per floor: a room with a staircase on every wall is a stairwell and
   * not a place to stand, and the first matching side is enough to make the climb exist.
   */
  private linkSide(c: SkyCell): number {
    if (c.kind !== 'deck' || this.plan.above(c.i, c.j, c.y)) return -1;
    const head = this.rampHead(c);
    for (let s = 0; s < 4; s++) {
      if (!this.open(c, s) || this.rampAt(c, s)) continue;
      const [dx, dz] = DIRS[s];
      const up = this.plan.get(c.i + dx, c.j + dz, c.y + STOREY);
      if (!up || up.kind !== 'deck') continue;
      // Never across the head of a stair coming up through this floor.
      let clear = true;
      for (let lx = 1; lx < CELL && clear; lx++)
        for (let lz = 2; lz <= CELL - 2 && clear; lz++) {
          const [ax, az] = rotLocal(lx, lz, s);
          if (head.has(ax * CELL + az)) clear = false;
        }
      if (clear) return s;
    }
    return -1;
  }

  /** The other end of that flight: a floor a storey below sends a stair up to this edge. */
  private linkFrom(c: SkyCell, side: number): boolean {
    const [dx, dz] = DIRS[side];
    const low = this.plan.get(c.i + dx, c.j + dz, c.y - STOREY);
    return !!low && this.linkSide(low) === (side + 2) % 4;
  }

  /** A bridge beside this cell on that side: the balustrade keeps its ends and opens in the middle. */
  private bridgeAt(c: SkyCell, side: number): boolean {
    const [dx, dz] = DIRS[side];
    return this.plan.get(c.i + dx, c.j + dz, c.y)?.kind === 'bridge';
  }

  /** The hall below whose stair must come through this cell's floor. */
  private towerBelow(c: SkyCell): SkyCell | null {
    const b = this.plan.below(c.i, c.j, c.y);
    return b && b.kind === 'tower' ? b : null;
  }

  // ---- floor ----------------------------------------------------------------

  /** The slab: a light field inside a dark rim wherever the floor ends, with the stairwell left open. */
  private floor(e: Emit, c: SkyCell, S: Skin, medallion: boolean): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y;
    const tower = this.towerBelow(c);
    const hole = tower ? this.holeRect(tower) : null;
    const openSide = [0, 1, 2, 3].map((s) => this.open(c, s));
    // A stair below comes up through this floor — the grand flight of a ramp, or the service stair
    // of the room underneath. Either way its head is left open, or the last steps would be swallowed
    // by the slab and the climb would end in a ceiling.
    const stairHead = this.stairHead(c);
    // Over another floor, the middle opens into a light well: the room below sees the sky and the
    // stair that leaves it, and whoever stands up here sees who is down there.
    const well = this.well(c);
    const rim = new Set<number>();
    for (const k of well)
      for (const [dx, dz] of DIRS) {
        const n = k + dx * CELL + dz;
        const nx = Math.floor(k / CELL) + dx;
        const nz = (k % CELL) + dz;
        if (nx >= 0 && nx < CELL && nz >= 0 && nz < CELL && !well.has(n)) rim.add(n);
      }
    const inHole = (lx: number, lz: number): boolean =>
      (!!hole && lx >= hole.x0 && lx <= hole.x1 && lz >= hole.z0 && lz <= hole.z1) || stairHead.has(lx * CELL + lz) || well.has(lx * CELL + lz);
    const variant = hash(c.i, c.j, c.y) % 3;
    for (let lx = 0; lx < CELL; lx++)
      for (let lz = 0; lz < CELL; lz++) {
        if (inHole(lx, lz)) {
          const v = stairHead.get(lx * CELL + lz) ?? AIR;
          if (v) e.set(x0 + lx, y, z0 + lz, v);
          else e.clear(x0 + lx, y, z0 + lz);
          continue;
        }
        const edge =
          (lx === 0 && openSide[2]) || (lx === CELL - 1 && openSide[0]) || (lz === 0 && openSide[3]) || (lz === CELL - 1 && openSide[1]) || rim.has(lx * CELL + lz);
        let v = edge ? S.frame : S.floor;
        if (!edge && medallion) {
          const mid = (lx === 3 || lx === 4) && (lz === 3 || lz === 4);
          // Three floor patterns: a metal medallion, an inlaid cross, or a plain field with a corner mark.
          if (variant === 0 && mid) v = S.inlay;
          else if (variant === 1 && ((lx === 3 || lx === 4) !== (lz === 3 || lz === 4))) v = S.inlay;
          else if (variant === 2 && (lx === 0 || lx === 7 || lz === 0 || lz === 7)) v = S.inlay;
        }
        e.set(x0 + lx, y, z0 + lz, v);
      }
  }

  /**
   * Cell-local positions this floor must leave open for a stair climbing under it. The last steps of
   * a flight reach within a block of the floor above, so a slab over them is a ceiling on the head
   * of whoever is climbing: those columns are cut away, and the stair arrives through the opening.
   */
  private stairHead(c: SkyCell): Map<number, number> {
    const out = new Map<number, number>();
    for (const k of this.rampHead(c)) out.set(k, AIR);
    const below = this.plan.below(c.i, c.j, c.y);
    if (!below) return out;
    const sp = this.servicePlan(below);
    if (!sp) return out;
    for (const k of this.holeOf(sp)) out.set(k, AIR);
    // When the flight reaches this floor exactly, its top step sits at this floor's own level: it
    // is this cell's block to place, so that two cells never write one position and the last one
    // regenerated wins.
    if (below.y + sp.steps === c.y) {
      const [ax, az] = rotLocal(STAIR_LX0 + sp.steps - 1, sp.strip, sp.r);
      out.set(ax * CELL + az, withShape(skinAt(below.skin).floor, makeShape('stairs', sp.r)));
    }
    return out;
  }

  /** The head of a grand stair one storey down: fixed by the ramp, whatever stands above it. */
  private rampHead(c: SkyCell): Set<number> {
    const out = new Set<number>();
    const below = this.plan.below(c.i, c.j, c.y);
    if (!below || below.kind !== 'ramp') return out;
    for (let lx = STAIR_HEAD_FROM; lx < CELL; lx++)
      for (let lz = 1; lz <= CELL - 2; lz++) {
        const [ax, az] = rotLocal(lx, lz, below.dir);
        out.add(ax * CELL + az);
      }
    return out;
  }

  /** A column a stair comes up through: left open, or given the stair's own top step at floor level. */
  private opening(e: Emit, x: number, y: number, z: number, v: number): void {
    if (v) e.set(x, y, z, v);
    else e.clear(x, y, z);
  }

  /** The columns of the floor above a service stair that its top steps come up through. */
  private holeOf(sp: Service): number[] {
    const out: number[] = [];
    const top = STAIR_LX0 + sp.steps - 1;
    for (let lx = Math.max(STAIR_LX0, top - STAIR_HEAD); lx <= top; lx++) {
      const [ax, az] = rotLocal(lx, sp.strip, sp.r);
      out.push(ax * CELL + az);
    }
    return out;
  }

  /** Every column a service stair and its handrail stand in. */
  private stairOf(sp: Service): number[] {
    const out: number[] = [];
    const k = kerbOf(sp.strip);
    for (let lx = STAIR_LX0; lx < STAIR_LX0 + sp.steps; lx++) {
      const [ax, az] = rotLocal(lx, sp.strip, sp.r);
      out.push(ax * CELL + az);
      const [kx, kz] = rotLocal(lx, k, sp.r);
      out.push(kx * CELL + kz);
    }
    return out;
  }

  /** A floor with another floor over it and no stair of its own is a room that must grow one. */
  private needsService(c: SkyCell): boolean {
    return this.servicePlan(c) !== null;
  }

  /**
   * Where this floor's service stair goes, or null when it has no floor over it to climb to. The
   * stair must come up where the floor above leaves room to stand — not into a hall's flight, a
   * ramp's steps or another stair's handrail — so the candidate strips and frames are tried in
   * turn against what stands up there, and the first that fits is taken. The order of trial
   * alternates strip by storey, which is what makes a stack a switchback. Nothing below this floor
   * is consulted, so the decision only ever looks upward and a stack resolves from its top down.
   */
  private servicePlan(c: SkyCell): Service | null {
    if (c.kind !== 'deck') return null;
    const above = this.plan.above(c.i, c.j, c.y);
    if (!above || above.kind === 'arena' || above.kind === 'arenaPart') return null;
    const gap = above.y - c.y;
    // Too low for a body to climb through, or too high for one flight to reach.
    if (gap < 4 || gap > STOREY + 1) return null;
    const steps = Math.min(STAIR_LX1 - STAIR_LX0 + 1, gap);
    const free = this.freeAbove(above);
    const fixed = this.rampHead(c);
    const tower = this.towerBelow(c);
    const hole = tower ? this.holeRect(tower) : null;
    if (hole) for (let lx = hole.x0; lx <= hole.x1; lx++) for (let lz = hole.z0; lz <= hole.z1; lz++) fixed.add(lx * CELL + lz);
    const [base, depth] = this.stackBase(c);
    const strips = depth % 2 === 0 ? STAIR_STRIPS : [STAIR_STRIPS[1], STAIR_STRIPS[0], STAIR_STRIPS[3], STAIR_STRIPS[2]];
    let fallback: Service | null = null;
    for (let dr = 0; dr < 4; dr++)
      for (const strip of strips) {
        const sp: Service = { r: (base.dir + dr) % 4, strip, steps };
        fallback ??= sp;
        if (this.fits(sp, free, fixed)) return sp;
      }
    return fallback;
  }

  /** True when a stair stands clear of the openings in its own floor and comes up into free space. */
  private fits(sp: Service, free: Set<number>, fixed: Set<number>): boolean {
    for (const k of this.stairOf(sp)) if (fixed.has(k)) return false;
    for (const k of this.holeOf(sp)) if (!free.has(k)) return false;
    // Off the top step: sideways onto the floor, and the parapet column beside the last rise.
    const top = STAIR_LX0 + sp.steps - 1;
    const kerb = kerbOf(sp.strip);
    for (const [lx, lz] of [
      [top, kerb],
      [top - 1, kerb],
    ]) {
      const [ax, az] = rotLocal(lx, lz, sp.r);
      if (!free.has(ax * CELL + az)) return false;
    }
    return true;
  }

  /** The bottom of a run of floors stacked one storey apart, and how many floors this one is above it. */
  private stackBase(c: SkyCell): [SkyCell, number] {
    let base = c;
    let depth = 0;
    for (let n = 0; n < 40; n++) {
      const b = this.plan.below(base.i, base.j, base.y);
      if (!b || b.kind !== 'deck' || base.y - b.y > STOREY + 1) break;
      base = b;
      depth++;
    }
    return [base, depth];
  }

  /**
   * The columns of a cell where a body can stand at its floor level: where a stair from the floor
   * below may come up. A floor's edges carry rails, its own stair and handrail take their strip, a
   * flight to a neighbour takes its lane; a ramp is free only on the flat approach before its first
   * step, a bridge between its rails, a hall along the wall its flight climbs away from.
   */
  private freeAbove(c: SkyCell): Set<number> {
    const free = new Set<number>();
    const add = (lx: number, lz: number, r: number): void => {
      const [ax, az] = rotLocal(lx, lz, r);
      free.add(ax * CELL + az);
    };
    const drop = (lx: number, lz: number, r: number): void => {
      const [ax, az] = rotLocal(lx, lz, r);
      free.delete(ax * CELL + az);
    };
    switch (c.kind) {
      case 'deck': {
        for (let lx = 1; lx <= CELL - 2; lx++) for (let lz = 1; lz <= CELL - 2; lz++) add(lx, lz, 0);
        const sp = this.servicePlan(c);
        if (sp) for (const k of this.stairOf(sp)) free.delete(k);
        const link = this.linkSide(c);
        if (link >= 0) for (let lx = 1; lx < CELL; lx++) for (let lz = 2; lz <= CELL - 2; lz++) drop(lx, lz, link);
        break;
      }
      case 'ramp':
        for (let lx = 0; lx <= 1; lx++) for (let lz = 1; lz <= CELL - 2; lz++) add(lx, lz, c.dir);
        break;
      case 'bridge':
        for (let lx = 0; lx < CELL; lx++) for (let lz = 2; lz <= CELL - 3; lz++) add(lx, lz, c.dir);
        break;
      case 'tower':
        for (let lx = 2; lx <= 5; lx++) add(lx, 1, c.dir);
        for (let lz = 3; lz <= CELL - 2; lz++) add(CELL - 2, lz, c.dir);
        break;
      default:
        break;
    }
    return free;
  }

  /**
   * The light well in this floor: a slot four long and two deep over the room below, a row in from
   * the stair that comes up from it, so the room has light and a view of its way out, the floor
   * above has a view of the room, and a walkway is left on both sides of the opening. Never across
   * a flight to a neighbour, which needs the whole floor.
   */
  private well(c: SkyCell): Set<number> {
    const out = new Set<number>();
    if (c.kind !== 'deck' || this.linkSide(c) >= 0) return out;
    const below = this.plan.below(c.i, c.j, c.y);
    if (!below || below.kind !== 'deck') return out;
    const sp = this.servicePlan(below);
    if (!sp) return out;
    const [lz0, lz1] = wellRows(sp.strip);
    for (let lx = 2; lx <= 5; lx++)
      for (let lz = lz0; lz <= lz1; lz++) {
        const [ax, az] = rotLocal(lx, lz, sp.r);
        out.add(ax * CELL + az);
      }
    return out;
  }

  /** Every column of this floor that something else already needs: openings, stairs, the well. */
  private reserved(c: SkyCell): Set<number> {
    const out = new Set<number>(this.stairHead(c).keys());
    for (const k of this.well(c)) out.add(k);
    const sp = this.servicePlan(c);
    if (sp) for (const k of this.stairOf(sp)) out.add(k);
    return out;
  }

  /**
   * The service stair of a roofed floor: single steps carried on a beam each, nothing underneath,
   * and a handrail of light beside them. Open on every side, so from anywhere in the room it reads
   * as a stair and not as a wall — the old solid flight was exactly the wall people stood in front
   * of, unable to see the way up behind it.
   */
  private service(e: Emit, c: SkyCell, S: Skin): void {
    const sp = this.servicePlan(c);
    if (!sp) return;
    const pen = new Pen(e, cellX(c.i), cellZ(c.j), sp.r);
    const put = (lx: number, lz: number, yy: number, v: number): void => pen.put(lx, lz, yy, v);
    const y = c.y;
    const step = withShape(S.floor, makeShape('stairs', sp.r));
    const rail = withShape(neon(c.color), SLAB);
    const k = kerbOf(sp.strip);
    // Everything at the level of the floor overhead belongs to that floor's cell (the top step
    // included, see stairHead): this cell writes only what is inside its own room.
    const roof = this.plan.above(c.i, c.j, c.y)!.y;
    for (let n = 0; n < sp.steps; n++) {
      const lx = STAIR_LX0 + n;
      const h = y + 1 + n;
      if (h < roof) put(lx, sp.strip, h, step);
      if (n > 0 && h - 1 < roof) put(lx, sp.strip, h - 1, S.frame);
      if (n === sp.steps - 1) continue;
      if (h < roof) put(lx, k, h, S.frame);
      if (h + 1 < roof) put(lx, k, h + 1, rail);
    }
    // Ceiling lights over the long sides, clear of the stair and of the well overhead.
    put(1, 3, y + 5, S.lamp);
    put(CELL - 2, 4, y + 5, S.lamp);
  }

  /**
   * The flight that joins a floor to the one a storey above it next door. Two floors a stride apart
   * and six blocks up were a wall you could only look at; every one of them now carries a stair,
   * three wide, each step on its own beam with nothing beneath, railed in light on both sides — a
   * way up you can see through, walk under, and fight around.
   */
  private link(e: Emit, c: SkyCell, S: Skin): void {
    const side = this.linkSide(c);
    if (side < 0) return;
    const pen = new Pen(e, cellX(c.i), cellZ(c.j), side);
    const put = (lx: number, lz: number, yy: number, v: number): void => pen.put(lx, lz, yy, v);
    const y = c.y;
    const step = withShape(S.floor, makeShape('stairs', side));
    const rail = withShape(neon(c.color), SLAB);
    for (let s = 0; s < STOREY; s++) {
      const lx = 2 + s;
      const h = y + 1 + s;
      for (let lz = 3; lz <= 5; lz++) {
        put(lx, lz, h, step);
        if (s > 0) put(lx, lz, h - 1, S.frame);
      }
      if (s === STOREY - 1) continue;
      for (const lz of [2, 6]) {
        put(lx, lz, h, S.frame);
        put(lx, lz, h + 1, rail);
      }
    }
    // Posts of light at the foot, so the way up is the brightest thing on the floor.
    put(1, 2, y + 1, withShape(neon(c.color), FENCE));
    put(1, 6, y + 1, withShape(neon(c.color), FENCE));
  }

  /**
   * What turns a floor from a table into a place worth fighting on: a few pieces that break the
   * sightline without closing it. Chest-high blocks to shoot over and climb; in two of the layouts
   * a pair of full-height pillars to hold a corner behind and peek around. They go only where this
   * cell has laid solid floor and nothing else stands, so a piece can never land on a stairwell or
   * across a flight. Five arrangements, so neighbouring floors are not the same floor twice.
   */
  private cover(e: Emit, c: SkyCell, S: Skin): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y;
    const variant = hash(c.i, c.y, c.j) % 5;
    const low: [number, number][] =
      variant === 0
        ? [
            [2, 2],
            [3, 2],
            [2, 3],
            [5, 5],
            [5, 4],
            [4, 5],
          ]
        : variant === 1
          ? [
              [3, 3],
              [4, 3],
              [3, 4],
              [4, 4],
            ]
          : variant === 2
            ? [
                [2, 3],
                [2, 4],
                [3, 4],
                [5, 4],
                [5, 3],
                [4, 3],
              ]
            : variant === 3
              ? [
                  [2, 5],
                  [3, 5],
                  [5, 2],
                  [5, 3],
                ]
              : [
                  [3, 2],
                  [4, 2],
                  [3, 5],
                  [4, 5],
                ];
    // The pillars: where the two layouts with them put their full-height posts.
    const tall: [number, number][] = variant === 3 ? [[2, 2], [5, 5]] : variant === 4 ? [[2, 4], [5, 3]] : [];
    for (const [lx, lz] of low) {
      const x = x0 + lx;
      const z = z0 + lz;
      if (!e.at(x, y, z) || e.at(x, y + 1, z) || e.at(x, y + 2, z)) continue;
      e.set(x, y + 1, z, S.panelAlt);
      // The island in the middle carries a post of light on one corner: enough to read the floor
      // from across the sky, small enough that it is still cover and not a white box in the room.
      e.set(x, y + 2, z, variant === 1 && lx === 3 && lz === 3 ? withShape(neon(c.color), FENCE) : withShape(S.frame, SLAB));
    }
    for (const [lx, lz] of tall) {
      const x = x0 + lx;
      const z = z0 + lz;
      if (!e.at(x, y, z) || e.at(x, y + 1, z) || e.at(x, y + 2, z) || e.at(x, y + 3, z)) continue;
      e.set(x, y + 1, z, S.frame);
      e.set(x, y + 2, z, S.panelAlt);
      e.set(x, y + 3, z, S.frame);
      e.set(x, y + 4, z, withShape(neon(c.color), SLAB_TOP));
    }
  }

  // ---- terrace --------------------------------------------------------------

  /** Glass balustrades between posts of light along every open edge, corner posts, and a mast on a summit. */
  private terrace(e: Emit, c: SkyCell, S: Skin): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y;
    const openSide = [0, 1, 2, 3].map((s) => this.open(c, s));
    for (let s = 0; s < 4; s++) {
      if (!openSide[s] && !this.bridgeAt(c, s)) continue;
      const gap = this.rampAt(c, s) || this.linkFrom(c, s) ? 6 : this.bridgeAt(c, s) ? 4 : 0;
      this.balustrade(e, c, S, s, gap);
    }
    // Corner posts where two open edges meet: two of frame and a light on top.
    const corners: [number, number, number, number][] = [
      [CELL - 1, CELL - 1, 0, 1],
      [0, CELL - 1, 2, 1],
      [0, 0, 2, 3],
      [CELL - 1, 0, 0, 3],
    ];
    for (const [lx, lz, a, b] of corners) {
      if (!openSide[a] || !openSide[b]) continue;
      e.set(x0 + lx, y + 1, z0 + lz, S.frame);
      e.set(x0 + lx, y + 2, z0 + lz, S.frame);
      e.set(x0 + lx, y + 3, z0 + lz, withShape(neon(c.color), FENCE));
    }
    // A summit — a deck on top of a hall with nothing above — carries a light mast on every other cell.
    const below = this.plan.below(c.i, c.j, c.y);
    if (below && !this.plan.above(c.i, c.j, c.y) && this.linkSide(c) < 0 && hash(c.i, c.j, c.y + 1) % 2 === 0) {
      const tower = this.towerBelow(c);
      const hole = tower ? this.holeRect(tower) : null;
      const taken = this.reserved(c);
      const spots: [number, number, number, number][] = [
        [1, 1, 2, 3],
        [CELL - 2, 1, 0, 3],
        [1, CELL - 2, 2, 1],
        [CELL - 2, CELL - 2, 0, 1],
      ];
      for (const [lx, lz, a, b] of spots) {
        if (!openSide[a] || !openSide[b]) continue;
        if (hole && lx >= hole.x0 - 1 && lx <= hole.x1 + 1 && lz >= hole.z0 - 1 && lz <= hole.z1 + 1) continue;
        // Never in a stair, an opening or the well, nor beside one: a mast is a pillar to the roof.
        let near = false;
        for (let dx = -1; dx <= 1 && !near; dx++) for (let dz = -1; dz <= 1 && !near; dz++) if (taken.has((lx + dx) * CELL + lz + dz)) near = true;
        if (near) continue;
        for (let h = 1; h <= 4; h++) e.set(x0 + lx, y + h, z0 + lz, withShape(S.steel, PILLAR));
        e.set(x0 + lx, y + 5, z0 + lz, S.trim);
        e.set(x0 + lx, y + 6, z0 + lz, S.lamp);
        break;
      }
    }
  }

  /** One edge of a terrace: glass panes, a post of light every third pane, and a gap where something arrives. */
  private balustrade(e: Emit, c: SkyCell, S: Skin, side: number, gap: number): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y + 1;
    const lo = (CELL - gap) / 2;
    const hi = lo + gap - 1;
    for (let t = 0; t < CELL; t++) {
      if (gap > 0 && t >= lo && t <= hi) continue;
      const [lx, lz] = alongSide(side, t);
      let v: number;
      if (t === 0 || t === CELL - 1) v = S.frame;
      else if (t === 3 && gap === 0) v = withShape(neon(c.color), FENCE);
      else v = S.glass;
      // Beside a gap the pane becomes a post, so the opening reads as a gate.
      if (gap > 0 && (t === lo - 1 || t === hi + 1)) v = S.frame;
      e.set(x0 + lx, y, z0 + lz, v);
    }
  }

  // ---- underneath -----------------------------------------------------------

  /** Fascia, and the plinth or keel that makes a floating floor look carried rather than pasted into the air. */
  private under(e: Emit, c: SkyCell, S: Skin): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y;
    const below = this.plan.below(c.i, c.j, c.y);
    // The fascia: a full beam under every open edge, so a floor is never a sheet of paper.
    if (!below) {
      for (let s = 0; s < 4; s++) {
        if (!this.open(c, s)) continue;
        for (let t = 0; t < CELL; t++) {
          const [lx, lz] = alongSide(s, t);
          e.set(x0 + lx, y - 1, z0 + lz, S.frame);
        }
      }
    }
    if (below) return;
    const ground = this.terrain.heightAt(x0 + CELL / 2, z0 + CELL / 2);
    if (y - ground <= STOREY + 2 && ground > 0.5) {
      // Near the ground: four pylons to the earth, tied by beams, with the passage left open between them.
      const base = Math.max(1, Math.floor(ground));
      for (const [px, pz] of [
        [0, 0],
        [CELL - 2, 0],
        [0, CELL - 2],
        [CELL - 2, CELL - 2],
      ] as [number, number][]) {
        for (let yy = y - 2; yy >= base; yy--) e.box(x0 + px, yy, z0 + pz, x0 + px + 1, yy, z0 + pz + 1, S.frame);
      }
      if (y - 2 >= base) {
        for (let t = 2; t <= CELL - 3; t++) {
          e.set(x0 + t, y - 2, z0, S.steel);
          e.set(x0 + t, y - 2, z0 + CELL - 1, S.steel);
          e.set(x0, y - 2, z0 + t, S.steel);
          e.set(x0 + CELL - 1, y - 2, z0 + t, S.steel);
        }
        e.box(x0 + 1, y - 2, z0 + 1, x0 + CELL - 2, y - 2, z0 + CELL - 2, S.panelAlt);
      }
      return;
    }
    // Out over the water or high in the air: a stepped keel with a crystal heart in the builder's colour.
    e.box(x0 + 1, y - 2, z0 + 1, x0 + 6, y - 2, z0 + 6, S.steel);
    e.box(x0 + 2, y - 3, z0 + 2, x0 + 5, y - 3, z0 + 5, S.frame);
    e.box(x0 + 3, y - 4, z0 + 3, x0 + 4, y - 4, z0 + 4, crystal(c.color));
    // Fins on the diagonals, so the keel reads as engineered rather than melted.
    for (const [fx, fz] of [
      [0, 0],
      [7, 0],
      [0, 7],
      [7, 7],
    ] as [number, number][]) {
      e.set(x0 + fx, y - 2, z0 + fz, withShape(S.steel, SLAB));
    }
  }

  // ---- hall -----------------------------------------------------------------

  /** Where this hall's stair must come through the floor above. */
  holeRect(c: SkyCell): { x0: number; x1: number; z0: number; z1: number } {
    const pts: [number, number][] = [];
    for (let lx = HOLE.lx0; lx <= HOLE.lx1; lx++) for (let lz = HOLE.lz0; lz <= HOLE.lz1; lz++) pts.push(rotLocal(lx, lz, c.dir));
    let x0 = CELL;
    let x1 = 0;
    let z0 = CELL;
    let z1 = 0;
    for (const [lx, lz] of pts) {
      x0 = Math.min(x0, lx);
      x1 = Math.max(x1, lx);
      z0 = Math.min(z0, lz);
      z1 = Math.max(z1, lz);
    }
    return { x0, x1, z0, z1 };
  }

  /**
   * A storey of a tower: dark pilasters at the corners, a beam row under the next floor, band windows
   * of glass between light spandrels, a framed portal with a lit sign on the side you came from and
   * on any side a neighbour reaches, and inside one straight flight to the roof under a lit ceiling.
   */
  private hall(e: Emit, c: SkyCell, S: Skin): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y;
    const r = c.dir;
    const pen = new Pen(e, x0, z0, r);
    const put = (lx: number, lz: number, yy: number, v: number): void => pen.put(lx, lz, yy, v);
    // A hall is always a way through, never a dead end: the face the stair climbs away from — the
    // side whoever built it stands on — and the face opposite it are both open, and so is any side
    // where a deck or a stair already reaches the wall. The two remaining faces are the cover.
    const doors = [0, 1, 2, 3].map((s) => s === (c.dir + 2) % 4 || s === c.dir || !this.open(c, s) || this.rampAt(c, s));
    // Two window rhythms: a band window across the face, or two tall slots.
    const tall = hash(c.i, c.j, c.y) % 2 === 1;
    for (let s = 0; s < 4; s++) {
      const localSide = (s - r + 4) % 4;
      for (let t = 0; t < CELL; t++) {
        const [lx, lz] = alongSide(localSide, t);
        for (let h = 1; h <= 5; h++) {
          let v: number;
          if (t === 0 || t === CELL - 1) v = S.frame;
          else if (h === 5) {
            // The beam row: frame, with a metal lintel and a lit sign over the portal.
            v = doors[s] && t >= PORTAL_FROM && t <= PORTAL_TO ? withShape(neon(c.color), SLAB_TOP) : S.frame;
          } else if (doors[s]) {
            if (t >= PORTAL_FROM && t <= PORTAL_TO) v = AIR;
            else if (t === PORTAL_FROM - 1 || t === PORTAL_TO + 1) v = S.frame;
            else v = h === 2 || h === 3 ? S.glass : S.panel;
          } else if (tall) {
            v = (t === 2 || t === 5) && h <= 4 ? S.glass : h === 4 ? S.panel : S.panel;
            if ((t === 3 || t === 4) && h === 4) v = S.trim;
          } else {
            v = h === 2 || h === 3 ? (t === 1 || t === CELL - 2 ? S.panel : S.glass) : S.panel;
          }
          put(lx, lz, y + h, v);
        }
      }
    }
    // One straight flight, three wide, climbing away from the portal to the roof: five steps and the
    // slab above as the sixth rise, each step on its own beam with the hall open beneath, and a
    // handrail of light beside them. Solid stringers made the flight a box in the middle of the
    // room; open, the hall is one space with a stair in it.
    const step = withShape(S.floor, makeShape('stairs', r));
    for (let s = 0; s < 5; s++) {
      const lx = 1 + s;
      const h = y + 1 + s;
      for (let lz = 3; lz <= 5; lz++) {
        put(lx, lz, h, step);
        if (s > 0) put(lx, lz, h - 1, S.frame);
      }
      if (s > 0) {
        for (const lz of [2, 6]) {
          put(lx, lz, h, S.frame);
          put(lx, lz, h + 1, withShape(neon(c.color), SLAB));
        }
      }
    }
    // Ceiling lights along both side walls.
    for (const [lx, lz] of [
      [2, 1],
      [5, 1],
      [2, 6],
      [5, 6],
    ] as [number, number][]) {
      put(lx, lz, y + 5, S.lamp);
    }
    // Columns in the free corners of the hall, and a low wall to fight behind.
    for (const [lx, lz] of [
      [1, 1],
      [1, 6],
    ] as [number, number][]) {
      for (let h = 1; h <= 3; h++) put(lx, lz, y + h, withShape(S.steel, PILLAR));
      put(lx, lz, y + 4, S.frame);
    }
    put(6, 1, y + 1, S.panelAlt);
    put(6, 2, y + 1, S.panelAlt);
  }

  // ---- grand stair ----------------------------------------------------------

  /** A stair six wide between two stringer walls with a glowing handrail, a passage under it. */
  private stair(e: Emit, c: SkyCell, S: Skin): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y;
    const r = c.dir;
    const pen = new Pen(e, x0, z0, r);
    const put = (lx: number, lz: number, yy: number, v: number): void => pen.put(lx, lz, yy, v);
    const holes = this.stairHead(c);
    for (let lx = 0; lx < CELL; lx++)
      for (let lz = 0; lz < CELL; lz++) {
        const [ax, az] = rotLocal(lx, lz, r);
        // A stair climbing under this one comes up through the floor rather than into it.
        if (holes.has(ax * CELL + az)) this.opening(e, x0 + ax, y, z0 + az, holes.get(ax * CELL + az) ?? AIR);
        else put(lx, lz, y, lz === 0 || lz === CELL - 1 ? S.frame : S.floor);
      }
    const step = withShape(S.floor, makeShape('stairs', r));
    const rail = withShape(neon(c.color), SLAB);
    // The two long sides of the flight, and whether a floor stands against each of them.
    const stringers: [number, boolean][] = [
      [0, !this.open(c, (r + 3) % 4)],
      [CELL - 1, !this.open(c, (r + 1) % 4)],
    ];
    for (let s = 0; s < 6; s++) {
      const lx = 2 + s;
      const h = y + 1 + s;
      for (let lz = 1; lz <= 6; lz++) {
        put(lx, lz, h, step);
        for (let f = y + 1; f < h; f++) {
          const tunnel = lz >= 2 && lz <= 5 && f <= y + 3 && lx >= 4;
          put(lx, lz, f, tunnel ? AIR : S.panelAlt);
        }
      }
      // Stringer walls: cladding below, a frame beam at the top, and the light rail on it. Where a
      // floor stands beside the foot of the flight the wall opens into a landing instead: the climb
      // must never be a blank six-block wall to whoever is standing one step away from it.
      for (const [lz, gated] of stringers) {
        if (gated && lx <= STAIR_GATE_UNTIL) continue;
        for (let f = y + 1; f < h; f++) put(lx, lz, f, S.panelAlt);
        put(lx, lz, h, S.frame);
        put(lx, lz, h + 1, rail);
      }
    }
    // The flat approach keeps the rail going, and the passage under the flight has a framed mouth.
    for (const [lz, gated] of stringers) {
      if (gated) continue;
      for (let lx = 0; lx <= 1; lx++) {
        put(lx, lz, y + 1, S.frame);
        put(lx, lz, y + 2, rail);
      }
    }
    for (let lz = 1; lz <= 6; lz++) put(CELL - 1, lz, y + 4, S.frame);
  }

  // ---- bridge ---------------------------------------------------------------

  /** A six-wide deck with edge beams, glass rails between posts of light, and a girder arch underneath. */
  private bridge(e: Emit, c: SkyCell, S: Skin): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y;
    const r = c.dir;
    const pen = new Pen(e, x0, z0, r);
    const put = (lx: number, lz: number, yy: number, v: number): void => pen.put(lx, lz, yy, v);
    const holes = this.stairHead(c);
    for (let lx = 0; lx < CELL; lx++) {
      for (let lz = 1; lz <= 6; lz++) {
        const [ax, az] = rotLocal(lx, lz, r);
        if (holes.has(ax * CELL + az)) this.opening(e, x0 + ax, y, z0 + az, holes.get(ax * CELL + az) ?? AIR);
        else put(lx, lz, y, lz === 1 || lz === 6 ? S.frame : lx % 4 === 0 && lz >= 3 && lz <= 4 ? S.inlay : S.floor);
      }
      // Rails: posts at the ends, a light post every fourth block, glass between — and none over a
      // stair coming up from below, whose head would meet the pane.
      const end = lx === 0 || lx === CELL - 1;
      const post = lx % 4 === 2;
      const railV = end ? S.frame : post ? withShape(neon(c.color), FENCE) : S.glass;
      for (const lz of [1, 6]) {
        const [ax, az] = rotLocal(lx, lz, r);
        if (!holes.has(ax * CELL + az)) put(lx, lz, y + 1, railV);
      }
      if (end) {
        put(lx, 1, y + 2, withShape(neon(c.color), FENCE));
        put(lx, 6, y + 2, withShape(neon(c.color), FENCE));
      }
      // Edge beams under the deck and the girder arch: deepest in the middle, tapering to the ends.
      put(lx, 1, y - 1, S.frame);
      put(lx, 6, y - 1, S.frame);
      const t = Math.abs(lx - 3.5) / 3.5;
      const depth = t < 0.35 ? 2 : t < 0.75 ? 1 : 0;
      for (let d = 1; d <= depth; d++) for (let lz = 3; lz <= 4; lz++) put(lx, lz, y - d, d === depth ? S.frame : S.steel);
    }
  }

  // ---- stadium --------------------------------------------------------------

  /** Three cells square: a round court in a two-step bowl, four framed gates, light masts and a lit dais. */
  private stadium(e: Emit, c: SkyCell, S: Skin): void {
    const cx = cellX(c.i) + CELL / 2;
    const cz = cellZ(c.j) + CELL / 2;
    const y = c.y;
    const R = 11.5;
    const ground = this.terrain.heightAt(cx, cz);
    const floating = c.y - ground > STOREY;
    const carried = !!this.plan.below(c.i, c.j, c.y);
    const holes = this.stairHead(c);
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++)
      for (let z = Math.floor(cz - R); z <= Math.ceil(cz + R); z++) {
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
        if (d > R) continue;
        if (holes.has((x - x0) * CELL + (z - z0))) {
          this.opening(e, x, y, z, holes.get((x - x0) * CELL + (z - z0)) ?? AIR);
          continue;
        }
        e.set(x, y, z, d > R - 1.5 ? S.frame : d > R - 2.5 ? S.inlay : S.floor);
        if (carried) continue;
        if (floating) {
          // A stepped keel under the whole bowl with a ring of light and a crystal heart.
          if (d < R - 1.5) e.set(x, y - 1, z, S.steel);
          if (d < R - 4) e.set(x, y - 2, z, S.frame);
          if (d < R - 6) e.set(x, y - 3, z, d >= R - 7 ? crystal(c.color) : S.steel);
          if (d < 2.5) e.set(x, y - 4, z, crystal(c.color));
        } else if (d < R - 3) {
          for (let yy = y - 1; yy > ground; yy--) e.set(x, yy, z, d > R - 5 ? (yy === y - 1 ? S.frame : S.panel) : yy > y - 3 ? S.panelAlt : AIR);
        }
      }
    // The bowl: a two-wide tier at the rim, a glass parapet on top with posts of light, four gates on the axes.
    const onAxis = (rad: number): boolean => Math.abs(Math.cos(rad)) > 0.982 || Math.abs(Math.sin(rad)) > 0.982;
    for (let a = 0; a < 360; a += 1) {
      const rad = (a * Math.PI) / 180;
      if (onAxis(rad)) continue;
      for (const rr of [R - 0.5, R - 1.5]) {
        const x = Math.floor(cx + Math.cos(rad) * rr);
        const z = Math.floor(cz + Math.sin(rad) * rr);
        e.set(x, y + 1, z, S.steel);
      }
      const x = Math.floor(cx + Math.cos(rad) * (R - 0.5));
      const z = Math.floor(cz + Math.sin(rad) * (R - 0.5));
      e.set(x, y + 2, z, a % 30 === 15 ? withShape(neon(c.color), FENCE) : S.glass);
    }
    // Gate pylons either side of each axis opening, with a metal cap.
    for (let g = 0; g < 4; g++) {
      const rad = (g * Math.PI) / 2;
      const nx = -Math.sin(rad);
      const nz = Math.cos(rad);
      for (const side of [-1, 1]) {
        const px = Math.floor(cx + Math.cos(rad) * (R - 1) + nx * side * 2.8);
        const pz = Math.floor(cz + Math.sin(rad) * (R - 1) + nz * side * 2.8);
        for (let h = 1; h <= 5; h++) e.set(px, y + h, pz, S.frame);
        e.set(px, y + 6, pz, withShape(neon(c.color), FENCE));
      }
    }
    // Four light masts on the diagonals, tall and thin, lit at the top.
    for (let m = 0; m < 4; m++) {
      const rad = ((m * 90 + 45) * Math.PI) / 180;
      const px = Math.floor(cx + Math.cos(rad) * (R - 4.5));
      const pz = Math.floor(cz + Math.sin(rad) * (R - 4.5));
      for (let h = 1; h <= 6; h++) e.set(px, y + h, pz, withShape(S.steel, PILLAR));
      e.set(px, y + 7, pz, S.trim);
      e.set(px, y + 8, pz, S.lamp);
    }
    // The dais in the middle: two steps, a ring of light and a metal heart, stairs on the four axes.
    for (let x = Math.floor(cx - 4); x <= Math.ceil(cx + 4); x++)
      for (let z = Math.floor(cz - 4); z <= Math.ceil(cz + 4); z++) {
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
        if (d <= 3.5) {
          e.set(x, y + 1, z, d > 2.6 ? S.frame : S.steel);
          e.set(x, y + 2, z, d < 1.2 ? S.trim : d > 3 ? S.frame : d > 2.2 ? crystal(c.color) : S.floor);
        }
      }
    for (let s = 0; s < 4; s++) {
      const [dx, dz] = DIRS[s];
      for (let w = -1; w <= 0; w++) {
        const ox = dz === 0 ? 0 : w;
        const oz = dx === 0 ? 0 : w;
        e.set(Math.floor(cx) + dx * 4 + ox, y + 1, Math.floor(cz) + dz * 4 + oz, withShape(S.panelAlt, makeShape('stairs', (s + 2) % 4)));
      }
    }
  }

  // ---- walking --------------------------------------------------------------

  /** The line a walker follows through a module, from its entrance to where it comes out. */
  waypoints(c: SkyCell): THREE.Vector3[] {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y;
    const out: THREE.Vector3[] = [];
    const at = (lx: number, lz: number, yy: number): THREE.Vector3 => {
      const [ax, az] = rotLocal(lx, lz, c.dir);
      return new THREE.Vector3(x0 + ax + 0.5, yy, z0 + az + 0.5);
    };
    if (c.kind === 'tower') {
      // In at the portal, straight up the flight, out onto the roof. A stair is climbed from its low
      // end, so the portal and the first step are on the same line.
      out.push(at(0.5, 4, y + 1), at(3.5, 4, y + 4), at(6.5, 4, y + 7));
    } else if (c.kind === 'ramp') {
      out.push(at(0.5, 3.5, y + 1), at(4, 3.5, y + 4), at(7.5, 3.5, y + 7));
    } else {
      const link = this.linkSide(c);
      const well = this.well(c);
      const below = this.plan.below(c.i, c.j, c.y);
      const sp = below && well.size > 0 ? this.servicePlan(below) : null;
      if (sp) {
        // The middle is the well: stand on the solid row past it instead.
        const [wx, wz] = rotLocal(0, 3, sp.r);
        out.push(new THREE.Vector3(x0 + wx + 0.5, y + 1, z0 + wz + 0.5));
      } else if (link >= 0) {
        // A floor that carries a flight is routed through the flight: in at its foot, out at its
        // head, because the centre of the floor is now the middle of a staircase.
        const [fx, fz] = rotLocal(1, 4, link);
        const [hx, hz] = rotLocal(CELL - 1, 4, link);
        out.push(new THREE.Vector3(x0 + fx + 0.5, y + 1, z0 + fz + 0.5));
        out.push(new THREE.Vector3(x0 + hx + 0.5, y + 1 + STOREY, z0 + hz + 0.5));
      } else out.push(new THREE.Vector3(x0 + CELL / 2, y + 1, z0 + CELL / 2));
    }
    return out;
  }
}
