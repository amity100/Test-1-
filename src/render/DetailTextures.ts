import * as THREE from 'three';

export interface DetailMaps {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

const cache = new Map<string, DetailMaps>();

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number, scale: number, seed: number, octaves = 4): number {
  let v = 0;
  let amp = 0.5;
  let s = scale;
  for (let i = 0; i < octaves; i++) {
    v += valueNoise(x, y, s, seed + i * 17) * amp;
    s *= 0.5;
    amp *= 0.5;
  }
  return v;
}

function toTexture(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Normal map from a height field (Sobel), strength in pixels of slope. */
function normalFromHeight(height: Float32Array, size: number, strength: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const h = (x: number, y: number): number => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 0.5 * 255 + 127;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function build(name: string, size: number, fn: (x: number, y: number) => { r: number; g: number; b: number; h: number; rough: number }): DetailMaps {
  const hit = cache.get(name);
  if (hit) return hit;
  const col = document.createElement('canvas');
  col.width = size;
  col.height = size;
  const rough = document.createElement('canvas');
  rough.width = size;
  rough.height = size;
  const cctx = col.getContext('2d')!;
  const rctx = rough.getContext('2d')!;
  const cimg = cctx.createImageData(size, size);
  const rimg = rctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = fn(x, y);
      const i = (y * size + x) * 4;
      cimg.data[i] = Math.max(0, Math.min(255, p.r * 255));
      cimg.data[i + 1] = Math.max(0, Math.min(255, p.g * 255));
      cimg.data[i + 2] = Math.max(0, Math.min(255, p.b * 255));
      cimg.data[i + 3] = 255;
      const rv = Math.max(0, Math.min(255, p.rough * 255));
      rimg.data[i] = rv;
      rimg.data[i + 1] = rv;
      rimg.data[i + 2] = rv;
      rimg.data[i + 3] = 255;
      height[y * size + x] = p.h;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  const maps: DetailMaps = {
    map: toTexture(col, true),
    normalMap: toTexture(normalFromHeight(height, size, 2.2), false),
    roughnessMap: toTexture(rough, false),
  };
  cache.set(name, maps);
  return maps;
}

/** Ripstop fabric: fine weave, gentle colour variance. Colour comes from the material; map is a tint. */
export function fabricMaps(): DetailMaps {
  return build('fabric', 256, (x, y) => {
    const weave = ((x >> 1) + (y >> 1)) % 2 === 0 ? 1 : 0.9;
    const rip = (x % 32 < 2 || y % 32 < 2) ? 0.88 : 1;
    const n = fbm(x, y, 40, 3, 3);
    const v = (0.88 + n * 0.2) * weave * rip;
    return { r: v, g: v, b: v, h: weave * 0.4 + rip * 0.6 + n * 0.3, rough: 0.82 + (1 - weave) * 0.1 };
  });
}

/** Painted armour: matte coat with edge scratches that show bare metal (lower roughness). */
export function armorMaps(): DetailMaps {
  return build('armor', 256, (x, y) => {
    const n = fbm(x, y, 64, 11, 4);
    const scratch = Math.max(0, fbm(x * 3, y * 0.4, 30, 23, 3) - 0.62) * 3;
    const dent = fbm(x, y, 18, 41, 2);
    const v = 0.92 + (n - 0.5) * 0.14 + scratch * 0.45;
    return { r: v, g: v, b: v, h: n * 0.6 + dent * 0.4 - scratch * 0.5, rough: 0.55 - scratch * 0.4 + (n - 0.5) * 0.1 };
  });
}

/** Gun metal: fine anisotropic brushing plus wear marks. */
export function gunmetalMaps(): DetailMaps {
  return build('gunmetal', 256, (x, y) => {
    const brush = fbm(x * 0.25, y * 6, 20, 5, 3);
    const wear = Math.max(0, fbm(x, y, 40, 9, 3) - 0.6) * 2.2;
    const v = 0.9 + (brush - 0.5) * 0.12 + wear * 0.35;
    return { r: v, g: v, b: v, h: brush * 0.3 + wear * 0.3, rough: 0.36 + (brush - 0.5) * 0.15 - wear * 0.2 };
  });
}

/** Textured polymer (grip surfaces): stippled bumps. */
export function polymerMaps(): DetailMaps {
  return build('polymer', 128, (x, y) => {
    const cell = 6;
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const jx = hash(cx, cy, 1) * cell * 0.6;
    const jy = hash(cx, cy, 2) * cell * 0.6;
    const dx = (x % cell) - cell / 2 - jx * 0.3;
    const dy = (y % cell) - cell / 2 - jy * 0.3;
    const bump = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / (cell * 0.45));
    const v = 0.9 + bump * 0.08;
    return { r: v, g: v, b: v, h: bump, rough: 0.7 + bump * 0.1 };
  });
}

/** Oiled walnut: long grain with fbm waviness and darker rings. */
export function woodMaps(): DetailMaps {
  return build('wood', 256, (x, y) => {
    const wave = fbm(x, y, 90, 71, 3) * 24;
    const ring = Math.sin((y + wave) * 0.35) * 0.5 + 0.5;
    const fine = fbm(x * 6, y * 0.6, 24, 77, 3);
    const v = 0.72 + ring * 0.28 + (fine - 0.5) * 0.14;
    return { r: v, g: v * 0.86, b: v * 0.7, h: ring * 0.5 + fine * 0.5, rough: 0.55 + ring * 0.12 };
  });
}

/** Multi-tone camouflage over a ripstop weave. Tones are RGB triplets in 0..1, dark to light. */
export function camoMaps(name: string, tones: Array<[number, number, number]>): DetailMaps {
  return build(`camo-${name}`, 256, (x, y) => {
    const big = fbm(x, y, 96, 101, 3);
    const mid = fbm(x + 37, y - 19, 48, 113, 3);
    const t = (big * 0.65 + mid * 0.35 - 0.3) / 0.4;
    const idx = Math.max(0, Math.min(tones.length - 1, Math.floor(t * tones.length)));
    const tone = tones[idx];
    const weave = ((x >> 1) + (y >> 1)) % 2 === 0 ? 1 : 0.92;
    const rip = (x % 32 < 2 || y % 32 < 2) ? 0.9 : 1;
    const n = fbm(x, y, 20, 3, 3);
    const k = (0.9 + n * 0.2) * weave * rip;
    return { r: tone[0] * k, g: tone[1] * k, b: tone[2] * k, h: weave * 0.35 + rip * 0.45 + n * 0.2, rough: 0.8 + (1 - weave) * 0.1 };
  });
}

/** Matte black rubber / nylon webbing: soft noise, high roughness. */
export function rubberMaps(): DetailMaps {
  return build('rubber', 128, (x, y) => {
    const n = fbm(x, y, 16, 51, 3);
    const v = 0.9 + (n - 0.5) * 0.1;
    return { r: v, g: v, b: v, h: n * 0.3, rough: 0.9 };
  });
}
