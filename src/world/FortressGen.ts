import type { VoxelWorld } from './VoxelWorld';
import { PLOT_Y, PLOT_MAX_HEIGHT, type Plot } from './Layout';
import { STYLES, type StyleId, type BlockRole } from './Styles';
import { Shape, makeShape, withShape } from './Voxel';
import { PREFABS, rotateBlocks } from './Prefabs';
import { Random } from '../core/Random';
import { bestHidingCells, checkReachability, type Cell, reachableFromOutside } from './Reachability';

export type Archetype = 'castle' | 'palace' | 'villa' | 'bunker' | 'tower' | 'temple';
export const ARCHETYPES: Archetype[] = ['castle', 'palace', 'villa', 'bunker', 'tower', 'temple'];

export interface FortressResult {
  flag: Cell;
  spawn: Cell;
  blocks: number;
  archetype: Archetype;
}

class Painter {
  count = 0;
  constructor(private world: VoxelWorld, private plot: Plot, private style: StyleId) {}
  v(role: BlockRole): number {
    return STYLES[this.style].roles[role];
  }
  inPlot(x: number, y: number, z: number): boolean {
    return x >= this.plot.minX && x <= this.plot.maxX && z >= this.plot.minZ && z <= this.plot.maxZ && y >= PLOT_Y && y < PLOT_Y + PLOT_MAX_HEIGHT;
  }
  set(x: number, y: number, z: number, role: BlockRole | 'air', shape?: number): void {
    if (!this.inPlot(x, y, z)) return;
    const sh = shape ?? (role === 'pillar' ? Shape.PILLAR : 0);
    this.world.set(x, y, z, role === 'air' ? 0 : withShape(this.v(role), sh));
  }
  /** One pyramid-roof layer: sloped edge tiles facing inward, cube corners and a solid core. */
  roofLayer(x0: number, y: number, z0: number, x1: number, z1: number, role: BlockRole = 'roof'): void {
    const lx = Math.min(x0, x1);
    const hx = Math.max(x0, x1);
    const lz = Math.min(z0, z1);
    const hz = Math.max(z0, z1);
    for (let x = lx; x <= hx; x++)
      for (let z = lz; z <= hz; z++) {
        const ex = x === lx || x === hx;
        const ez = z === lz || z === hz;
        let shape = 0;
        if (hx - lx >= 2 && hz - lz >= 2 && (ex !== ez)) {
          if (x === hx) shape = makeShape('slope', 2);
          else if (x === lx) shape = makeShape('slope', 0);
          else if (z === hz) shape = makeShape('slope', 3);
          else shape = makeShape('slope', 1);
        }
        this.set(x, y, z, role, shape);
      }
  }
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, role: BlockRole | 'air'): void {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, role);
  }
  /** Hollow box: walls only (no floor/ceiling unless flagged). */
  shell(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, role: BlockRole, floor: BlockRole | null, ceiling: BlockRole | null): void {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const edge = x === x0 || x === x1 || z === z0 || z === z1;
          if (edge) this.set(x, y, z, role, 0);
          else if (y === y0 && floor) this.set(x, y, z, floor);
          else if (y === y1 && ceiling) this.set(x, y, z, ceiling);
        }
  }
  prefab(id: keyof typeof PREFABS, size: number, rot: number, x: number, y: number, z: number): void {
    const blocks = rotateBlocks(PREFABS[id].build(size), rot);
    for (const b of blocks) this.set(x + b.x, y + b.y, z + b.z, b.role, b.shape);
  }
  door(x: number, y: number, z: number, axis: 'x' | 'z', width = 1, height = 3): void {
    for (let h = 0; h < height; h++) {
      for (let w = -width; w <= width; w++) {
        if (axis === 'x') this.set(x + w, y + h, z, 'air');
        else this.set(x, y + h, z + w, 'air');
      }
    }
    if (axis === 'x') for (let w = -width - 1; w <= width + 1; w++) this.set(x + w, y + height, z, 'trim');
    else for (let w = -width - 1; w <= width + 1; w++) this.set(x, y + height, z + w, 'trim');
  }
  /** Straight staircase climbing along +dir from (x,z) at base y, n steps, with landing. */
  stairs(x: number, y: number, z: number, dx: number, dz: number, n: number, width = 1): void {
    for (let i = 0; i < n; i++) {
      for (let w = -Math.floor(width / 2); w <= Math.floor(width / 2); w++) {
        const sx = x + dx * i + (dz !== 0 ? w : 0);
        const sz = z + dz * i + (dx !== 0 ? w : 0);
        const rot = dx > 0 ? 0 : dx < 0 ? 2 : dz > 0 ? 1 : 3;
        for (let yy = y; yy <= y + i; yy++) this.set(sx, yy, sz, yy === y + i ? 'stairs' : 'wallAlt', yy === y + i ? makeShape('stairs', rot) : 0);
        // Head room above the step.
        this.set(sx, y + i + 1, sz, 'air');
        this.set(sx, y + i + 2, sz, 'air');
      }
    }
  }
  windows(x0: number, z0: number, x1: number, z1: number, y: number, every = 3): void {
    for (let x = x0 + 1; x < x1; x += every) {
      this.set(x, y, z0, 'glass');
      this.set(x, y, z1, 'glass');
    }
    for (let z = z0 + 1; z < z1; z += every) {
      this.set(x0, y, z, 'glass');
      this.set(x1, y, z, 'glass');
    }
  }
  crenellate(x0: number, z0: number, x1: number, z1: number, y: number): void {
    for (let x = x0; x <= x1; x++) {
      if ((x - x0) % 2 === 0) {
        this.set(x, y, z0, 'trim');
        this.set(x, y, z1, 'trim');
      }
    }
    for (let z = z0; z <= z1; z++) {
      if ((z - z0) % 2 === 0) {
        this.set(x0, y, z, 'trim');
        this.set(x1, y, z, 'trim');
      }
    }
  }
}

