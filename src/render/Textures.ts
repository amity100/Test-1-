import * as THREE from 'three';
import { hash2 } from '../core/Random';
import { MATERIALS, MAT_COUNT, type TextureKind } from '../world/Voxel';
import { clamp01, smoothstep, lerp } from '../core/MathUtil';

/** Seamless value-noise on a wrapped lattice (period 1). */
class TileNoise {
  private cache = new Map<string, Float32Array>();
  constructor(private seed: number) {}

  private lattice(freq: number, salt: number): Float32Array {
    const key = `${freq}:${salt}`;
    let l = this.cache.get(key);
    if (!l) {
      l = new Float32Array(freq * freq);
      for (let j = 0; j < freq; j++) for (let i = 0; i < freq; i++) l[j * freq + i] = hash2(i, j, this.seed * 131 + salt * 7 + freq);
      this.cache.set(key, l);
    }
    return l;
  }

  /** x,y in [0,1). Returns [0,1]. */
  sample(x: number, y: number, freq: number, salt = 0): number {
    const l = this.lattice(freq, salt);
    const gx = x * freq;
    const gy = y * freq;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    let fx = gx - x0;
    let fy = gy - y0;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const x1 = (x0 + 1) % freq;
    const y1 = (y0 + 1) % freq;
    const xa = ((x0 % freq) + freq) % freq;
    const ya = ((y0 % freq) + freq) % freq;
    const a = l[ya * freq + xa];
    const b = l[ya * freq + x1];
    const c = l[y1 * freq + xa];
    const d = l[y1 * freq + x1];
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  }

  /** fbm in [0,1]. */
  fbm(x: number, y: number, baseFreq: number, octaves: number, gain = 0.5, salt = 0): number {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let f = baseFreq;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.sample(x, y, f, salt + o * 11);
      norm += amp;
      amp *= gain;
      f *= 2;
    }
    return sum / norm;
  }

  /** Jittered-grid cell noise (wrapped). Returns [f1 distance in cell units, cell hash]. */
  cell(x: number, y: number, freq: number, salt = 0, jitter = 0.9): [number, number] {
    const gx = x * freq;
    const gy = y * freq;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    let best = 1e9;
    let bestId = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const cx = ix + ox;
        const cy = iy + oy;
        const wx = ((cx % freq) + freq) % freq;
        const wy = ((cy % freq) + freq) % freq;
        const h1 = hash2(wx, wy, this.seed * 17 + salt);
        const h2 = hash2(wx + 91, wy + 37, this.seed * 17 + salt);
        const px = cx + 0.5 + (h1 - 0.5) * jitter;
        const py = cy + 0.5 + (h2 - 0.5) * jitter;
        const dx = gx - px;
        const dy = gy - py;
        const d = dx * dx + dy * dy;
        if (d < best) {
          best = d;
          bestId = h1;
        }
      }
    }
    return [Math.sqrt(best), bestId];
  }
}

interface Texel {
  h: number; // height 0..1
  r: number; g: number; b: number; // albedo multiplier (sRGB-ish, 0..1)
  rough: number;
  metal: number;
  emit: number; // emissive mask 0..1
}

type KindFn = (x: number, y: number, n: TileNoise, t: Texel) => void;

function gray(t: Texel, l: number): void {
  t.r = l; t.g = l; t.b = l;
}

/** Distance to nearest edge of the unit tile (0 at edge, 0.5 at centre). */
function edgeDist(x: number, y: number): number {
  return Math.min(x, 1 - x, y, 1 - y);
}

