import * as THREE from 'three';
import { Mat, encodeBlock, makeShape } from '../world/Voxel';
import type { Terrain } from '../world/Terrain';
import { CELL, DIRS, STOREY, SkyPlan, cellX, cellZ, type SkyCell } from './SkyPlan';
import { SKY_DEEP_PALETTE, SKY_PALETTE, SKY_PLAYER_PALETTE, SKY_STONE } from '../world/Voxel';

/**
 * The sky architect. It takes one cell of the plan, looks at what stands around it, and returns the
 * finished masonry for it: marble floors inside a coloured rim, parapets with gold merlons and lamp
 * posts, stair towers with arched doors and arrow slits, ramps carried on vaults, railed bridges,
 * and round arenas with bastions, colonnades and a raised dais. Nothing is decorative only — every
 * floor is stood on, every arch is walked through, every parapet is fought over.
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
const FLOOR = encodeBlock(Mat.MARBLE, SKY_PALETTE.floor);
const FLOOR_SLAB = encodeBlock(Mat.MARBLE, SKY_PALETTE.floor, makeShape('slab'));
const WALL = encodeBlock(Mat.SMOOTH_STONE, SKY_STONE.wall);
const BAND = encodeBlock(Mat.SMOOTH_STONE, SKY_STONE.band);
const BAND_SLAB = encodeBlock(Mat.SMOOTH_STONE, SKY_STONE.band, makeShape('slab'));
const PILLAR = encodeBlock(Mat.MARBLE, SKY_PALETTE.pillar, makeShape('pillar'));
const COLUMN = encodeBlock(Mat.MARBLE, SKY_PALETTE.pillar);
const GOLD = encodeBlock(Mat.GOLD, SKY_PALETTE.gold);
const GOLD_SLAB = encodeBlock(Mat.GOLD, SKY_PALETTE.gold, makeShape('slab'));
const GOLD_FENCE = encodeBlock(Mat.GOLD, SKY_PALETTE.gold, makeShape('fence'));
const LAMP = encodeBlock(Mat.LAMP, SKY_PALETTE.gold, makeShape('fence'));

function deep(color: number): number {
  return encodeBlock(Mat.SMOOTH_STONE, SKY_DEEP_PALETTE + (((color - SKY_PLAYER_PALETTE) % 12) + 12) % 12);
}
function glow(color: number): number {
  return encodeBlock(Mat.CRYSTAL, color);
}
function stairs(rot: number): number {
  return encodeBlock(Mat.MARBLE, SKY_PALETTE.floor, makeShape('stairs', rot));
}
function stoneStairs(rot: number): number {
  return encodeBlock(Mat.SMOOTH_STONE, SKY_STONE.wall, makeShape('stairs', rot));
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

/** Where a stair tower needs its ceiling left open, in cell-local coordinates. */
const HOLE = { lx0: 3, lx1: 5, lz0: 3, lz1: 5 };
/** The arch opening on a tower or room face: three blocks wide, four tall. */
const ARCH_FROM = 3;
const ARCH_TO = 5;

export class SkyArchitect {
  constructor(
    private plan: SkyPlan,
    private terrain: Terrain,
  ) {}

