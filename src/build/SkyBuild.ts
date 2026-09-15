import * as THREE from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Terrain } from '../world/Terrain';
import type { Entity } from '../sim/Entities';
import { SKY_PALETTE, SKY_PLAYER_PALETTE } from '../world/Voxel';
import { PLAYABLE_RADIUS } from '../world/Layout';
import { Emitter } from '../core/Events';
import { CELL, DIRS, STOREY, SkyPlan, cellKey, cellOf, cellX, cellZ, type SkyCell, type SkyKind } from './SkyPlan';
import { SkyArchitect, posOf } from './SkyArchitect';

/**
 * Sky Flag building. One tap puts down a whole module — a deck, a stair tower, a ramp, a railed
 * bridge or a round arena — snapped to the island's eight-metre grid, and the architect dresses it
 * and everything it touches in finished masonry. Nothing has to be lined up by hand: you build at
 * the level you stand on, the module turns itself to fit, and the only thing that can stop you is
 * running out of bricks.
 */
export type PieceKind = 'tower' | 'deck' | 'ramp' | 'bridge' | 'arena';
export const PIECE_KINDS: PieceKind[] = ['tower', 'deck', 'ramp', 'bridge', 'arena'];
/** What a builder can have armed: the path (built ahead with one key) or one of the set pieces. */
export type ArmedKind = PieceKind | 'path';
/** The pieces offered on the bar, in order; the path is the default and what the bar returns to. */
export const ARMED_KINDS: ArmedKind[] = ['path', 'tower', 'bridge', 'arena'];

export interface PieceDef {
  kind: ArmedKind;
  cost: number;
  nameKey: string;
  descKey: string;
  icon: string;
}