const KINDS: Record<TextureKind, KindFn> = {
  brick(x, y, n, t) {
    const rows = 4;
    const row = Math.floor(y * rows);
    const offset = (row % 2) * 0.5;
    const bx = (x + offset) % 1;
    const bricksPerRow = 2;
    const col = Math.floor(bx * bricksPerRow);
    const fx = (bx * bricksPerRow) % 1;
    const fy = (y * rows) % 1;
    const mortarX = 0.06;
    const mortarY = 0.12;
    const inBrick = fx > mortarX && fy > mortarY;
    const id = hash2(col + row * 7, row, 3);
    const grain = n.fbm(x, y, 24, 3, 0.5, 1);
    const bevel = inBrick ? smoothstep(0, 0.06, Math.min(fx - mortarX, 1 - fx)) * smoothstep(0, 0.12, Math.min(fy - mortarY, 1 - fy)) : 0;
    t.h = inBrick ? 0.55 + 0.45 * bevel + (grain - 0.5) * 0.12 : 0.15 + grain * 0.15;
    const lum = inBrick ? 0.66 + (id - 0.5) * 0.22 + (grain - 0.5) * 0.14 : 0.5 + grain * 0.12;
    gray(t, lum);
    if (!inBrick) { t.r *= 1.03; t.b *= 0.96; }
    t.rough = inBrick ? 0.78 + grain * 0.15 : 0.95;
    t.metal = 0;
    t.emit = 0;
  },
  smooth(x, y, n, t) {
    const g = n.fbm(x, y, 3, 3, 0.5, 2);
    const f = n.fbm(x, y, 32, 2, 0.5, 3);
    t.h = 0.5 + (g - 0.5) * 0.2 + (f - 0.5) * 0.03;
    gray(t, 0.82 + (g - 0.5) * 0.1 + (f - 0.5) * 0.05);
    t.rough = 0.5 + g * 0.2;
    t.metal = 0;
    t.emit = 0;
  },
  marble(x, y, n, t) {
    const w1 = n.fbm(x, y, 2, 4, 0.6, 4);
    const w2 = n.fbm(x + 0.31, y + 0.77, 3, 4, 0.6, 5);
    const v = Math.abs(Math.sin((x + w1 * 1.7 + w2 * 0.6) * Math.PI * 2 * 1.5));
    const vein = Math.pow(1 - v, 5);
    const fine = n.fbm(x, y, 40, 2, 0.5, 6);
    const lum = 0.93 - vein * 0.5 - (fine - 0.5) * 0.04;
    gray(t, lum);
    t.h = 0.5 - vein * 0.05;
    t.rough = 0.18 + vein * 0.25;
    t.metal = 0;
    t.emit = 0;
  },
  planks(x, y, n, t) {
    const planks = 4;
    const row = Math.floor(y * planks);
    const fy = (y * planks) % 1;
    const off = hash2(row, 5, 9);
    const gx = (x + off) % 1;
    const seamX = Math.abs(((gx * 2) % 1) - 0.5) < 0.012 && (row % 2 === 0 ? gx < 0.5 : gx >= 0.5);
    const grain = n.fbm(x * 1 + off, (y * 6) % 1, 6, 3, 0.55, 10 + row);
    const ring = 0.5 + 0.5 * Math.sin((grain * 6 + x * 12 + off * 9) * 2.2);
    const seamY = fy < 0.04 || fy > 0.96;
    const seam = seamY || seamX;
    t.h = seam ? 0.25 : 0.6 + ring * 0.1 + (grain - 0.5) * 0.15;
    const lum = seam ? 0.35 : 0.68 + ring * 0.16 + (hash2(row, 1, 2) - 0.5) * 0.14;
    gray(t, lum);
    t.r *= 1.04; t.b *= 0.94;
    t.rough = 0.6 + ring * 0.2 + (seam ? 0.2 : 0);
    t.metal = 0;
    t.emit = 0;
  },
  log(x, y, n, t) {
    const ridges = n.fbm(x * 1, (y * 0.25) % 1, 14, 3, 0.5, 12);
    const bark = n.fbm(x, y, 5, 3, 0.5, 13);
    const line = 0.5 + 0.5 * Math.sin((x * 18 + bark * 3) * Math.PI * 2);
    t.h = 0.45 + (ridges - 0.5) * 0.45 + line * 0.15;
    gray(t, 0.55 + (ridges - 0.5) * 0.3 + line * 0.14);
    t.r *= 1.05; t.b *= 0.92;
    t.rough = 0.85 + ridges * 0.1;
    t.metal = 0;
    t.emit = 0;
  },
  panel(x, y, n, t) {
    const e = edgeDist(x, y);
    const inset = 0.05;
    const seam = e < inset && e > inset - 0.025;
    const scratches = n.fbm(x * 1, (y * 0.1) % 1, 48, 2, 0.5, 20);
    const rivetPts: [number, number][] = [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]];
    let rivet = 0;
    for (const [rx, ry] of rivetPts) {
      const dx = x - rx;
      const dy = y - ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      rivet = Math.max(rivet, 1 - smoothstep(0.015, 0.03, d));
    }
    const n2 = n.fbm(x, y, 6, 3, 0.5, 21);
    t.h = seam ? 0.2 : 0.55 + rivet * 0.4 + (n2 - 0.5) * 0.05;
    gray(t, (seam ? 0.45 : 0.78 + (n2 - 0.5) * 0.12) + rivet * 0.1 - (scratches - 0.5) * 0.06);
    t.rough = (seam ? 0.6 : 0.38) + (scratches - 0.5) * 0.25 + rivet * 0.05;
    t.metal = seam ? 0.7 : 1;
    t.emit = 0;
  },
  brushed(x, y, n, t) {
    const lines = n.fbm(x * 1, (y * 0.05) % 1, 64, 2, 0.5, 30);
    const soft = n.fbm(x, y, 3, 2, 0.5, 31);
    t.h = 0.5 + (lines - 0.5) * 0.08;
    gray(t, 0.85 + (lines - 0.5) * 0.14 + (soft - 0.5) * 0.06);
    t.rough = 0.28 + (lines - 0.5) * 0.18;
    t.metal = 1;
    t.emit = 0;
  },
  glass(x, y, n, t) {
    const e = edgeDist(x, y);
    const frame = e < 0.045;
    const dirt = n.fbm(x, y, 4, 3, 0.5, 40);
    t.h = frame ? 0.3 : 0.55;
    gray(t, frame ? 0.35 : 0.95 - dirt * 0.05);
    t.rough = frame ? 0.55 : 0.04 + dirt * 0.06;
    t.metal = frame ? 0.8 : 0.1;
    t.emit = 0;
  },
  concrete(x, y, n, t) {
    const coarse = n.fbm(x, y, 4, 4, 0.55, 50);
    const fine = n.fbm(x, y, 40, 2, 0.5, 51);
    const stain = n.fbm(x * 1, y * 1, 2, 3, 0.7, 52);
    let hole = 0;
    for (const [hx, hy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]] as [number, number][]) {
      const dx = x - hx;
      const dy = y - hy;
      const d = Math.sqrt(dx * dx + dy * dy);
      hole = Math.max(hole, 1 - smoothstep(0.012, 0.022, d));
    }
    t.h = 0.55 + (coarse - 0.5) * 0.12 + (fine - 0.5) * 0.08 - hole * 0.5;
    gray(t, 0.8 + (coarse - 0.5) * 0.12 + (fine - 0.5) * 0.08 - stain * 0.12 - hole * 0.4);
    t.rough = 0.88 + fine * 0.1;
    t.metal = 0;
    t.emit = 0;
  },
  sandstone(x, y, n, t) {
    const band = 0.5 + 0.5 * Math.sin((y * 5 + n.fbm(x, y, 2, 2, 0.5, 60) * 0.8) * Math.PI * 2);
    const grain = n.fbm(x, y, 48, 2, 0.5, 61);
    const blotch = n.fbm(x, y, 5, 3, 0.5, 62);
    t.h = 0.5 + (grain - 0.5) * 0.12 + (band - 0.5) * 0.05;
    gray(t, 0.82 + (band - 0.5) * 0.1 + (grain - 0.5) * 0.08 + (blotch - 0.5) * 0.08);
    t.r *= 1.03; t.b *= 0.95;
    t.rough = 0.93;
    t.metal = 0;
    t.emit = 0;
  },
  candy(x, y, n, t) {
    const e = edgeDist(x, y);
    const pillow = smoothstep(0, 0.12, e);
    const swirl = n.fbm(x, y, 3, 3, 0.5, 70);
    const [cd, cid] = n.cell(x, y, 12, 71);
    const sprinkle = cd < 0.16 && cid > 0.7 ? 1 : 0;
    t.h = 0.3 + pillow * 0.6 + sprinkle * 0.1;
    gray(t, 0.95 + (swirl - 0.5) * 0.06);
    if (sprinkle) {
      t.r = 0.98; t.g = 0.98; t.b = 1.0;
    }
    t.rough = 0.15 + (1 - pillow) * 0.1;
    t.metal = 0;
    t.emit = 0;
  },
  neon(x, y, n, t) {
    const e = edgeDist(x, y);
    const band = e > 0.035 && e < 0.075 ? 1 : 0;
    const gridLine = (Math.abs(((x * 4) % 1) - 0.5) > 0.47 || Math.abs(((y * 4) % 1) - 0.5) > 0.47) && e > 0.09 ? 0.35 : 0;
    const tech = n.fbm(x, y, 8, 2, 0.5, 80);
    const brushed = n.fbm(x, (y * 0.1) % 1, 40, 2, 0.5, 81);
    t.h = band ? 0.35 : 0.55 + (tech - 0.5) * 0.05;
    const dark = 0.22 + (tech - 0.5) * 0.1 + (brushed - 0.5) * 0.05;
    gray(t, band ? 0.9 : dark);
    t.rough = band ? 0.2 : 0.4 + (brushed - 0.5) * 0.15;
    t.metal = band ? 0 : 0.7;
    t.emit = band ? 1 : gridLine;
  },
  tiles(x, y, n, t) {
    const rows = 4;
    const row = Math.floor(y * rows);
    const fy = (y * rows) % 1;
    const off = (row % 2) * 0.5;
    const cols = 2;
    const bx = (x + off) % 1;
    const col = Math.floor(bx * cols);
    const fx = ((bx * cols) % 1) - 0.5;
    // Tile: rounded bottom edge (scallop), overlapping rows.
    const arc = Math.sqrt(Math.max(0, 0.25 - fx * fx)) * 2; // 0..1 semicircle profile
    const inTile = fy < 0.85 * arc + 0.15;
    const curve = 1 - fx * fx * 4; // dome across the tile
    const grain = n.fbm(x, y, 20, 2, 0.5, 90);
    const id = hash2(col + row * 3, row, 91);
    t.h = inTile ? 0.35 + curve * 0.45 + fy * 0.1 : 0.15;
    gray(t, inTile ? 0.7 + (id - 0.5) * 0.2 + (grain - 0.5) * 0.1 : 0.4);
    t.rough = 0.8 + grain * 0.1;
    t.metal = 0;
    t.emit = 0;
  },
  gold(x, y, n, t) {
    const [cd, cid] = n.cell(x, y, 10, 100, 0.8);
    const dent = 1 - smoothstep(0.1, 0.55, cd);
    const fine = n.fbm(x, y, 30, 2, 0.5, 101);
    t.h = 0.4 + dent * 0.5 + (fine - 0.5) * 0.05;
    gray(t, 0.92 + (cid - 0.5) * 0.08 + (fine - 0.5) * 0.06);
    t.rough = 0.25 + (1 - dent) * 0.12 + (fine - 0.5) * 0.08;
    t.metal = 1;
    t.emit = 0;
  },
  crystal(x, y, n, t) {
    const [cd, cid] = n.cell(x, y, 5, 110, 1);
    const facet = smoothstep(0.05, 0.45, cd);
    const glow = n.fbm(x, y, 4, 3, 0.5, 111);
    t.h = 0.3 + facet * 0.7;
    gray(t, 0.88 + (cid - 0.5) * 0.15);
    t.rough = 0.12 + (1 - facet) * 0.2;
    t.metal = 0.2;
    t.emit = 0.35 + glow * 0.45 + (1 - facet) * 0.3;
  },
  cobble(x, y, n, t) {
    const [cd, cid] = n.cell(x, y, 5, 120, 0.85);
    const stone = 1 - smoothstep(0.32, 0.5, cd);
    const dome = stone * (1 - cd * cd * 2.5);
    const grain = n.fbm(x, y, 24, 2, 0.5, 121);
    t.h = 0.2 + Math.max(0, dome) * 0.75 + (grain - 0.5) * 0.06;
    gray(t, stone > 0.5 ? 0.72 + (cid - 0.5) * 0.28 + (grain - 0.5) * 0.1 : 0.42 + grain * 0.1);
    t.rough = 0.9;
    t.metal = 0;
    t.emit = 0;
  },
  lamp(x, y, n, t) {
    const e = edgeDist(x, y);
    const frame = e < 0.09;
    const inner = smoothstep(0.09, 0.14, e);
    const g = n.fbm(x, y, 6, 2, 0.5, 130);
    t.h = frame ? 0.6 : 0.45;
    gray(t, frame ? 0.55 : 0.98);
    t.rough = frame ? 0.5 : 0.35;
    t.metal = frame ? 0.6 : 0;
    t.emit = inner * (0.9 + g * 0.1);
  },
};

