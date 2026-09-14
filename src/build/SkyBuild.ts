import * as THREE from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Terrain } from '../world/Terrain';
import type { Entity } from '../sim/Entities';
import { Mat, encodeBlock, makeShape, SHAPE_DIRS, SKY_PALETTE, SKY_PLAYER_PALETTE, SKY_DEEP_PALETTE } from '../world/Voxel';
import { PLAYABLE_RADIUS } from '../world/Layout';
import { Emitter } from '../core/Events';

/**
 * Sky Flag building: five arena pieces stamped straight into the voxel world in the middle of the
 * fight. Pale marble decks with a glowing rim in the builder's colour, gold rails and merlons, and
 * support columns that drop by themselves to whatever stands below, so every tower reads as built
 * even when it was thrown up in a hurry. Bricks are the only cost.
 */
export type PieceKind = 'ramp' | 'platform' | 'bridge' | 'parapet' | 'arena';
export const PIECE_KINDS: PieceKind[] = ['ramp', 'platform', 'bridge', 'parapet', 'arena'];

export interface PieceDef {
  kind: PieceKind;
  cost: number;
  nameKey: string;
  descKey: string;
  /** Inline SVG glyph for the piece bar. */
  icon: string;
}

const svg = (body: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const PIECES: Record<PieceKind, PieceDef> = {
  ramp: { kind: 'ramp', cost: 3, nameKey: 'pieceRamp', descKey: 'pieceRampDesc', icon: svg('<path d="M3 19h18"/><path d="M3 19L19 6h2v13"/><path d="M8 19v-4M13 19v-8"/>') },
  platform: { kind: 'platform', cost: 4, nameKey: 'piecePlatform', descKey: 'piecePlatformDesc', icon: svg('<path d="M3 10l9-4 9 4-9 4z"/><path d="M5 11v4M19 11v4M12 14v6"/>') },
  bridge: { kind: 'bridge', cost: 3, nameKey: 'pieceBridge', descKey: 'pieceBridgeDesc', icon: svg('<path d="M2 14h20"/><path d="M2 14c4-6 16-6 20 0"/><path d="M6 14v4M12 14v4M18 14v4"/>') },
  parapet: { kind: 'parapet', cost: 1, nameKey: 'pieceParapet', descKey: 'pieceParapetDesc', icon: svg('<path d="M3 20h18"/><path d="M4 20V11h3v-3h3v3h4v-3h3v3h3v9"/>') },
  arena: { kind: 'arena', cost: 8, nameKey: 'pieceArena', descKey: 'pieceArenaDesc', icon: svg('<ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="5" ry="2"/><path d="M4 12v5c0 2 4 3.5 8 3.5s8-1.5 8-3.5v-5"/>') },
};

export interface StampCell {
  x: number;
  y: number;
  z: number;
  v: number;
}

export interface Stamp {
  kind: PieceKind;
  cells: StampCell[];
  /** Deck blocks whose top is meant to be walked on (spawns, bots). */
  floors: StampCell[];
  /** Columns dropped from these cells when the piece is placed. */
  supports: { x: number; z: number; y: number }[];
  /** Centre of the piece at deck level, for effects. */
  centre: THREE.Vector3;
  /** Facing (0..3) for ramps and bridges. */
  dir: number;
}

export type PlaceReason = 'ok' | 'blocked' | 'body' | 'unanchored' | 'bricks' | 'bounds' | 'range';

export interface AimResult {
  stamp: Stamp | null;
  reason: PlaceReason;
  cost: number;
}

export interface SkyBuildEvents extends Record<string, unknown> {
  placed: { kind: PieceKind; cells: number; owner: Entity; centre: THREE.Vector3 };
}

const REACH = 16;
/** Longest support column dropped under a deck. */
const SUPPORT_DEPTH = 22;
/** A piece may run into existing blocks this much and still go down (the overlap is skipped). */
const OVERLAP_MAX = 0.34;

function key(x: number, y: number, z: number): number {
  return ((x + 1024) * 512 + y) * 2048 + (z + 1024);
}

/** Nearest of the four facings (0 +X, 1 +Z, 2 -X, 3 -Z) to a yaw. */
export function quantizeYaw(yaw: number): number {
  // Entity forward is (-sin yaw, 0, -cos yaw); SHAPE_DIRS are +X, +Z, -X, -Z.
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? 0 : 2;
  return fz > 0 ? 1 : 3;
}

const tmpDir = new THREE.Vector3();

export class SkyBuilder {
  readonly events = new Emitter<SkyBuildEvents>();
  /** Every block this match put into the world (removed again at the end). */
  readonly placed = new Set<number>();
  /** Deck blocks by cell key (their tops are where people stand). */
  readonly floors = new Map<number, { x: number; y: number; z: number }>();
  /** Total pieces placed, per builder id. */
  readonly count = new Map<number, number>();

  private readonly FLOOR = encodeBlock(Mat.MARBLE, SKY_PALETTE.floor);
  private readonly PILLAR = encodeBlock(Mat.MARBLE, SKY_PALETTE.pillar, makeShape('pillar'));
  private readonly GOLD = encodeBlock(Mat.GOLD, SKY_PALETTE.gold);
  private readonly RAIL = encodeBlock(Mat.GOLD, SKY_PALETTE.gold, makeShape('fence'));
  private readonly MERLON = encodeBlock(Mat.GOLD, SKY_PALETTE.gold, makeShape('slab'));

  constructor(
    private world: VoxelWorld,
    private terrain: Terrain,
    private entities: () => Entity[],
  ) {}

  /** Palette index of an entity's glow colour (its slot among the twelve). */
  colorIndex(e: Entity): number {
    return SKY_PLAYER_PALETTE + (((e.colorIndex % 12) + 12) % 12);
  }

  /** A glowing strip in the builder's colour (used one row at a time). */
  private trim(color: number): number {
    return encodeBlock(Mat.CRYSTAL, color);
  }
  /** Matte coloured stone for deck borders (the deep shade of the builder's colour). */
  private border(color: number): number {
    return encodeBlock(Mat.SMOOTH_STONE, SKY_DEEP_PALETTE + (color - SKY_PLAYER_PALETTE));
  }
  private post(color: number): number {
    return encodeBlock(Mat.LAMP, color, makeShape('fence'));
  }
  private slope(rot: number): number {
    return encodeBlock(Mat.MARBLE, SKY_PALETTE.floor, makeShape('slope', rot));
  }

  /** Pure geometry of a piece at an anchor: no world checks. */
  stamp(kind: PieceKind, ax: number, ay: number, az: number, dir: number, color: number): Stamp {
    const cells: StampCell[] = [];
    const floors: StampCell[] = [];
    const supports: { x: number; z: number; y: number }[] = [];
    const [dx, dz] = SHAPE_DIRS[((dir % 4) + 4) % 4];
    const px = -dz;
    const pz = dx;
    const add = (x: number, y: number, z: number, v: number, floor = false): void => {
      const c = { x, y, z, v };
      cells.push(c);
      if (floor) floors.push(c);
    };
    const centre = new THREE.Vector3(ax + 0.5, ay + 1, az + 0.5);
    switch (kind) {
      case 'platform': {
        for (let i = -2; i <= 2; i++)
          for (let j = -2; j <= 2; j++) {
            const rim = Math.abs(i) === 2 || Math.abs(j) === 2;
            add(ax + i, ay, az + j, rim ? this.border(color) : this.FLOOR, true);
          }
        for (const [i, j] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
          add(ax + i, ay + 1, az + j, this.post(color));
          supports.push({ x: ax + i, z: az + j, y: ay - 1 });
        }
        break;
      }
      case 'arena': {
        const R = 5.5;
        for (let i = -6; i <= 6; i++)
          for (let j = -6; j <= 6; j++) {
            const r2 = i * i + j * j;
            if (r2 > R * R) continue;
            add(ax + i, ay, az + j, r2 > 4.6 * 4.6 ? this.border(color) : r2 > 1.5 * 1.5 && r2 <= 2.5 * 2.5 ? this.trim(color) : this.FLOOR, true);
          }
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          const i = Math.round(Math.cos(a) * 5);
          const j = Math.round(Math.sin(a) * 5);
          add(ax + i, ay + 1, az + j, this.post(color));
        }
        for (const [i, j] of [[-3, -3], [3, -3], [-3, 3], [3, 3], [0, -4], [0, 4], [-4, 0], [4, 0]]) supports.push({ x: ax + i, z: az + j, y: ay - 1 });
        break;
      }
      case 'ramp': {
        // Three wide, four long, a metre up per metre forward, then a two-deep landing.
        for (let i = 0; i < 4; i++)
          for (let w = -1; w <= 1; w++) {
            const x = ax + dx * i + px * w;
            const z = az + dz * i + pz * w;
            add(x, ay + i, z, this.slope(dir));
            for (let f = 0; f < i; f++) add(x, ay + f, z, this.FLOOR);
          }
        for (let i = 4; i < 6; i++)
          for (let w = -1; w <= 1; w++) {
            const x = ax + dx * i + px * w;
            const z = az + dz * i + pz * w;
            add(x, ay + 3, z, i === 5 ? this.trim(color) : this.FLOOR, true);
            if (i === 4 && Math.abs(w) === 1) add(x, ay + 2, z, this.FLOOR);
          }
        supports.push({ x: ax + dx * 5 + px, z: az + dz * 5 + pz, y: ay + 2 }, { x: ax + dx * 5 - px, z: az + dz * 5 - pz, y: ay + 2 });
        centre.set(ax + dx * 2.5 + 0.5, ay + 2, az + dz * 2.5 + 0.5);
        break;
      }
      case 'bridge': {
        // Eight long: a three-wide deck at the feet with gold rails either side.
        for (let i = 0; i < 8; i++)
          for (let w = -2; w <= 2; w++) {
            const x = ax + dx * i + px * w;
            const z = az + dz * i + pz * w;
            const rail = Math.abs(w) === 2;
            add(x, ay - 1, z, i === 7 ? this.trim(color) : rail ? this.border(color) : this.FLOOR, !rail);
            if (rail) add(x, ay, z, this.RAIL);
          }
        supports.push({ x: ax + dx * 7 + px * 2, z: az + dz * 7 + pz * 2, y: ay - 2 }, { x: ax + dx * 7 - px * 2, z: az + dz * 7 - pz * 2, y: ay - 2 });
        centre.set(ax + dx * 3.5 + 0.5, ay, az + dz * 3.5 + 0.5);
        break;
      }
      case 'parapet': {
        // Five long, chest high, gold merlons every other block.
        for (let w = -2; w <= 2; w++) {
          const x = ax + px * w;
          const z = az + pz * w;
          add(x, ay, z, w === 0 ? this.trim(color) : this.FLOOR);
          if ((w & 1) === 0) add(x, ay + 1, z, this.MERLON);
        }
        centre.set(ax + 0.5, ay + 0.5, az + 0.5);
        break;
      }
    }
    return { kind, cells, floors, supports, centre, dir: ((dir % 4) + 4) % 4 };
  }

  /** Why a stamp cannot go down (or 'ok'). */
  check(stamp: Stamp, owner: Entity | null, bricks: number): PlaceReason {
    const def = PIECES[stamp.kind];
    if (owner && bricks < def.cost) return 'bricks';
    const world = this.world;
    const inStamp = new Set<number>();
    for (const c of stamp.cells) inStamp.add(key(c.x, c.y, c.z));
    let overlap = 0;
    let anchored = false;
    const limit2 = (PLAYABLE_RADIUS - 3) * (PLAYABLE_RADIUS - 3);
    for (const c of stamp.cells) {
      if (c.y < 1 || c.y > world.maxY - 4 || c.x * c.x + c.z * c.z > limit2) return 'bounds';
      if (world.get(c.x, c.y, c.z) !== 0) {
        overlap++;
        anchored = true;
        continue;
      }
      if (!anchored) {
        if (this.terrain.heightAt(c.x + 0.5, c.z + 0.5) >= c.y - 0.05) anchored = true;
        else
          // Six neighbours, plus the four diagonally below: a ramp or bridge leaving the edge of a
          // deck hangs from the deck block behind and under its first row.
          for (const [nx, ny, nz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, -1, 0], [-1, -1, 0], [0, -1, 1], [0, -1, -1]]) {
            const k = key(c.x + nx, c.y + ny, c.z + nz);
            if (!inStamp.has(k) && world.get(c.x + nx, c.y + ny, c.z + nz) !== 0) {
              anchored = true;
              break;
            }
          }
      }
    }
    if (overlap > stamp.cells.length * OVERLAP_MAX) return 'blocked';
    if (!anchored) return 'unanchored';
    // Nobody may be walled in (the builder included).
    for (const e of this.entities()) {
      if (!e.alive) continue;
      const r = e.radius + 0.02;
      const x0 = e.pos.x - r;
      const x1 = e.pos.x + r;
      const y0 = e.pos.y + 0.05;
      const y1 = e.pos.y + e.height;
      const z0 = e.pos.z - r;
      const z1 = e.pos.z + r;
      for (const c of stamp.cells) {
        if (world.get(c.x, c.y, c.z) !== 0) continue;
        if (c.x < x1 && c.x + 1 > x0 && c.y < y1 && c.y + 1 > y0 && c.z < z1 && c.z + 1 > z0) return 'body';
      }
    }
    return 'ok';
  }

  /**
   * Resolves where a piece goes from a viewer's eye ray and feet: ramps and bridges start a step
   * ahead of the feet in the facing direction; decks, arenas and parapets go where the ray lands.
   */
  aim(kind: PieceKind, eye: THREE.Vector3, dir: THREE.Vector3, feet: THREE.Vector3, yaw: number, rot: number, owner: Entity | null, bricks: number): AimResult {
    const cost = PIECES[kind].cost;
    const color = owner ? this.colorIndex(owner) : SKY_PALETTE.gold;
    const facing = (quantizeYaw(yaw) + rot + 4) % 4;
    if (kind === 'ramp' || kind === 'bridge') {
      const [dx, dz] = SHAPE_DIRS[facing];
      const ay = Math.floor(feet.y + 0.02);
      const ax = Math.floor(feet.x + dx * 1.1);
      const az = Math.floor(feet.z + dz * 1.1);
      const stamp = this.stamp(kind, ax, ay, az, facing, color);
      return { stamp, reason: this.check(stamp, owner, bricks), cost };
    }
    const hit = this.world.raycast(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, REACH);
    // Terrain along the same ray.
    let tPoint: THREE.Vector3 | null = null;
    let tDist = Infinity;
    tmpDir.copy(dir).normalize();
    for (let s = 0.5; s <= REACH; s += 0.5) {
      const x = eye.x + tmpDir.x * s;
      const y = eye.y + tmpDir.y * s;
      const z = eye.z + tmpDir.z * s;
      if (y <= this.terrain.heightAt(x, z)) {
        tPoint = new THREE.Vector3(x, this.terrain.heightAt(x, z), z);
        tDist = s;
        break;
      }
    }
    if (!hit && !tPoint) return { stamp: null, reason: 'range', cost };
    const flat = new THREE.Vector3(dir.x, 0, dir.z);
    if (flat.lengthSq() < 1e-4) flat.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    flat.normalize();
    let ax: number;
    let ay: number;
    let az: number;
    if (hit && hit.dist <= tDist) {
      if (kind === 'parapet') {
        if (hit.ny <= 0) return { stamp: null, reason: 'range', cost };
        ax = hit.x;
        ay = hit.y + 1;
        az = hit.z;
      } else if (hit.ny > 0) {
        // On a deck: extend it, the new piece starting at the cell aimed at.
        const push = kind === 'arena' ? 5 : 2;
        ax = hit.x + Math.round(flat.x * push);
        ay = hit.y;
        az = hit.z + Math.round(flat.z * push);
      } else if (hit.ny === 0) {
        // Against a wall: hang the deck off it at the same level.
        const push = kind === 'arena' ? 6 : 3;
        ax = hit.x + hit.nx * push;
        ay = hit.y;
        az = hit.z + hit.nz * push;
      } else {
        ax = hit.x + Math.round(flat.x * 3);
        ay = hit.y - 1;
        az = hit.z + Math.round(flat.z * 3);
      }
    } else {
      const p = tPoint!;
      ax = Math.floor(p.x);
      az = Math.floor(p.z);
      // Resting on the ground: the deck's top ends up within a metre above the surface (a step, never a pit).
      ay = kind === 'parapet' ? Math.floor(p.y) + 1 : Math.floor(p.y);
    }
    let stamp = this.stamp(kind, ax, ay, az, facing, color);
    let reason = this.check(stamp, owner, bricks);
    // A deck aimed at one's own feet: slide it away along the view until nobody is inside it.
    for (let push = 1; push <= 3 && reason === 'body'; push++) {
      const s2 = this.stamp(kind, ax + Math.round(flat.x * push), ay, az + Math.round(flat.z * push), facing, color);
      const r2 = this.check(s2, owner, bricks);
      if (r2 !== 'body' || push === 3) {
        stamp = s2;
        reason = r2;
      }
    }
    return { stamp, reason, cost };
  }

  /** Same resolution from an entity's own eye and facing (bots). */
  aimFrom(kind: PieceKind, e: Entity, rot = 0): AimResult {
    return this.aim(kind, e.eyePos, e.forward(new THREE.Vector3()), e.pos, e.yaw, rot, e, e.bricks);
  }

  /** Puts a checked stamp into the world and drops its support columns. Returns the blocks added. */
  place(stamp: Stamp, owner: Entity): number {
    const world = this.world;
    let n = 0;
    for (const c of stamp.cells) {
      if (world.get(c.x, c.y, c.z) !== 0) continue;
      if (world.set(c.x, c.y, c.z, c.v)) {
        this.placed.add(key(c.x, c.y, c.z));
        n++;
      }
    }
    for (const f of stamp.floors) this.floors.set(key(f.x, f.y, f.z), { x: f.x, y: f.y, z: f.z });
    for (const s of stamp.supports) n += this.dropSupport(s.x, s.y, s.z);
    this.count.set(owner.id, (this.count.get(owner.id) ?? 0) + 1);
    this.events.emit('placed', { kind: stamp.kind, cells: n, owner, centre: stamp.centre.clone() });
    return n;
  }

  /** A marble column from a deck corner down to the first block or the ground, if either is near enough. */
  private dropSupport(x: number, y: number, z: number): number {
    const ground = this.terrain.heightAt(x + 0.5, z + 0.5);
    let depth = 0;
    let yy = y;
    while (depth < SUPPORT_DEPTH && yy >= 1 && yy + 1 > ground && this.world.get(x, yy, z) === 0) {
      yy--;
      depth++;
    }
    // Found something to stand on (a block, or the ground within reach)?
    const onGround = yy + 1 <= ground || yy < 1;
    if (!onGround && this.world.get(x, yy, z) === 0) return 0;
    let n = 0;
    for (let k = y; k > yy; k--) {
      if (this.world.get(x, k, z) !== 0) continue;
      if (this.world.set(x, k, z, this.PILLAR)) {
        this.placed.add(key(x, k, z));
        n++;
      }
    }
    return n;
  }

  /** Deck tops with headroom above the water, for respawns; nearest-first to `near` when given. */
  standableSpots(seaLevel: number, near?: THREE.Vector3): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    for (const f of this.floors.values()) {
      if (f.y + 1 < seaLevel + 1.5) continue;
      if (this.world.get(f.x, f.y, f.z) === 0) continue;
      if (this.world.get(f.x, f.y + 1, f.z) !== 0 || this.world.get(f.x, f.y + 2, f.z) !== 0) continue;
      out.push(new THREE.Vector3(f.x + 0.5, f.y + 1.02, f.z + 0.5));
    }
    if (near) out.sort((a, b) => a.distanceToSquared(near) - b.distanceToSquared(near));
    return out;
  }

  /** Removes everything this match built. */
  clear(): void {
    for (const k of this.placed) {
      const z = (k % 2048) - 1024;
      const rest = Math.floor(k / 2048);
      const y = rest % 512;
      const x = Math.floor(rest / 512) - 1024;
      this.world.set(x, y, z, 0);
    }
    this.placed.clear();
    this.floors.clear();
    this.count.clear();
  }
}