function castle(p: Painter, plot: Plot, rng: Random): void {
  const y0 = PLOT_Y;
  const x0 = plot.minX + 3;
  const z0 = plot.minZ + 3;
  const x1 = plot.maxX - 3;
  const z1 = plot.maxZ - 3;
  const wallH = rng.int(6, 8);
  p.shell(x0, y0, z0, x1, y0 + wallH - 1, z1, 'wall', null, null);
  // Walkway ledge inside the wall top.
  for (let x = x0 + 1; x <= x1 - 1; x++) {
    p.set(x, y0 + wallH - 2, z0 + 1, 'floor');
    p.set(x, y0 + wallH - 2, z1 - 1, 'floor');
  }
  for (let z = z0 + 1; z <= z1 - 1; z++) {
    p.set(x0 + 1, y0 + wallH - 2, z, 'floor');
    p.set(x1 - 1, y0 + wallH - 2, z, 'floor');
  }
  p.crenellate(x0, z0, x1, z1, y0 + wallH);
  // Corner towers
  const tH = wallH + rng.int(4, 7);
  for (const [tx, tz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    p.shell(tx - 2, y0, tz - 2, tx + 2, y0 + tH - 1, tz + 2, 'wallAlt', null, 'floor');
    p.crenellate(tx - 2, tz - 2, tx + 2, tz + 2, y0 + tH);
    p.set(tx, y0 + tH + 1, tz, 'light');
    // Interior spiral stairs in towers
    let ang = 0;
    for (let y = y0; y < y0 + tH - 1; y++) {
      const sx = tx + Math.round(Math.cos(ang) * 1.2);
      const sz = tz + Math.round(Math.sin(ang) * 1.2);
      p.set(sx, y, sz, 'stairs');
      ang += 0.9;
    }
    // Hole in tower floor above the last stair
    const sx = tx + Math.round(Math.cos(ang) * 1.2);
    const sz = tz + Math.round(Math.sin(ang) * 1.2);
    p.set(sx, y0 + tH - 1, sz, 'air');
  }
  // Gate on the side facing the island centre (-z side towards centre depends on plot angle; use the closest side to origin)
  const gateAxis: 'x' | 'z' = Math.abs(plot.cx) > Math.abs(plot.cz) ? 'z' : 'x';
  const gx = Math.floor((x0 + x1) / 2);
  const gz = Math.floor((z0 + z1) / 2);
  if (gateAxis === 'x') p.door(gx, y0, plot.cz > 0 ? z0 : z1, 'x', 1, 4);
  else p.door(plot.cx > 0 ? x0 : x1, y0, gz, 'z', 1, 4);
  // Tower doors to the courtyard
  for (const [tx, tz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    const dx = tx === x0 ? 2 : -2;
    const dz = tz === z0 ? 2 : -2;
    p.set(tx + dx, y0, tz + (dz > 0 ? 1 : -1), 'air');
    p.set(tx + dx, y0 + 1, tz + (dz > 0 ? 1 : -1), 'air');
  }
  // Keep
  const kw = rng.int(5, 7);
  const kh = wallH + rng.int(6, 10);
  const kx = gx + rng.int(-2, 2);
  const kz = gz + rng.int(-2, 2);
  p.shell(kx - kw, y0, kz - kw, kx + kw, y0 + kh - 1, kz + kw, 'wall', null, null);
  // Floors every 4 with a stair opening
  for (let fy = y0 + 4; fy < y0 + kh - 1; fy += 4) {
    p.box(kx - kw + 1, fy, kz - kw + 1, kx + kw - 1, fy, kz + kw - 1, 'floor');
  }
  // Internal staircase along the +x wall climbing to each floor
  let cy = y0;
  let side = 1;
  while (cy + 4 < y0 + kh - 1) {
    const sx = side > 0 ? kx + kw - 1 : kx - kw + 1;
    const startZ = side > 0 ? kz - kw + 1 : kz + kw - 1;
    for (let i = 0; i < 4; i++) {
      const sz = startZ + side * i;
      for (let yy = cy; yy <= cy + i; yy++) p.set(sx, yy, sz, yy === cy + i ? 'stairs' : 'wallAlt');
      p.set(sx, cy + i + 1, sz, 'air');
      p.set(sx, cy + i + 2, sz, 'air');
      p.set(sx, cy + 4, sz, 'air');
    }
    p.set(sx, cy + 4, startZ + side * 4, 'air');
    cy += 4;
    side = -side;
  }
  // Roof
  const roofH = Math.min(kw, 5);
  for (let i = 0; i <= roofH; i++) p.roofLayer(kx - kw + i, y0 + kh + i, kz - kw + i, kx + kw - i, kz + kw - i);
  p.set(kx, y0 + kh + roofH + 1, kz, 'light');
  p.door(kx, y0, kz - kw, 'x', 1, 3);
  p.windows(kx - kw, kz - kw, kx + kw, kz + kw, y0 + 2);
  p.windows(kx - kw, kz - kw, kx + kw, kz + kw, y0 + 6);
  p.windows(kx - kw, kz - kw, kx + kw, kz + kw, y0 + 10);
  // Torches
  for (let x = x0 + 3; x < x1; x += 5) {
    p.set(x, y0 + 3, z0 + 1, 'light');
    p.set(x, y0 + 3, z1 - 1, 'light');
  }
}

function palace(p: Painter, plot: Plot, rng: Random): void {
  const y0 = PLOT_Y;
  const cx = plot.cx;
  const cz = plot.cz;
  const hw = 15;
  const hd = 11;
  const H = rng.int(7, 9);
  // Main hall
  p.shell(cx - hw, y0, cz - hd, cx + hw, y0 + H - 1, cz + hd, 'wall', null, 'roof');
  // Colonnade facade on -z side
  for (let x = cx - hw + 1; x <= cx + hw - 1; x += 3) {
    for (let y = y0; y < y0 + H - 1; y++) p.set(x, y, cz - hd - 2, 'pillar');
    p.set(x, y0 + H - 1, cz - hd - 2, 'trim');
  }
  p.box(cx - hw, y0 + H - 1, cz - hd - 2, cx + hw, y0 + H - 1, cz - hd - 1, 'trim');
  // Windows
  p.windows(cx - hw, cz - hd, cx + hw, cz + hd, y0 + 2, 3);
  p.windows(cx - hw, cz - hd, cx + hw, cz + hd, y0 + 5, 3);
  // Grand entrance
  p.door(cx, y0, cz - hd, 'x', 1, 4);
  // Interior columns and mezzanine
  for (let x = cx - hw + 4; x <= cx + hw - 4; x += 5) {
    for (const z of [cz - hd + 4, cz + hd - 4]) for (let y = y0; y < y0 + H - 1; y++) p.set(x, y, z, 'pillar');
  }
  p.box(cx - hw + 1, y0 + 4, cz + 2, cx + hw - 1, y0 + 4, cz + hd - 1, 'floor');
  p.stairs(cx - hw + 2, y0, cz + 1, 0, 1, 4, 1);
  p.stairs(cx + hw - 2, y0, cz + 1, 0, 1, 4, 1);
  // Wings with domes
  for (const sx of [-1, 1]) {
    const wx = cx + sx * (hw + 4);
    p.shell(wx - 4, y0, cz - 5, wx + 4, y0 + H + 1, cz + 5, 'wallAlt', null, 'floor');
    p.door(wx - sx * 4, y0, cz, 'z', 1, 3);
    // dome
    const R = 4.5;
    for (let x = -5; x <= 5; x++)
      for (let z = -5; z <= 5; z++)
        for (let y = 0; y <= 5; y++) {
          const d = Math.sqrt(x * x + y * y + z * z);
          if (d <= R + 0.2 && d > R - 1) p.set(wx + x, y0 + H + 2 + y, cz + z, y >= 4 ? 'accent' : 'roof');
        }
    p.set(wx, y0 + H + 7, cz, 'light');
    // Interior stair up to the dome room
    let ang = 0;
    for (let y = y0; y < y0 + H + 1; y++) {
      p.set(wx + Math.round(Math.cos(ang) * 2.2), y, cz + Math.round(Math.sin(ang) * 2.2), 'stairs');
      ang += 0.8;
    }
    p.set(wx + Math.round(Math.cos(ang) * 2.2), y0 + H + 1, cz + Math.round(Math.sin(ang) * 2.2), 'air');
  }
  // Central dome
  const R = 6;
  for (let x = -6; x <= 6; x++)
    for (let z = -6; z <= 6; z++)
      for (let y = 0; y <= 6; y++) {
        const d = Math.sqrt(x * x + y * y + z * z);
        if (d <= R + 0.2 && d > R - 1) p.set(cx + x, y0 + H - 1 + y, cz + z, y >= 5 ? 'accent' : 'roof');
        if (d <= R - 1 && y === 0) p.set(cx + x, y0 + H - 1, cz + z, 'air');
      }
  p.set(cx, y0 + H + 6, cz, 'light');
  // Stair from mezzanine up into the dome
  p.stairs(cx - 3, y0 + 4, cz + 4, 1, 0, 4, 1);
  // Garden pool front
  for (let x = cx - 6; x <= cx + 6; x++) for (let z = cz - hd - 8; z <= cz - hd - 5; z++) p.set(x, y0, z, (x + z) % 2 === 0 ? 'glass' : 'accent');
  for (let x = cx - hw; x <= cx + hw; x += 6) p.set(x, y0, cz - hd - 4, 'light');
}

function villa(p: Painter, plot: Plot, rng: Random): void {
  const y0 = PLOT_Y;
  const cx = plot.cx;
  const cz = plot.cz;
  // Ground floor: L-shaped volume with glass walls
  p.shell(cx - 14, y0, cz - 8, cx + 4, y0 + 4, cz + 10, 'wall', 'floor', 'floor');
  p.shell(cx + 4, y0, cz - 8, cx + 14, y0 + 4, cz + 2, 'wallAlt', 'floor', 'floor');
  // Glass facade
  for (let x = cx - 13; x <= cx + 3; x++) for (let y = y0 + 1; y <= y0 + 3; y++) if (x % 3 !== 0) p.set(x, y, cz + 10, 'glass');
  for (let z = cz - 7; z <= cz + 1; z++) for (let y = y0 + 1; y <= y0 + 3; y++) if (z % 3 !== 0) p.set(cx + 14, y, z, 'glass');
  p.door(cx - 5, y0, cz - 8, 'x', 1, 3);
  p.door(cx + 4, y0, cz + 6, 'z', 1, 3);
  // Upper floor cantilevered
  p.shell(cx - 8, y0 + 5, cz - 12, cx + 12, y0 + 8, cz + 4, 'wall', 'floor', 'roof');
  for (let x = cx - 7; x <= cx + 11; x++) for (let y = y0 + 6; y <= y0 + 7; y++) if (x % 2 === 0) p.set(x, y, cz - 12, 'glass');
  for (let x = cx - 7; x <= cx + 11; x++) for (let y = y0 + 6; y <= y0 + 7; y++) if (x % 2 === 0) p.set(x, y, cz + 4, 'glass');
  // Pillars supporting the cantilever
  for (const [px, pz] of [[cx - 7, cz - 11], [cx + 11, cz - 11], [cx + 11, cz + 3]]) for (let y = y0; y < y0 + 5; y++) p.set(px, y, pz, 'pillar');
  // Interior stair
  p.stairs(cx - 12, y0, cz - 6, 0, 1, 5, 1);
  p.set(cx - 12, y0 + 5, cz - 1, 'air');
  p.set(cx - 12, y0 + 4, cz - 1, 'air');
  // Roof terrace + pool
  for (let x = cx - 6; x <= cx + 2; x++) for (let z = cz - 10; z <= cz - 4; z++) p.set(x, y0 + 8, z, 'glass');
  for (let x = cx - 8; x <= cx + 12; x += 4) p.set(x, y0 + 9, cz + 4, 'light');
  // Roof access stair from upper floor
  p.stairs(cx + 10, y0 + 5, cz - 8, 0, 1, 4, 1);
  p.set(cx + 10, y0 + 8, cz - 4, 'air');
  p.set(cx + 10, y0 + 9, cz - 4, 'air');
  // Garden wall & gate
  p.shell(cx - 18, y0, cz - 16, cx + 18, y0 + 2, cz + 16, 'wallAlt', null, null);
  p.door(cx, y0, cz + 16, 'x', 1, 2);
  p.door(cx - 18, y0, cz, 'z', 1, 2);
  for (let x = cx - 16; x <= cx + 16; x += 8) {
    p.set(x, y0 + 3, cz - 16, 'light');
    p.set(x, y0 + 3, cz + 16, 'light');
  }
  void rng;
}

function bunker(p: Painter, plot: Plot, rng: Random): void {
  const y0 = PLOT_Y;
  const x0 = plot.minX + 2;
  const z0 = plot.minZ + 2;
  const x1 = plot.maxX - 2;
  const z1 = plot.maxZ - 2;
  const H = 4;
  // Solid slab then carve a maze of corridors (cell size 3).
  p.box(x0, y0, z0, x1, y0 + H, z1, 'wall');
  p.box(x0, y0 + H, z0, x1, y0 + H, z1, 'roof');
  const cols = Math.floor((x1 - x0 - 1) / 3);
  const rows = Math.floor((z1 - z0 - 1) / 3);
  const visited: boolean[][] = Array.from({ length: cols }, () => Array(rows).fill(false));
  const carveCell = (c: number, r: number): void => {
    const cx = x0 + 1 + c * 3;
    const cz = z0 + 1 + r * 3;
    p.box(cx, y0, cz, cx + 1, y0 + 2, cz + 1, 'air');
    p.box(cx, y0, cz, cx + 1, y0, cz + 1, 'air');
  };
  const carveBetween = (c1: number, r1: number, c2: number, r2: number): void => {
    const ax = x0 + 1 + Math.min(c1, c2) * 3;
    const az = z0 + 1 + Math.min(r1, r2) * 3;
    if (c1 !== c2) p.box(ax + 2, y0, az, ax + 2, y0 + 2, az + 1, 'air');
    else p.box(ax, y0, az + 2, ax + 1, y0 + 2, az + 2, 'air');
  };
  // Recursive backtracker maze
  const stack: [number, number][] = [[Math.floor(cols / 2), Math.floor(rows / 2)]];
  visited[stack[0][0]][stack[0][1]] = true;
  carveCell(stack[0][0], stack[0][1]);
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const opts: [number, number][] = [];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && !visited[nc][nr]) opts.push([nc, nr]);
    }
    if (opts.length === 0) {
      stack.pop();
      continue;
    }
    const [nc, nr] = rng.pick(opts);
    visited[nc][nr] = true;
    carveCell(nc, nr);
    carveBetween(c, r, nc, nr);
    stack.push([nc, nr]);
  }
  // Extra loops
  for (let i = 0; i < Math.floor(cols * rows * 0.12); i++) {
    const c = rng.int(0, cols - 2);
    const r = rng.int(0, rows - 2);
    if (rng.chance(0.5)) carveBetween(c, r, c + 1, r);
    else carveBetween(c, r, c, r + 1);
  }
  // Entrances on two sides
  p.box(x0, y0, z0 + 1, x0, y0 + 2, z0 + 2, 'air');
  p.box(x1, y0, z1 - 2, x1, y0 + 2, z1 - 1, 'air');
  // Ceiling lamps in cells
  for (let c = 0; c < cols; c += 2) for (let r = 0; r < rows; r += 2) p.set(x0 + 1 + c * 3, y0 + 3, z0 + 1 + r * 3, 'light');
  // Rooftop pillboxes with openings
  for (const [bx, bz] of [[x0 + 4, z0 + 4], [x1 - 4, z1 - 4]]) {
    p.shell(bx - 2, y0 + H + 1, bz - 2, bx + 2, y0 + H + 3, bz + 2, 'wallAlt', null, 'roof');
    p.set(bx, y0 + H + 2, bz - 2, 'air');
    p.set(bx, y0 + H + 1, bz, 'air');
    p.set(bx, y0 + H, bz, 'air');
  }
  // Ladder-like stairs from inside up to roof next to a pillbox
  p.stairs(x0 + 7, y0, z0 + 1, 1, 0, 4, 1);
  p.box(x0 + 8, y0 + 3, z0 + 1, x0 + 11, y0 + H, z0 + 1, 'air');
  p.set(x0 + 11, y0 + H, z0 + 1, 'air');
  // Rooftop trim
  p.crenellate(x0, z0, x1, z1, y0 + H + 1);
}