const svg = (body: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const PIECES: Record<PieceKind, PieceDef> = {
  tower: { kind: 'tower', cost: 4, nameKey: 'pieceTower', descKey: 'pieceTowerDesc', icon: svg('<path d="M6 21V7l6-4 6 4v14"/><path d="M6 11h12M6 16h12"/><path d="M10 21v-4h4v4"/>') },
  deck: { kind: 'deck', cost: 2, nameKey: 'pieceDeck', descKey: 'pieceDeckDesc', icon: svg('<path d="M3 10l9-4 9 4-9 4z"/><path d="M5 11v4M19 11v4M12 14v6"/>') },
  ramp: { kind: 'ramp', cost: 3, nameKey: 'pieceRamp', descKey: 'pieceRampDesc', icon: svg('<path d="M3 19h18"/><path d="M3 19L19 6h2v13"/><path d="M8 19v-4M13 19v-8"/>') },
  bridge: { kind: 'bridge', cost: 2, nameKey: 'pieceBridge', descKey: 'pieceBridgeDesc', icon: svg('<path d="M2 14h20"/><path d="M2 14c4-6 16-6 20 0"/><path d="M6 14v4M12 14v4M18 14v4"/>') },
  arena: { kind: 'arena', cost: 10, nameKey: 'pieceArena', descKey: 'pieceArenaDesc', icon: svg('<ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="5" ry="2"/><path d="M4 12v5c0 2 4 3.5 8 3.5s8-1.5 8-3.5v-5"/>') },
};

/** The path piece: a stair when looking up, floor when looking ahead, always where your path ends. */
export const PATH_PIECE: PieceDef = { kind: 'path', cost: 0, nameKey: 'piecePath', descKey: 'piecePathDesc', icon: svg('<path d="M3 20h5v-4h5v-4h5V8h3"/><path d="M17 4l4 4-4 4"/>') };
export function pieceDef(kind: ArmedKind): PieceDef {
  return kind === 'path' ? PATH_PIECE : PIECES[kind];
}

/** Where a builder's path currently ends: the next piece continues from here. */
export interface PathHead {
  i: number;
  j: number;
  y: number;
  dir: number;
  at: number;
}

/** A neutral sky island in the plan, for bots and the HUD. */
export interface SkyIsland {
  pos: THREE.Vector3;
  y: number;
  nameKey: string;
}

export type PlaceReason = 'ok' | 'bricks' | 'occupied' | 'unsupported' | 'full' | 'bounds';

export interface PlacePlan {
  kind: PieceKind;
  /** The cells this tap adds (already addressed, not yet in the plan). */
  cells: SkyCell[];
  cost: number;
  dir: number;
  /** Middle of the module at floor level, for effects. */
  centre: THREE.Vector3;
  /** Where the module leaves you standing: the surface it hands you. */
  top: THREE.Vector3;
}

export interface AimResult {
  plan: PlacePlan | null;
  reason: PlaceReason;
  cost: number;
  /** Cell the module starts at, so callers can tell when the target moved. */
  target: number;
}

export interface SkyBuildEvents extends Record<string, unknown> {
  placed: { kind: PieceKind; cells: number; owner: Entity; centre: THREE.Vector3 };
}

/** Longest reach of the aiming ray. */
const REACH = 40;
/** Cells one island can hold before building stops. */
const CELL_CAP = 1200;
/** Looking up more than this (radians) makes the path climb; anything flatter extends the floor. */
const CLIMB_PITCH = 0.12;
/** A path restarts under the builder's feet once they are this far from its end. */
const PATH_REACH = 20;
/** The builder of the sky islands: nobody. */
const NEUTRAL = { id: -1, colorIndex: 0, isBot: false } as unknown as Entity;

/** Nearest of the four facings (0 +X, 1 +Z, 2 -X, 3 -Z) to a yaw. */
export function quantizeYaw(yaw: number): number {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? 0 : 2;
  return fz > 0 ? 1 : 3;
}

const tmpDir = new THREE.Vector3();
const tmpHit = new THREE.Vector3();

export class SkyBuilder {
  readonly events = new Emitter<SkyBuildEvents>();
  readonly plan = new SkyPlan();
  readonly arch: SkyArchitect;
  /** Every world position this match owns, so the island can be swept clean afterwards. */
  readonly placed = new Set<number>();
  /** Modules placed, per builder id. */
  readonly count = new Map<number, number>();

  /** Which finish a builder builds in: bots take turns through the three, the player picks. */
  skinFor: (e: Entity) => number = (e) => (e.isBot ? e.colorIndex % 3 : 0);
  /** The neutral sky islands placed at the start of the match. */
  readonly islands: SkyIsland[] = [];

  private owner = new Map<number, number>();
  /** Where each builder's path ends, by entity id. */
  private heads = new Map<number, PathHead>();
  /** Island blocks a module cut through, so the hillside can be put back afterwards. */
  private carved = new Map<number, number>();
  private cellBlocks = new Map<number, number[]>();

  constructor(
    private world: VoxelWorld,
    private terrain: Terrain,
    private entities: () => Entity[],
  ) {
    this.arch = new SkyArchitect(this.plan, terrain);
  }

  /** Palette index of an entity's glow colour (its slot among the twelve). */
  colorIndex(e: Entity): number {
    return SKY_PLAYER_PALETTE + (((e.colorIndex % 12) + 12) % 12);
  }

  // ---- aiming ---------------------------------------------------------------

  /** Where a module would go from an eye and a view direction, and whether it can go there. */
  aim(kind: PieceKind, eye: THREE.Vector3, view: THREE.Vector3, feet: THREE.Vector3, yaw: number, rot: number, self: Entity, bricks: number): AimResult {
    const dir = (quantizeYaw(yaw) + rot) & 3;
    const d = tmpDir.copy(view).normalize();
    // The point being aimed at: the first block the ray meets, or a spot a few cells ahead.
    const hit = this.world.raycast(eye.x, eye.y, eye.z, d.x, d.y, d.z, REACH);
    let px: number;
    let pz: number;
    if (hit) {
      // Step back along the ray so a wall hit targets the cell in front of it, not inside it.
      px = hit.px - d.x * 0.35;
      pz = hit.pz - d.z * 0.35;
    } else {
      tmpHit.copy(eye).addScaledVector(d, 18);
      px = tmpHit.x;
      pz = tmpHit.z;
    }
    const y = this.floorAt(feet, px, pz);
    let [i, j] = cellOf(px, pz);
    // A module always lands somewhere reachable: never more than three cells from the builder.
    const [pi, pj] = cellOf(feet.x, feet.z);
    i = Math.max(pi - 3, Math.min(pi + 3, i));
    j = Math.max(pj - 3, Math.min(pj + 3, j));
    // Aiming at your own floor (or at the parapet around it) means the cell in front, not the one
    // under your boots: only a tower may grow out of the deck you are standing on.
    const here = this.plan.get(i, j, y);
    const ownFloor = i === pi && j === pj && !!here;
    if (ownFloor && !(kind === 'tower' && here.kind === 'deck')) {
      i += DIRS[dir][0];
      j += DIRS[dir][1];
    }
    return this.planAt(kind, i, j, y, dir, self, bricks);
  }

  /**
   * One-key building. The piece that continues the builder's path in the direction they face — a
   * stair when they look up, floor when they look ahead — goes down where the path ends, so holding
   * the key while walking lays a road into the sky. Turning, or wandering off, restarts the path
   * under the builder's feet.
   */
  aimPath(self: Entity, feet: THREE.Vector3, yaw: number, pitch: number, now: number, bricks: number, rot = 0): AimResult {
    const dir = (quantizeYaw(yaw) + rot) & 3;
    return this.aimPathDir(self, feet, dir, pitch > CLIMB_PITCH, now, bricks);
  }

  /** The path piece for a facing and a choice of climbing or extending (bots choose both directly). */
  aimPathDir(self: Entity, feet: THREE.Vector3, dir: number, climb: boolean, now: number, bricks: number): AimResult {
    const [dx, dz] = DIRS[dir];
    let head = this.heads.get(self.id) ?? null;
    if (head) {
      const hx = cellX(head.i) + CELL / 2;
      const hz = cellZ(head.j) + CELL / 2;
      // The path runs ahead along a floor, never up a storey the builder has not climbed yet: a
      // stair placed from a landing you are still below is a stair you cannot see or reach.
      const above = head.y + 1 - feet.y;
      const far = Math.hypot(hx - feet.x, hz - feet.z) > PATH_REACH || above > 2.5 || above < -8;
      if (far || head.dir !== dir || now - head.at > 12) head = null;
    }
    if (!head) head = this.headUnder(feet, dir, now);
    // Flat floor that is already there is walked over, so the piece lands on the first empty cell
    // ahead; a stair or a hall in the way is where the path stops.
    let i = head.i;
    let j = head.j;
    const y = head.y;
    for (let n = 0; n < 3; n++) {
      const c = this.plan.get(i + dx, j + dz, y);
      if (!c || c.kind === 'ramp' || c.kind === 'tower') break;
      i += dx;
      j += dz;
    }
    const res = this.planAt(climb ? 'ramp' : 'deck', i + dx, j + dz, y, dir, self, bricks);
    // A stair that cannot go there (something over its landing) still gives a floor to stand on.
    if (climb && res.reason === 'occupied') {
      const flat = this.planAt('deck', i + dx, j + dz, y, dir, self, bricks);
      if (flat.reason === 'ok') return flat;
    }
    return res;
  }

  /**
   * Where a path starts: on a stair being climbed in its own direction, its landing; at the foot of
   * a stair, or on one while facing another way, the stair's own floor level; else the floor under
   * the feet.
   */
  private headUnder(feet: THREE.Vector3, dir: number, now: number): PathHead {
    const [i, j] = cellOf(feet.x, feet.z);
    const foot = Math.round(feet.y) - 1;
    const near = this.plan.nearestInColumn(i, j, foot, 7);
    const cell = near === null ? undefined : this.plan.get(i, j, near);
    if (cell && cell.kind === 'ramp') {
      if (dir === cell.dir && foot >= cell.y + 1) {
        const [rx, rz] = DIRS[cell.dir];
        return { i: cell.i + rx, j: cell.j + rz, y: cell.y + STOREY, dir, at: now };
      }
      return { i: cell.i, j: cell.j, y: cell.y, dir, at: now };
    }
    return { i, j, y: this.floorAt(feet, feet.x, feet.z), dir, at: now };
  }

  /** Remembers where a builder's path now ends: the surface the module hands them. */
  advanceHead(self: Entity, p: PlacePlan, now: number): void {
    const [i, j] = cellOf(p.top.x, p.top.z);
    this.heads.set(self.id, { i, j, y: Math.round(p.top.y) - 1, dir: p.dir, at: now });
  }

  /** Forgets a builder's path (they died, or the match ended). */
  forgetHead(id: number): void {
    this.heads.delete(id);
  }

  /** A sky island's module: nobody's, free, and allowed to hang in the air. */
  placeNeutral(kind: PieceKind, i: number, j: number, y: number, dir: number): PlacePlan | null {
    const res = this.planAt(kind, i, j, y, dir, NEUTRAL, 9999);
    if (!res.plan || (res.reason !== 'ok' && res.reason !== 'unsupported')) return null;
    this.place(res.plan, NEUTRAL, true);
    return res.plan;
  }

  /** The same from an entity's own eyes (bots). */
  aimFrom(kind: PieceKind, e: Entity, rot = 0): AimResult {
    return this.aim(kind, e.eyePos, e.forward(new THREE.Vector3()), e.pos, e.yaw, rot, e, e.bricks);
  }

  /** Aim straight at one cell (bots that already know where they want it). */
  aimCell(kind: PieceKind, i: number, j: number, y: number, dir: number, self: Entity, bricks: number): AimResult {
    return this.planAt(kind, i, j, y, dir, self, bricks);
  }

  /**
   * The floor a new module shares. You build on the level you stand on: if your feet are on a cell,
   * the module is coplanar with it; beside a structure it joins that structure; otherwise it sits
   * on the ground under the target.
   */
  floorAt(feet: THREE.Vector3, px: number, pz: number): number {
    const [pi, pj] = cellOf(feet.x, feet.z);
    const foot = Math.round(feet.y) - 1;
    const here = this.plan.nearestInColumn(pi, pj, foot, 3);
    if (here !== null) return here;
    const [i, j] = cellOf(px, pz);
    const there = this.plan.nearestInColumn(i, j, foot, 3);
    if (there !== null) return there;
    for (const [dx, dz] of DIRS) {
      const n = this.plan.nearestInColumn(i + dx, j + dz, foot, 3);
      if (n !== null) return n;
    }
    // Fresh ground: the floor slab sits in the hillside so the deck's surface is at boot height.
    const g = this.terrain.heightAt(cellX(i) + CELL / 2, cellZ(j) + CELL / 2);
    return Math.max(1, Math.round(Math.min(g, feet.y)) - 1);
  }

  /** Works out the cells of a module and everything that could stop it. */
  private planAt(kind: PieceKind, i: number, j: number, y: number, dir: number, self: Entity, bricks: number): AimResult {
    const target = cellKey(i, j, y);
    const neutral = self.id < 0;
    const color = neutral ? SKY_PALETTE.gold : this.colorIndex(self);
    const skin = neutral ? 0 : this.skinFor(self);
    const group = 0;
    const now = 0;
    const mk = (ci: number, cj: number, cy: number, k: SkyKind, cdir = dir, host?: number): SkyCell => ({
      i: ci,
      j: cj,
      y: cy,
      kind: k,
      owner: self.id,
      color,
      skin,
      dir: cdir,
      group,
      host,
      placedAt: now,
    });
    const [dx, dz] = DIRS[dir];
    const cells: SkyCell[] = [];
    let blocked = false;
    let cost = PIECES[kind].cost;
    let top = new THREE.Vector3(cellX(i) + CELL / 2, y + 1, cellZ(j) + CELL / 2);

    switch (kind) {
      case 'deck':
        cells.push(mk(i, j, y, 'deck'));
        break;
      case 'tower': {
        cells.push(mk(i, j, y, 'tower'));
        const up = this.plan.get(i, j, y + STOREY);
        if (!up) cells.push(mk(i, j, y + STOREY, 'deck'));
        else if (up.kind !== 'deck') blocked = true;
        top = new THREE.Vector3(cellX(i) + CELL / 2, y + STOREY + 1, cellZ(j) + CELL / 2);
        break;
      }
      case 'ramp': {
        cells.push(mk(i, j, y, 'ramp'));
        const li = i + dx;
        const lj = j + dz;
        const landing = this.plan.get(li, lj, y + STOREY);
        if (!landing) cells.push(mk(li, lj, y + STOREY, 'deck'));
        else if (landing.kind === 'tower' || landing.kind === 'ramp') blocked = true;
        top = new THREE.Vector3(cellX(li) + CELL / 2, y + STOREY + 1, cellZ(lj) + CELL / 2);
        break;
      }
      case 'bridge': {
        // Runs forward until it meets something to land on, three cells at most.
        let len = 3;
        for (let n = 0; n < 3; n++) {
          const c = this.plan.get(i + dx * n, j + dz * n, y);
          if (c) {
            len = n;
            break;
          }
        }
        if (len === 0) {
          blocked = true;
          len = 1;
        }
        for (let n = 0; n < len; n++) cells.push(mk(i + dx * n, j + dz * n, y, 'bridge'));
        cost = PIECES.bridge.cost * len;
        top = new THREE.Vector3(cellX(i + dx * (len - 1)) + CELL / 2, y + 1, cellZ(j + dz * (len - 1)) + CELL / 2);
        break;
      }
      case 'arena': {
        const host = cellKey(i, j, y);
        cells.push(mk(i, j, y, 'arena'));
        for (let di = -1; di <= 1; di++)
          for (let dj = -1; dj <= 1; dj++) {
            if (di === 0 && dj === 0) continue;
            cells.push(mk(i + di, j + dj, y, 'arenaPart', dir, host));
          }
        break;
      }
    }

    if (this.plan.size + cells.length > CELL_CAP) return { plan: null, reason: 'full', cost, target };
    for (const c of cells) {
      const cx = cellX(c.i) + CELL / 2;
      const cz = cellZ(c.j) + CELL / 2;
      if (cx * cx + cz * cz > (PLAYABLE_RADIUS - 6) * (PLAYABLE_RADIUS - 6)) return { plan: null, reason: 'bounds', cost, target };
      if (c.y < 1 || c.y > 236) return { plan: null, reason: 'bounds', cost, target };
      const there = this.plan.get(c.i, c.j, c.y);
      if (!there) continue;
      // A deck can grow into a tower or an arena floor; anything else is taken.
      if (!(there.kind === 'deck' && (c.kind === 'tower' || c.kind === 'arena' || c.kind === 'arenaPart'))) blocked = true;
    }
    // The ghost still shows where the module would land when something is in the way, so the answer
    // to "why not" is visible rather than written out.
    const centre = new THREE.Vector3(cellX(i) + CELL / 2, y + 1, cellZ(j) + CELL / 2);
    const made: PlacePlan = { kind, cells, cost, dir, centre, top };
    if (blocked) return { plan: made, reason: 'occupied', cost, target };
    if (!this.supported(cells[0])) return { plan: made, reason: 'unsupported', cost, target };
    if (bricks < cost) return { plan: made, reason: 'bricks', cost, target };
    return { plan: made, reason: 'ok', cost, target };
  }

  /** A module needs a neighbour on its own floor, something under it, or the ground within reach. */
  private supported(c: SkyCell): boolean {
    if (this.plan.sides(c.i, c.j, c.y).some((n) => !!n)) return true;
    if (this.plan.below(c.i, c.j, c.y)) return true;
    const g = this.terrain.heightAt(cellX(c.i) + CELL / 2, cellZ(c.j) + CELL / 2);
    return c.y - g <= STOREY + 1 && g > 0.6;
  }

  // ---- placing --------------------------------------------------------------

  /** Puts a planned module into the plan, regenerates every cell it changes, and returns its group. */
  place(p: PlacePlan, owner: Entity, silent = false): number {
    const group = this.plan.group();
    const lifted: Entity[] = [];
    for (const c of p.cells) {
      c.group = group;
      c.placedAt = performance.now() / 1000;
      const prev = this.plan.get(c.i, c.j, c.y);
      if (prev && prev.kind === 'deck' && c.kind !== 'deck') {
        // Growing a deck into a tower keeps whoever built the deck in the credits, and its finish.
        c.color = prev.color;
        c.owner = prev.owner;
        c.skin = prev.skin;
      }
      this.plan.set(c);
    }
    // Anyone standing where a floor just appeared is lifted onto it rather than trapped inside.
    for (const e of this.entities()) {
      if (!e.alive) continue;
      const [ei, ej] = cellOf(e.pos.x, e.pos.z);
      for (const c of p.cells) {
        if (c.i !== ei || c.j !== ej) continue;
        const surface = c.y + 1;
        if (e.pos.y > surface - 2.2 && e.pos.y <= surface) {
          e.pos.y = surface + 0.05;
          if (e.vel.y < 0) e.vel.y = 0;
          lifted.push(e);
        }
      }
    }
    const dirty = new Map<number, SkyCell>();
    for (const c of p.cells) for (const d of this.plan.dependents(c.i, c.j, c.y)) dirty.set(cellKey(d.i, d.j, d.y), d);
    // Lower cells first: a tower writes its stair before the deck above cuts its stairwell.
    const order = Array.from(dirty.values()).sort((a, b) => a.y - b.y);
    let n = 0;
    for (const c of order) n += this.regenerate(c);
    this.count.set(owner.id, (this.count.get(owner.id) ?? 0) + 1);
    if (!silent) this.events.emit('placed', { kind: p.kind, cells: n, owner, centre: p.centre.clone() });
    return group;
  }

  /** Removes a module (and its landing deck) again, refunding nothing by itself. */
  removeGroup(group: number): void {
    const cells = this.plan.groupCells(group);
    if (cells.length === 0) return;
    const neighbours = new Map<number, SkyCell>();
    for (const c of cells) {
      for (const d of this.plan.dependents(c.i, c.j, c.y)) neighbours.set(cellKey(d.i, d.j, d.y), d);
      this.plan.remove(c.i, c.j, c.y);
    }
    for (const c of cells) this.wipe(cellKey(c.i, c.j, c.y));
    for (const [key, c] of neighbours) {
      if (!this.plan.cells.has(key)) continue;
      this.regenerate(c);
    }
  }

  /** Rebuilds one cell's masonry and writes only what actually changed. */
  private regenerate(c: SkyCell): number {
    const key = cellKey(c.i, c.j, c.y);
    const next = this.arch.generate(c);
    const prev = this.cellBlocks.get(key);
    let n = 0;
    if (prev) {
      for (const pos of prev) {
        if (next.has(pos)) continue;
        if (this.owner.get(pos) !== key) continue;
        this.setPos(pos, 0);
        this.owner.delete(pos);
        this.placed.delete(pos);
      }
    }
    const keys: number[] = [];
    for (const [pos, v] of next) {
      keys.push(pos);
      if (v === 0) {
        // A room carved out of whatever was there: the island's own blocks are remembered so the
        // hillside comes back when the match ends.
        const [cx, cy, cz] = posOf(pos);
        const cur = this.world.get(cx, cy, cz);
        if (cur !== 0) {
          if (!this.owner.has(pos) && !this.carved.has(pos)) this.carved.set(pos, cur);
          this.world.set(cx, cy, cz, 0);
        }
        this.owner.set(pos, key);
        this.placed.delete(pos);
        continue;
      }
      const [x, y, z] = posOf(pos);
      if (this.world.get(x, y, z) !== v) {
        this.world.set(x, y, z, v);
        n++;
      }
      this.owner.set(pos, key);
      this.placed.add(pos);
    }
    this.cellBlocks.set(key, keys);
    return n;
  }

  /** Clears every block one cell owns. */
  private wipe(key: number): void {
    const prev = this.cellBlocks.get(key);
    if (!prev) return;
    for (const pos of prev) {
      if (this.owner.get(pos) !== key) continue;
      this.setPos(pos, 0);
      this.owner.delete(pos);
      this.placed.delete(pos);
    }
    this.cellBlocks.delete(key);
  }

  private setPos(pos: number, v: number): void {
    const [x, y, z] = posOf(pos);
    this.world.set(x, y, z, v);
  }

  /** The block positions a module would fill, for the ghost. */
  previewCells(p: PlacePlan): { x: number; y: number; z: number }[] {
    const out: { x: number; y: number; z: number }[] = [];
    for (const pos of this.preview(p).keys()) {
      const [x, y, z] = posOf(pos);
      out.push({ x, y, z });
    }
    return out;
  }

  /** The blocks a module would put down, for the ghost. */
  preview(p: PlacePlan): Map<number, number> {
    const out = new Map<number, number>();
    const added: SkyCell[] = [];
    for (const c of p.cells) {
      if (this.plan.get(c.i, c.j, c.y)) continue;
      this.plan.set(c);
      added.push(c);
    }
    for (const c of p.cells) for (const [pos, v] of this.arch.generate(c)) if (v !== 0) out.set(pos, v);
    for (const c of added) this.plan.remove(c.i, c.j, c.y);
    return out;
  }

  // ---- queries --------------------------------------------------------------

  /** Middles of standable cell tops above the water, highest first. */
  standableSpots(seaLevel: number, near?: THREE.Vector3): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    for (const s of this.plan.standing()) {
      if (s.y < seaLevel + 1) continue;
      if (near && (s.x - near.x) ** 2 + (s.z - near.z) ** 2 > 70 * 70) continue;
      out.push(new THREE.Vector3(s.x, s.y + 0.05, s.z));
    }
    return out;
  }

  /** The cell a point stands on, if any. */
  cellUnder(pos: THREE.Vector3): SkyCell | null {
    const [i, j] = cellOf(pos.x, pos.z);
    const y = this.plan.nearestInColumn(i, j, Math.round(pos.y) - 1, 2);
    return y === null ? null : (this.plan.get(i, j, y) ?? null);
  }

  /** Total modules on the island. */
  get moduleCount(): number {
    return this.plan.size;
  }

  clear(): void {
    for (const pos of this.placed) this.setPos(pos, 0);
    for (const [pos, v] of this.carved) this.setPos(pos, v);
    this.carved.clear();
    this.placed.clear();
    this.owner.clear();
    this.cellBlocks.clear();
    this.plan.clear();
    this.count.clear();
    this.heads.clear();
    this.islands.length = 0;
  }
}
