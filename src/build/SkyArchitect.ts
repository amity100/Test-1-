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
        this.terrace(e, c, S);
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
    const inHole = (lx: number, lz: number): boolean => !!hole && lx >= hole.x0 && lx <= hole.x1 && lz >= hole.z0 && lz <= hole.z1;
    const variant = hash(c.i, c.j, c.y) % 3;
    for (let lx = 0; lx < CELL; lx++)
      for (let lz = 0; lz < CELL; lz++) {
        if (inHole(lx, lz)) {
          e.clear(x0 + lx, y, z0 + lz);
          continue;
        }
        const edge =
          (lx === 0 && openSide[2]) || (lx === CELL - 1 && openSide[0]) || (lz === 0 && openSide[3]) || (lz === CELL - 1 && openSide[1]);
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

  // ---- terrace --------------------------------------------------------------

  /** Glass balustrades between posts of light along every open edge, corner posts, and a mast on a summit. */
  private terrace(e: Emit, c: SkyCell, S: Skin): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y;
    const openSide = [0, 1, 2, 3].map((s) => this.open(c, s));
    for (let s = 0; s < 4; s++) {
      if (!openSide[s] && !this.bridgeAt(c, s)) continue;
      const gap = this.rampAt(c, s) ? 6 : this.bridgeAt(c, s) ? 4 : 0;
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
      e.set(x0 + lx, y + 3, z0 + lz, crystal(c.color));
    }
    // A summit — a deck on top of a hall with nothing above — carries a light mast on every other cell.
    const below = this.plan.below(c.i, c.j, c.y);
    if (below && !this.plan.above(c.i, c.j, c.y) && hash(c.i, c.j, c.y + 1) % 2 === 0) {
      const tower = this.towerBelow(c);
      const hole = tower ? this.holeRect(tower) : null;
      const spots: [number, number, number, number][] = [
        [1, 1, 2, 3],
        [CELL - 2, 1, 0, 3],
        [1, CELL - 2, 2, 1],
        [CELL - 2, CELL - 2, 0, 1],
      ];
      for (const [lx, lz, a, b] of spots) {
        if (!openSide[a] || !openSide[b]) continue;
        if (hole && lx >= hole.x0 - 1 && lx <= hole.x1 + 1 && lz >= hole.z0 - 1 && lz <= hole.z1 + 1) continue;
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
    // The way in is the face the stair climbs away from — the side whoever built it stands on — and
    // any side where a deck or stair already reaches the wall.
    const doors = [0, 1, 2, 3].map((s) => s === (c.dir + 2) % 4 || !this.open(c, s) || this.rampAt(c, s));
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
            v = doors[s] && t === 4 ? crystal(c.color) : S.frame;
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
    // slab above as the sixth rise, carried on a solid stringer with a glowing handrail on top.
    const step = withShape(S.floor, makeShape('stairs', r));
    for (let s = 0; s < 5; s++) {
      const lx = 1 + s;
      const h = y + 1 + s;
      for (let lz = 3; lz <= 5; lz++) {
        put(lx, lz, h, step);
        for (let f = y + 1; f < h; f++) put(lx, lz, f, S.panelAlt);
      }
      if (s > 0) {
        for (let f = y + 1; f < h; f++) {
          put(lx, 2, f, f === h - 1 ? S.frame : S.panelAlt);
          put(lx, 6, f, f === h - 1 ? S.frame : S.panelAlt);
        }
        put(lx, 2, h, withShape(neon(c.color), SLAB));
        put(lx, 6, h, withShape(neon(c.color), SLAB));
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
    for (let lx = 0; lx < CELL; lx++) for (let lz = 0; lz < CELL; lz++) put(lx, lz, y, lz === 0 || lz === CELL - 1 ? S.frame : S.floor);
    const step = withShape(S.floor, makeShape('stairs', r));
    const rail = withShape(neon(c.color), SLAB);
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
      // Stringer walls: cladding below, a frame beam at the top, and the light rail on it.
      for (let f = y + 1; f < h; f++) {
        put(lx, 0, f, S.panelAlt);
        put(lx, CELL - 1, f, S.panelAlt);
      }
      put(lx, 0, h, S.frame);
      put(lx, CELL - 1, h, S.frame);
      put(lx, 0, h + 1, rail);
      put(lx, CELL - 1, h + 1, rail);
    }
    // The flat approach keeps the rail going, and the passage under the flight has a framed mouth.
    for (let lx = 0; lx <= 1; lx++) {
      put(lx, 0, y + 1, S.frame);
      put(lx, CELL - 1, y + 1, S.frame);
      put(lx, 0, y + 2, rail);
      put(lx, CELL - 1, y + 2, rail);
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
    for (let lx = 0; lx < CELL; lx++) {
      for (let lz = 1; lz <= 6; lz++) put(lx, lz, y, lz === 1 || lz === 6 ? S.frame : lx % 4 === 0 && lz >= 3 && lz <= 4 ? S.inlay : S.floor);
      // Rails: posts at the ends, a light post every fourth block, glass between.
      const end = lx === 0 || lx === CELL - 1;
      const post = lx % 4 === 2;
      const railV = end ? S.frame : post ? withShape(neon(c.color), FENCE) : S.glass;
      put(lx, 1, y + 1, railV);
      put(lx, 6, y + 1, railV);
      if (end) {
        put(lx, 1, y + 2, crystal(c.color));
        put(lx, 6, y + 2, crystal(c.color));
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
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++)
      for (let z = Math.floor(cz - R); z <= Math.ceil(cz + R); z++) {
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
        if (d > R) continue;
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
        e.set(px, y + 6, pz, crystal(c.color));
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
      out.push(new THREE.Vector3(x0 + CELL / 2, y + 1, z0 + CELL / 2));
    }
    return out;
  }
}