function tower(p: Painter, plot: Plot, rng: Random): void {
  const y0 = PLOT_Y;
  const cx = plot.cx;
  const cz = plot.cz;
  const R = 6;
  const H = PLOT_MAX_HEIGHT - 4;
  // Base plaza
  p.box(cx - 10, y0, cz - 10, cx + 10, y0, cz + 10, 'floor');
  // Cylindrical shell with periodic bands
  for (let x = -R - 1; x <= R + 1; x++)
    for (let z = -R - 1; z <= R + 1; z++) {
      const d = Math.sqrt(x * x + z * z);
      if (d <= R + 0.3 && d > R - 0.9) {
        for (let y = 1; y < H; y++) p.set(cx + x, y0 + y, cz + z, y % 6 === 5 ? 'trim' : y % 6 === 2 && Math.abs(x) % 3 === 0 ? 'glass' : 'wall');
      }
    }
  // Floors every 6 with spiral stairs along the inner wall
  let ang = 0;
  for (let y = 1; y < H; y++) {
    if (y % 6 === 0) {
      for (let x = -R + 1; x <= R - 1; x++)
        for (let z = -R + 1; z <= R - 1; z++) if (x * x + z * z <= (R - 1) * (R - 1)) p.set(cx + x, y0 + y, cz + z, 'floor');
    }
    const sx = Math.round(Math.cos(ang) * (R - 1.6));
    const sz = Math.round(Math.sin(ang) * (R - 1.6));
    p.set(cx + sx, y0 + y, cz + sz, 'stairs');
    p.set(cx + sx, y0 + y + 1, cz + sz, 'air');
    p.set(cx + sx, y0 + y + 2, cz + sz, 'air');
    if ((y + 1) % 6 === 0) {
      const nx = Math.round(Math.cos(ang + 0.55) * (R - 1.6));
      const nz = Math.round(Math.sin(ang + 0.55) * (R - 1.6));
      p.set(cx + nx, y0 + y + 1, cz + nz, 'air');
    }
    ang += 0.55;
  }
  // Entrance
  p.door(cx, y0 + 1, cz - R, 'x', 1, 3);
  p.box(cx - 1, y0 + 1, cz - R - 1, cx + 1, y0 + 3, cz - R + 1, 'air');
  // Observation deck
  for (let x = -R - 2; x <= R + 2; x++)
    for (let z = -R - 2; z <= R + 2; z++) {
      const d = Math.sqrt(x * x + z * z);
      if (d <= R + 2.3) p.set(cx + x, y0 + H, cz + z, 'floor');
      if (d <= R + 2.3 && d > R + 1.4 && (x + z) % 2 === 0) p.set(cx + x, y0 + H + 1, cz + z, 'trim');
    }
  // Spire
  for (let i = 0; i < 4; i++) p.roofLayer(cx - 2 + i, y0 + H + 1 + i, cz - 2 + i, cx + 2 - i, cz + 2 - i);
  p.set(cx, y0 + H + 2, cz, 'air');
  p.set(cx, y0 + H + 1, cz, 'air');
  p.set(cx, y0 + H + 3, cz, 'light');
  // Buttresses
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const bx = Math.round(Math.cos(a) * (R + 2));
    const bz = Math.round(Math.sin(a) * (R + 2));
    for (let y = 1; y < 8 - i * 0; y++) p.set(cx + bx, y0 + y, cz + bz, 'pillar');
    p.set(cx + bx, y0 + 8, cz + bz, 'light');
  }
  void rng;
}