  /** Every block of one cell. Neighbours are read from the plan, so a cell knows its own edges. */
  generate(c: SkyCell): Map<number, number> {
    const e = new Emit();
    // A building cuts into the hill it stands against: clear the room before dressing it, so a door
    // never opens into earth and a hall is always a hall.
    if (c.kind !== 'arenaPart') this.carve(e, c);
    switch (c.kind) {
      case 'deck':
        this.deck(e, c);
        break;
      case 'tower':
        this.deck(e, c);
        this.tower(e, c);
        break;
      case 'ramp':
        this.ramp(e, c);
        break;
      case 'bridge':
        this.bridge(e, c);
        break;
      case 'arena':
        this.arena(e, c);
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
    // A step of apron outside the walls, so a doorway cut into a hillside is still a doorway.
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

  /** A ramp one storey down that climbs into this cell from `side` (its landing is our floor). */
  private rampAt(c: SkyCell, side: number): boolean {
    const [dx, dz] = DIRS[side];
    const back = this.plan.get(c.i - dx, c.j - dz, c.y - STOREY);
    return !!back && back.kind === 'ramp' && back.dir === side;
  }

  /** A bridge beside this cell on that side: the parapet keeps its ends and opens in the middle. */
  private bridgeAt(c: SkyCell, side: number): boolean {
    const [dx, dz] = DIRS[side];
    return this.plan.get(c.i + dx, c.j + dz, c.y)?.kind === 'bridge';
  }

  /** The tower below whose stair must come through this cell's floor. */
  private towerBelow(c: SkyCell): SkyCell | null {
    const b = this.plan.below(c.i, c.j, c.y);
    return b && b.kind === 'tower' ? b : null;
  }

  /** How far the terrain is under a cell's floor slab (Infinity when it is out over the sea). */
  private drop(c: SkyCell): number {
    const h = this.terrain.heightAt(cellX(c.i) + CELL / 2, cellZ(c.j) + CELL / 2);
    return c.y - h;
  }

  // ---- deck -----------------------------------------------------------------

  /** Floor, rim, parapets, corner posts and whatever carries the cell from below. */
  private deck(e: Emit, c: SkyCell): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y;
    const rim = BAND;
    const tower = this.towerBelow(c);
    const hole = tower ? this.holeRect(tower) : null;
    const openSide = [0, 1, 2, 3].map((s) => this.open(c, s));
    for (let lx = 0; lx < CELL; lx++)
      for (let lz = 0; lz < CELL; lz++) {
        if (hole && lx >= hole.x0 && lx <= hole.x1 && lz >= hole.z0 && lz <= hole.z1) {
          e.clear(x0 + lx, y, z0 + lz);
          continue;
        }
        // The rim runs along the edges that face out, in the builder's own deep colour.
        const edge =
          (lx === 0 && openSide[2]) || (lx === CELL - 1 && openSide[0]) || (lz === 0 && openSide[3]) || (lz === CELL - 1 && openSide[1]);
        e.set(x0 + lx, y, z0 + lz, edge ? rim : FLOOR);
      }
    // A gold lozenge in the middle of the floor, so an empty deck still reads as a room.
    const inHole = (lx: number, lz: number): boolean => !!hole && lx >= hole.x0 && lx <= hole.x1 && lz >= hole.z0 && lz <= hole.z1;
    if (c.kind === 'deck' && !inHole(3, 3) && !inHole(4, 4)) {
      e.set(x0 + 3, y, z0 + 4, GOLD);
      e.set(x0 + 4, y, z0 + 3, GOLD);
      e.set(x0 + 3, y, z0 + 3, glow(c.color));
      e.set(x0 + 4, y, z0 + 4, glow(c.color));
    }
    // Parapets: chest-high wall with merlons wherever the deck ends, minus the ways in.
    if (c.kind === 'deck') {
      for (let s = 0; s < 4; s++) {
        if (!openSide[s] && !this.bridgeAt(c, s)) continue;
        const gap = this.rampAt(c, s) ? 6 : this.bridgeAt(c, s) ? 4 : 0;
        this.parapet(e, c, s, gap);
      }
      this.cornerPosts(e, c, openSide);
    }
    this.underneath(e, c);
  }

  /** One edge of a deck: wall, merlons, and a centred gap where something arrives. */
  private parapet(e: Emit, c: SkyCell, side: number, gap: number): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y + 1;
    const wall = WALL;
    const lo = (CELL - gap) / 2;
    const hi = lo + gap - 1;
    for (let t = 0; t < CELL; t++) {
      if (gap > 0 && t >= lo && t <= hi) continue;
      let lx: number;
      let lz: number;
      switch (side) {
        case 0:
          lx = CELL - 1;
          lz = t;
          break;
        case 1:
          lx = t;
          lz = CELL - 1;
          break;
        case 2:
          lx = 0;
          lz = t;
          break;
        default:
          lx = t;
          lz = 0;
      }
      e.set(x0 + lx, y, z0 + lz, wall);
      // Crenellation: a merlon every third block, gold only at the ends of a run.
      if (t % 3 === 1) e.set(x0 + lx, y + 1, z0 + lz, t === 1 || t === CELL - 2 ? GOLD_SLAB : BAND_SLAB);
    }
  }