export interface VoxelTextureSet {
  albedo: THREE.DataArrayTexture;
  normal: THREE.DataArrayTexture;
  orm: THREE.DataArrayTexture;
  size: number;
}

/** Generates all block textures into three DataArrayTextures. */
export function generateVoxelTextures(size = 256, seed = 7): VoxelTextureSet {
  const count = MAT_COUNT;
  const px = size * size;
  const albedo = new Uint8Array(px * 4 * count);
  const normal = new Uint8Array(px * 4 * count);
  const orm = new Uint8Array(px * 4 * count);
  const heights = new Float32Array(px);
  const noise = new TileNoise(seed);
  const texel: Texel = { h: 0.5, r: 1, g: 1, b: 1, rough: 0.5, metal: 0, emit: 0 };

  for (let m = 0; m < count; m++) {
    const def = MATERIALS[m];
    const fn = KINDS[def.texture];
    const layer = m * px * 4;
    const emitScale = clamp01(def.emissive / 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        fn((x + 0.5) / size, (y + 0.5) / size, noise, texel);
        heights[i] = texel.h;
        const o = layer + i * 4;
        albedo[o] = clamp01(texel.r) * 255;
        albedo[o + 1] = clamp01(texel.g) * 255;
        albedo[o + 2] = clamp01(texel.b) * 255;
        albedo[o + 3] = 255;
        orm[o] = clamp01(texel.rough) * 255;
        orm[o + 1] = clamp01(texel.metal) * 255;
        orm[o + 2] = clamp01(texel.emit) * 255;
        orm[o + 3] = emitScale * 255;
      }
    }
    // Normal map from height (Sobel, wrapping).
    const strength = normalStrength(def.texture) * size * 0.02;
    for (let y = 0; y < size; y++) {
      const ym = (y - 1 + size) % size;
      const yp = (y + 1) % size;
      for (let x = 0; x < size; x++) {
        const xm = (x - 1 + size) % size;
        const xp = (x + 1) % size;
        const dx =
          (heights[y * size + xp] - heights[y * size + xm]) * 2 +
          (heights[ym * size + xp] - heights[ym * size + xm]) +
          (heights[yp * size + xp] - heights[yp * size + xm]);
        const dy =
          (heights[yp * size + x] - heights[ym * size + x]) * 2 +
          (heights[yp * size + xm] - heights[ym * size + xm]) +
          (heights[yp * size + xp] - heights[ym * size + xp]);
        let nx = -dx * strength;
        let ny = -dy * strength;
        let nz = 1;
        const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx /= l; ny /= l; nz /= l;
        const o = layer + (y * size + x) * 4;
        normal[o] = (nx * 0.5 + 0.5) * 255;
        normal[o + 1] = (ny * 0.5 + 0.5) * 255;
        normal[o + 2] = (nz * 0.5 + 0.5) * 255;
        normal[o + 3] = 255;
      }
    }
  }

  const mk = (data: Uint8Array, srgb: boolean): THREE.DataArrayTexture => {
    const tex = new THREE.DataArrayTexture(data, size, size, count);
    tex.format = THREE.RGBAFormat;
    tex.type = THREE.UnsignedByteType;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };
  return { albedo: mk(albedo, true), normal: mk(normal, false), orm: mk(orm, false), size };
}

function normalStrength(kind: TextureKind): number {
  switch (kind) {
    case 'brick': return 0.9;
    case 'tiles': return 1.0;
    case 'cobble': return 1.1;
    case 'planks': return 0.6;
    case 'log': return 0.9;
    case 'panel': return 0.8;
    case 'candy': return 0.7;
    case 'gold': return 0.6;
    case 'crystal': return 0.9;
    case 'neon': return 0.5;
    case 'lamp': return 0.4;
    case 'concrete': return 0.5;
    case 'sandstone': return 0.4;
    case 'marble': return 0.2;
    case 'brushed': return 0.25;
    case 'smooth': return 0.3;
    case 'glass': return 0.3;
    default: return 0.5;
  }
}