function temple(p: Painter, plot: Plot, rng: Random): void {
  const y0 = PLOT_Y;
  const cx = plot.cx;
  const cz = plot.cz;
  const half = 16;
  // Stepped pyramid with 4 tiers, each tier a hollow shell
  const tiers = 4;
  for (let t = 0; t < tiers; t++) {
    const r = half - t * 4;
    const by = y0 + t * 4;
    p.shell(cx - r, by, cz - r, cx + r, by + 3, cz + r, t % 2 === 0 ? 'wall' : 'wallAlt', t === 0 ? null : 'floor', 'floor');
    // Interior corridor ring
    if (r > 4) {
      p.box(cx - r + 2, by, cz - r + 2, cx + r - 2, by + 2, cz + r - 2, 'air');
      p.box(cx - r + 4, by, cz - r + 4, cx + r - 4, by + 2, cz + r - 4, t % 2 === 0 ? 'wall' : 'wallAlt');
      p.box(cx - r + 2, by, cz - r + 2, cx + r - 2, by, cz + r - 2, 'floor');
    }
    // Stair from this tier to the next along +x
    if (t < tiers - 1) {
      const sx = cx - r + 2;
      p.stairs(sx, by, cz + r - 3, 1, 0, 4, 1);
      p.box(sx + 4, by + 4, cz + r - 3, sx + 5, by + 4, cz + r - 3, 'air');
      p.box(sx + 4, by + 3, cz + r - 3, sx + 5, by + 5, cz + r - 3, 'air');
    }
    // Doorways through the tier's outer wall (front and back)
    p.door(cx, by, cz - r, 'x', 1, 3);
    p.door(cx + (t % 2 === 0 ? 3 : -3), by, cz + r, 'x', 1, 3);
  }
  // Top shrine
  const topY = y0 + tiers * 4;
  p.shell(cx - 3, topY, cz - 3, cx + 3, topY + 4, cz + 3, 'pillar', 'floor', 'roof');
  p.door(cx, topY, cz - 3, 'x', 1, 3);
  p.box(cx - 2, topY + 1, cz - 2, cx + 2, topY + 3, cz + 2, 'air');
  p.set(cx, topY + 5, cz, 'accent');
  p.set(cx, topY + 6, cz, 'light');
  // Grand outer staircase to the first tier top on -z
  p.stairs(cx, y0, cz - half - 1, 0, 1, 4, 3);
  // Torches
  for (let t = 0; t < tiers; t++) {
    const r = half - t * 4;
    for (let x = cx - r; x <= cx + r; x += 6) p.set(x, y0 + t * 4 + 4, cz - r, 'light');
  }
  void rng;
}