  /** Lamp-topped pillars where two open edges meet. */
  private cornerPosts(e: Emit, c: SkyCell, openSide: boolean[]): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y + 1;
    const corners: [number, number, number, number][] = [
      [CELL - 1, CELL - 1, 0, 1],
      [0, CELL - 1, 2, 1],
      [0, 0, 2, 3],
      [CELL - 1, 0, 0, 3],
    ];
    for (const [lx, lz, a, b] of corners) {
      if (!openSide[a] || !openSide[b]) continue;
      e.set(x0 + lx, y, z0 + lz, PILLAR);
      e.set(x0 + lx, y + 1, z0 + lz, PILLAR);
      e.set(x0 + lx, y + 2, z0 + lz, LAMP);
    }
  }

  /** The plinth or keel that makes a floating floor look carried rather than pasted into the air. */
  private underneath(e: Emit, c: SkyCell): void {
    if (this.plan.below(c.i, c.j, c.y)) return;
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y;
    const ground = this.terrain.heightAt(x0 + CELL / 2, z0 + CELL / 2);
    if (y - ground <= STOREY + 2 && ground > 0.5) {
      // Near the ground: a masonry plinth with an arch through each face.
      const base = Math.max(1, Math.floor(ground));
      for (let yy = y - 1; yy >= base; yy--)
        for (let lx = 1; lx <= 6; lx++)
          for (let lz = 1; lz <= 6; lz++) {
            const ring = lx === 1 || lx === 6 || lz === 1 || lz === 6;
            if (!ring && yy < y - 1) continue;
            const arch = yy <= base + 2 && ((lx >= 3 && lx <= 4 && (lz === 1 || lz === 6)) || (lz >= 3 && lz <= 4 && (lx === 1 || lx === 6)));
            if (arch) continue;
            e.set(x0 + lx, yy, z0 + lz, yy === y - 1 ? BAND : WALL);
          }
      return;
    }
    // Out over the water: a stepped keel with a crystal heart in the builder's colour.
    e.box(x0 + 1, y - 1, z0 + 1, x0 + 6, y - 1, z0 + 6, BAND);
    e.box(x0 + 2, y - 2, z0 + 2, x0 + 5, y - 2, z0 + 5, WALL);
    e.box(x0 + 3, y - 4, z0 + 3, x0 + 4, y - 3, z0 + 4, glow(c.color));
  }

  // ---- tower ----------------------------------------------------------------

  /** Where this tower's stair must come through the floor above. */
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

  /** Walls with an arched door and arrow slits, and two flights of stairs to the floor above. */
  private tower(e: Emit, c: SkyCell): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y;
    const r = c.dir;
    const put = (lx: number, lz: number, yy: number, v: number): void => {
      const [ax, az] = rotLocal(lx, lz, r);
      e.set(x0 + ax, yy, z0 + az, v);
    };
    // The way in is the face the stair climbs away from — the side whoever built it stands on — and
    // any side where a deck already reaches the wall.
    const doors = [0, 1, 2, 3].map((s) => s === (c.dir + 2) % 4 || !this.open(c, s) || this.rampAt(c, s));
    // Walls. Authored per side in local terms, then rotated with the rest.
    for (let s = 0; s < 4; s++) {
      const localSide = (s - r + 4) % 4;
      for (let t = 0; t < CELL; t++) {
        for (let h = 1; h <= 5; h++) {
          const inDoor = doors[s] && t >= ARCH_FROM && t <= ARCH_TO && h <= 4;
          const corbel = doors[s] && t >= ARCH_FROM && t <= ARCH_TO && h === 5;
          const slit = !doors[s] && (t === 2 || t === 5) && (h === 2 || h === 3);
          let lx: number;
          let lz: number;
          switch (localSide) {
            case 0:
              lx = CELL - 1;
              lz = t;
              break;
            case 1:
              lx = t;
              lz = CELL - 1;
              break;
            case 2:
              lx = 0;
              lz = t;
              break;
            default:
              lx = t;
              lz = 0;
          }
          if (inDoor || slit) {
            put(lx, lz, y + h, AIR);
            continue;
          }
          if (corbel && (t === ARCH_FROM || t === ARCH_TO)) {
            put(lx, lz, y + h, BAND);
            continue;
          }
          put(lx, lz, y + h, h === 4 ? BAND : WALL);
        }
      }
    }
    // Quoins: pillar stone up the four corners, so the tower has edges you can read.
    for (const [lx, lz] of [
      [0, 0],
      [0, CELL - 1],
      [CELL - 1, 0],
      [CELL - 1, CELL - 1],
    ] as [number, number][]) {
      for (let h = 1; h <= 5; h++) put(lx, lz, y + h, h % 2 === 1 ? PILLAR : WALL);
    }
    // The banner of the builder: coloured cloth either side of the door, lit from a small crystal.
    put(CELL - 1, 2, y + 2, deep(c.color));
    put(CELL - 1, 2, y + 3, glow(c.color));
    put(CELL - 1, 5, y + 2, deep(c.color));
    put(CELL - 1, 5, y + 3, glow(c.color));
    // One straight flight, three wide, climbing away from the door to the roof: six steps over six
    // metres, carried on a vault, with a walkway either side of it at hall level.
    // Five steps; the sixth rise is the floor slab of the deck above, which the flight meets flush.
    const step = stairs(r);
    for (let s = 0; s < 5; s++) {
      const lx = 1 + s;
      const h = y + 1 + s;
      for (let lz = 3; lz <= 5; lz++) {
        put(lx, lz, h, step);
        for (let f = y + 1; f < h; f++) put(lx, lz, f, WALL);
      }
      // The stringer that carries the flight, and a lamp at head height beside it.
      put(lx, 2, h - 1, s === 0 ? AIR : BAND);
      put(lx, 6, h - 1, s === 0 ? AIR : BAND);
    }
    put(3, 1, y + 4, LAMP);
    put(3, 6, y + 4, LAMP);
    // A column in the free corners of the hall, and a low wall to fight behind.
    for (const [lx, lz] of [
      [1, 1],
      [1, 6],
    ] as [number, number][]) {
      put(lx, lz, y + 1, COLUMN);
      put(lx, lz, y + 2, COLUMN);
      put(lx, lz, y + 3, COLUMN);
      put(lx, lz, y + 4, GOLD_SLAB);
    }
    put(6, 1, y + 1, deep(c.color));
    put(6, 2, y + 1, deep(c.color));
  }

  // ---- ramp -----------------------------------------------------------------

  /** A stair run carried on a vault, from this storey's floor to the next one's. */
  private ramp(e: Emit, c: SkyCell): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y;
    const r = c.dir;
    const put = (lx: number, lz: number, yy: number, v: number): void => {
      const [ax, az] = rotLocal(lx, lz, r);
      e.set(x0 + ax, yy, z0 + az, v);
    };
    // Floor of the cell, with the builder's rim where it shows.
    for (let lx = 0; lx < CELL; lx++) for (let lz = 0; lz < CELL; lz++) put(lx, lz, y, lz === 0 || lz === CELL - 1 ? BAND : FLOOR);
    // Six steps across the cell, six wide, and the vault that carries them.
    for (let s = 0; s < 6; s++) {
      const lx = 2 + s;
      const h = y + 1 + s;
      for (let lz = 1; lz <= 6; lz++) {
        put(lx, lz, h, stairs(r));
        // Masonry below the run, hollowed by a passage through the middle.
        for (let f = y + 1; f < h; f++) {
          const tunnel = lz >= 2 && lz <= 5 && f <= y + 3 && lx >= 4;
          put(lx, lz, f, tunnel ? AIR : WALL);
        }
      }
      // Rails either side: ashlar with a gold cap every third block.
      put(lx, 0, h, WALL);
      put(lx, CELL - 1, h, WALL);
      if (s % 3 === 1) {
        put(lx, 0, h + 1, GOLD_SLAB);
        put(lx, CELL - 1, h + 1, GOLD_SLAB);
      }
      for (let f = y + 1; f < h; f++) {
        put(lx, 0, f, WALL);
        put(lx, CELL - 1, f, WALL);
      }
    }
    // Rails along the flat approach too.
    for (let lx = 0; lx <= 1; lx++) {
      put(lx, 0, y + 1, WALL);
      put(lx, CELL - 1, y + 1, WALL);
    }
    put(0, 0, y + 2, GOLD_SLAB);
    put(0, CELL - 1, y + 2, GOLD_SLAB);
    this.underneath(e, c);
  }

  // ---- bridge ---------------------------------------------------------------

  /** A railed walkway on an arch, four wide down the middle of the cell. */
  private bridge(e: Emit, c: SkyCell): void {
    const x0 = cellX(c.i);
    const z0 = cellZ(c.j);
    const y = c.y;
    const r = c.dir;
    const put = (lx: number, lz: number, yy: number, v: number): void => {
      const [ax, az] = rotLocal(lx, lz, r);
      e.set(x0 + ax, yy, z0 + az, v);
    };
    for (let lx = 0; lx < CELL; lx++) {
      for (let lz = 2; lz <= 5; lz++) put(lx, lz, y, lz === 2 || lz === 5 ? BAND : FLOOR);
      if (lx % 3 === 1) put(lx, 3, y, glow(c.color));
      // Rails, with a lamp post at each end of the span.
      put(lx, 1, y + 1, GOLD_FENCE);
      put(lx, 6, y + 1, GOLD_FENCE);
      put(lx, 1, y, BAND);
      put(lx, 6, y, BAND);
      if (lx === 0 || lx === CELL - 1) {
        put(lx, 1, y + 2, LAMP);
        put(lx, 6, y + 2, LAMP);
      }
      // The arch under the span: deepest in the middle, tapering to the ends.
      const t = Math.abs(lx - 3.5) / 3.5;
      const depth = t < 0.35 ? 2 : t < 0.75 ? 1 : 0;
      for (let d = 1; d <= depth; d++) for (let lz = 3; lz <= 4; lz++) put(lx, lz, y - d, d === depth ? BAND : WALL);
    }
  }

  // ---- arena ----------------------------------------------------------------

  /** Three cells square: a round fighting floor with bastions, a colonnade and a raised dais. */
  private arena(e: Emit, c: SkyCell): void {
    const cx = cellX(c.i) + CELL / 2;
    const cz = cellZ(c.j) + CELL / 2;
    const y = c.y;
    const R = 11.5;
    const rim = BAND;
    const ground = this.terrain.heightAt(cx, cz);
    const floating = c.y - ground > STOREY;
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++)
      for (let z = Math.floor(cz - R); z <= Math.ceil(cz + R); z++) {
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
        if (d > R) continue;
        e.set(x, y, z, d > R - 2 ? rim : FLOOR);
        // A stepped keel under the whole disc, so it hangs like a lantern over the sea.
        if (!this.plan.below(c.i, c.j, c.y)) {
          if (floating) {
            if (d < R - 3) e.set(x, y - 1, z, BAND);
            if (d < R - 6) e.set(x, y - 2, z, WALL);
            if (d < 2.5) {
              e.set(x, y - 3, z, glow(c.color));
              e.set(x, y - 4, z, glow(c.color));
            }
          } else if (d < R - 4) {
            for (let yy = y - 1; yy > ground; yy--) e.set(x, yy, z, d > R - 7 ? WALL : yy > y - 3 ? WALL : AIR);
          }
        }
      }
    // The ring: parapet with merlons, four ways in on the axes, eight bastions between them.
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180;
      const x = Math.floor(cx + Math.cos(rad) * (R - 0.5));
      const z = Math.floor(cz + Math.sin(rad) * (R - 0.5));
      const onAxis = Math.abs(Math.cos(rad)) > 0.982 || Math.abs(Math.sin(rad)) > 0.982;
      if (onAxis) continue;
      e.set(x, y + 1, z, WALL);
      if ((x + z) % 3 === 0) e.set(x, y + 2, z, BAND_SLAB);
    }
    for (let b = 0; b < 8; b++) {
      const rad = ((b * 45 + 22.5) * Math.PI) / 180;
      const bx = Math.round(cx + Math.cos(rad) * (R - 1.5)) - 1;
      const bz = Math.round(cz + Math.sin(rad) * (R - 1.5)) - 1;
      e.box(bx, y + 1, bz, bx + 1, y + 2, bz + 1, WALL);
      e.set(bx, y + 3, bz, BAND_SLAB);
      e.set(bx + 1, y + 3, bz + 1, BAND_SLAB);
      e.set(bx + 1, y + 3, bz, LAMP);
    }
    // Colonnade: eight columns with gold capitals, standing clear of the fighting floor.
    for (let b = 0; b < 8; b++) {
      const rad = ((b * 45) * Math.PI) / 180;
      const px = Math.round(cx + Math.cos(rad) * 8) - 1;
      const pz = Math.round(cz + Math.sin(rad) * 8) - 1;
      for (let h = 1; h <= 5; h++) e.box(px, y + h, pz, px + 1, y + h, pz + 1, PILLAR);
      e.box(px, y + 6, pz, px + 1, y + 6, pz + 1, GOLD_SLAB);
    }
    // The dais in the middle, with steps on the four axes.
    for (let x = Math.floor(cx - 4); x <= Math.ceil(cx + 4); x++)
      for (let z = Math.floor(cz - 4); z <= Math.ceil(cz + 4); z++) {
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
        if (d <= 3.5) {
          e.set(x, y + 1, z, d > 2.6 ? BAND : WALL);
          e.set(x, y + 2, z, d < 1.2 ? GOLD : d > 3 ? BAND : FLOOR);
        }
      }
    for (let s = 0; s < 4; s++) {
      const [dx, dz] = DIRS[s];
      for (let w = -1; w <= 0; w++) {
        const ox = dz === 0 ? 0 : w;
        const oz = dx === 0 ? 0 : w;
        e.set(Math.floor(cx) + dx * 4 + ox, y + 1, Math.floor(cz) + dz * 4 + oz, stoneStairs((s + 2) % 4));
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
      // Into the hall, to the foot of the first flight, the landing, then up the second to the roof.
      // In at the door, straight up the flight, out onto the roof. A stair is climbed from its low
      // end, so the door and the first step are on the same line.
      out.push(at(0.5, 4, y + 1), at(3.5, 4, y + 4), at(6.5, 4, y + 7));
    } else if (c.kind === 'ramp') {
      out.push(at(0.5, 3.5, y + 1), at(4, 3.5, y + 4), at(7.5, 3.5, y + 7));
    } else {
      out.push(new THREE.Vector3(x0 + CELL / 2, y + 1, z0 + CELL / 2));
    }
    return out;
  }
}
