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

/** Texture size being generated; the noise lattice wraps at this period so tiles are seamless. */
let WRAP = 256;

function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const n = Math.max(1, Math.round(WRAP / scale));
  const cell = WRAP / n;
  const fx = x / cell;
  const fy = y / cell;
  let x0 = Math.floor(fx);
  let y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  x0 = ((x0 % n) + n) % n;
  y0 = ((y0 % n) + n) % n;
  const x1 = (x0 + 1) % n;
  const y1 = (y0 + 1) % n;
  const a = hash(x0, y0, seed);
  const b = hash(x1, y0, seed);
  const c = hash(x0, y1, seed);
  const d = hash(x1, y1, seed);
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
  WRAP = size;
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

/** Tree bark: vertical fissures over warped ridges. Brown tint is baked in; use a light material colour. */
export function barkMaps(): DetailMaps {
  return build('bark', 256, (x, y) => {
    const warp = fbm(x, y, 32, 201, 3) * 22;
    const ridge = Math.abs(Math.sin((x + warp) * 0.12 + fbm(x, y, 64, 205, 2) * 3));
    const crack = Math.pow(1 - ridge, 4);
    const n = fbm(x, y, 8, 211, 3);
    const v = 0.5 + ridge * 0.4 + (n - 0.5) * 0.25;
    return { r: v * 0.66, g: v * 0.52, b: v * 0.4, h: ridge * 0.6 + n * 0.25 - crack * 0.6, rough: 0.92 };
  });
}

/** Weathered granite: mottled tone, fine grain and thin cracks. */
export function rockMaps(): DetailMaps {
  return build('rock', 256, (x, y) => {
    const big = fbm(x, y, 64, 301, 4);
    const grain = fbm(x, y, 4, 313, 2);
    const crackN = fbm(x, y, 40, 331, 3);
    const crack = Math.max(0, 1 - Math.abs(crackN - 0.5) * 22);
    const v = 0.66 + (big - 0.5) * 0.4 + (grain - 0.5) * 0.2 - crack * 0.4;
    return { r: v, g: v * 0.98, b: v * 0.94, h: big * 0.55 + grain * 0.3 - crack * 0.7, rough: 0.82 + (grain - 0.5) * 0.12 + crack * 0.1 };
  });
}

/** Ground detail: soil clumps and fine grit; tinted by the terrain vertex colours. */
export function groundMaps(): DetailMaps {
  return build('ground', 256, (x, y) => {
    const clump = fbm(x, y, 32, 401, 3);
    const tuft = fbm(x, y, 12, 407, 2);
    const fine = fbm(x, y, 4, 409, 2);
    const v = 0.8 + (clump - 0.5) * 0.36 + (tuft - 0.5) * 0.24 + (fine - 0.5) * 0.14;
    return { r: v, g: v, b: v, h: clump * 0.5 + tuft * 0.35 + fine * 0.15, rough: 0.92 };
  });
}

const alphaCache = new Map<string, THREE.CanvasTexture>();

function seq(seed: number): () => number {
  let i = 0;
  return () => hash(i++, seed, 77);
}

/** Cluster of overlapping leaves with a transparent surround (canopy cards). Near-white so instance colours tint it. */
export function leafClusterTexture(): THREE.CanvasTexture {
  const hit = alphaCache.get('leaf');
  if (hit) return hit;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  const rnd = seq(5);
  // Dense mass of small leaves (a card spans ~1.5 m, so each leaf is 5-9 cm) with a ragged silhouette.
  for (let i = 0; i < 420; i++) {
    const a = rnd() * Math.PI * 2;
    const rad = Math.pow(rnd(), 0.7) * 112;
    const cx = size / 2 + Math.cos(a) * rad;
    const cy = size / 2 + Math.sin(a) * rad;
    const len = 5.5 + rnd() * 6;
    const wid = len * (0.4 + rnd() * 0.25);
    const rot = rnd() * Math.PI;
    const shade = 0.5 + rnd() * 0.5;
    ctx.fillStyle = `rgb(${Math.round(shade * 0.84 * 255)}, ${Math.round(shade * 255)}, ${Math.round(shade * 0.72 * 255)})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, len, wid, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(rot) * len * 0.85, cy - Math.sin(rot) * len * 0.85);
    ctx.lineTo(cx + Math.cos(rot) * len * 0.85, cy + Math.sin(rot) * len * 0.85);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  alphaCache.set('leaf', t);
  return t;
}

/** Pine skirt: opaque needle mass with a ragged, spiky lower edge (v = 0 is the bottom rim of the cone). */
export function needleTexture(): THREE.CanvasTexture {
  const hit = alphaCache.get('needle');
  if (hit) return hit;
  const w = 256;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const rnd = seq(9);
  // Solid upper part with vertical needle streaks.
  ctx.fillStyle = 'rgb(214, 236, 204)';
  ctx.fillRect(0, 0, w, h * 0.62);
  for (let i = 0; i < 140; i++) {
    const x = rnd() * w;
    const shade = 0.6 + rnd() * 0.4;
    ctx.strokeStyle = `rgba(${Math.round(shade * 190)}, ${Math.round(shade * 230)}, ${Math.round(shade * 170)}, 0.9)`;
    ctx.lineWidth = 1 + rnd() * 2;
    ctx.beginPath();
    ctx.moveTo(x, rnd() * h * 0.3);
    ctx.lineTo(x + (rnd() - 0.5) * 10, h * 0.62 + rnd() * 10);
    ctx.stroke();
  }
  // Ragged spikes hanging below.
  for (let i = 0; i < 64; i++) {
    const x = (i / 64) * w + (rnd() - 0.5) * 6;
    const len = h * (0.15 + rnd() * 0.36);
    const half = 3 + rnd() * 5;
    const shade = 0.7 + rnd() * 0.3;
    ctx.fillStyle = `rgb(${Math.round(shade * 200)}, ${Math.round(shade * 232)}, ${Math.round(shade * 180)})`;
    ctx.beginPath();
    ctx.moveTo(x - half, h * 0.6);
    ctx.lineTo(x + half, h * 0.6);
    ctx.lineTo(x + (rnd() - 0.5) * 4, h * 0.6 + len);
    ctx.closePath();
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  alphaCache.set('needle', t);
  return t;
}

/** Five-petal flower with a stem, white so instance colours tint the petals. */
export function flowerTexture(): THREE.CanvasTexture {
  const hit = alphaCache.get('flower');
  if (hit) return hit;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgb(70, 130, 50)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(size / 2, size * 0.42);
  ctx.quadraticCurveTo(size * 0.55, size * 0.75, size / 2, size);
  ctx.stroke();
  ctx.fillStyle = 'rgb(80, 150, 60)';
  ctx.beginPath();
  ctx.ellipse(size * 0.6, size * 0.72, 9, 4, -0.6, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.beginPath();
    ctx.ellipse(size / 2 + Math.cos(a) * 11, size * 0.3 + Math.sin(a) * 11, 10, 6.5, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgb(255, 205, 60)';
  ctx.beginPath();
  ctx.arc(size / 2, size * 0.3, 6, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  alphaCache.set('flower', t);
  return t;
}