const BUILDERS: Record<Archetype, (p: Painter, plot: Plot, rng: Random) => void> = { castle, palace, villa, bunker, tower, temple };

/** Clears the plot and generates a fortress; returns the flag/spawn cells (reachability guaranteed). */
export function generateFortress(world: VoxelWorld, plot: Plot, style: StyleId, rng: Random, archetype?: Archetype): FortressResult {
  const arch = archetype ?? rng.pick(ARCHETYPES);
  world.clearBox(plot.minX, PLOT_Y, plot.minZ, plot.maxX, PLOT_Y + PLOT_MAX_HEIGHT + 2, plot.maxZ);
  const p = new Painter(world, plot, style);
  BUILDERS[arch](p, plot, rng);
  // Pick a hiding spot among the deepest reachable cells.
  let candidates = bestHidingCells(world, plot, 12);
  if (candidates.length === 0) {
    // Structure fully sealed or empty: carve a door and retry, else fall back to the centre.
    p.door(plot.cx, PLOT_Y, plot.minZ + 3, 'x', 1, 3);
    candidates = bestHidingCells(world, plot, 12);
  }
  const flag = candidates.length ? rng.pick(candidates.slice(0, Math.max(1, Math.min(6, candidates.length)))) : { x: plot.cx, y: PLOT_Y, z: plot.cz };
  // Spawn: a reachable cell near the flag that can itself reach the flag.
  const reach = reachableFromOutside(world, plot);
  let spawn: Cell | null = null;
  let bestScore = -Infinity;
  for (const r of reach.values()) {
    if (r.x < plot.minX || r.x > plot.maxX || r.z < plot.minZ || r.z > plot.maxZ) continue;
    const d = Math.abs(r.x - flag.x) + Math.abs(r.z - flag.z) + Math.abs(r.y - flag.y);
    if (d < 3 || d > 14) continue;
    const score = r.dist - d * 0.3 + rng.next() * 2;
    if (score > bestScore) {
      const check = checkReachability(world, plot, flag, { x: r.x, y: r.y, z: r.z });
      if (check.ok) {
        bestScore = score;
        spawn = { x: r.x, y: r.y, z: r.z };
      }
    }
  }
  if (!spawn) {
    // Adjacent to the flag
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = { x: flag.x + dx, y: flag.y, z: flag.z + dz };
      if (world.get(c.x, c.y, c.z) === 0 && world.get(c.x, c.y + 1, c.z) === 0) {
        spawn = c;
        break;
      }
    }
    if (!spawn) spawn = { ...flag };
  }
  const blocks = world.countBlocksInBox(plot.minX, PLOT_Y, plot.minZ, plot.maxX, PLOT_Y + PLOT_MAX_HEIGHT + 2, plot.maxZ);
  return { flag, spawn, blocks, archetype: arch };
}
