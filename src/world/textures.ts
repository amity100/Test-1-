import * as THREE from 'three';

// Procedural PBR-ish textures generated at load time. Deterministic noise so
// every run looks identical.

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value noise, octaves summed. */
function noiseField(size: number, seed: number, octaves = 5, base = 4): Float32Array {
  const r = rng(seed);
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = base << o;
    const grid = new Float32Array(cells * cells);
    for (let i = 0; i < grid.length; i++) grid[i] = r();
    for (let y = 0; y < size; y++) {
      const gy = (y / size) * cells;
      const y0 = Math.floor(gy), fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * cells;
        const x0 = Math.floor(gx), fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
        const a = grid[y0 * cells + x0], b = grid[y0 * cells + x1];
        const c = grid[y1 * cells + x0], d = grid[y1 * cells + x1];
        out[y * size + x] += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy);
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function toTexture(canvas: HTMLCanvasElement, srgb: boolean, repeat = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function heightToNormal(h: Float32Array, size: number, strength: number) {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
      const u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x];
      let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export interface SurfaceSet {
  map: THREE.Texture;
  roughnessMap: THREE.Texture;
  normalMap: THREE.Texture;
}

/** Wet asphalt with puddles: puddles are dark + mirror-smooth in roughness. */
export function asphalt(size = 512): SurfaceSet {
  const n = noiseField(size, 11, 6, 8);
  const p = noiseField(size, 23, 4, 3);
  const grit = noiseField(size, 5, 2, 64);
  const col = canvas(size), rough = canvas(size);
  const cc = col.getContext('2d')!, rc = rough.getContext('2d')!;
  const ci = cc.createImageData(size, size), ri = rc.createImageData(size, size);
  const h = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const puddle = THREE.MathUtils.smoothstep(p[i], 0.56, 0.64);
    const g = grit[i];
    const v = 34 + n[i] * 30 + g * 22 - puddle * 16;
    ci.data[i * 4] = v * 0.95;
    ci.data[i * 4 + 1] = v * 0.97;
    ci.data[i * 4 + 2] = v * 1.02;
    ci.data[i * 4 + 3] = 255;
    const r = (0.62 + n[i] * 0.25 + g * 0.1) * (1 - puddle) + 0.04 * puddle;
    ri.data[i * 4] = ri.data[i * 4 + 1] = ri.data[i * 4 + 2] = r * 255;
    ri.data[i * 4 + 3] = 255;
    h[i] = (g * 0.6 + n[i] * 0.4) * (1 - puddle);
  }
  cc.putImageData(ci, 0, 0);
  rc.putImageData(ri, 0, 0);
  return { map: toTexture(col, true), roughnessMap: toTexture(rough, false), normalMap: toTexture(heightToNormal(h, size, 3.2), false) };
}

export function concrete(size = 512, seed = 3, tint = [1, 1, 1]): SurfaceSet {
  const n = noiseField(size, seed, 6, 4);
  const stain = noiseField(size, seed + 7, 3, 2);
  const grit = noiseField(size, seed + 13, 2, 48);
  const col = canvas(size), rough = canvas(size);
  const cc = col.getContext('2d')!, rc = rough.getContext('2d')!;
  const ci = cc.createImageData(size, size), ri = rc.createImageData(size, size);
  const h = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const v = 95 + n[i] * 55 - stain[i] * stain[i] * 60 + grit[i] * 18;
    ci.data[i * 4] = v * tint[0];
    ci.data[i * 4 + 1] = v * tint[1];
    ci.data[i * 4 + 2] = v * tint[2];
    ci.data[i * 4 + 3] = 255;
    const r = 0.7 + n[i] * 0.2 - stain[i] * 0.25;
    ri.data[i * 4] = ri.data[i * 4 + 1] = ri.data[i * 4 + 2] = THREE.MathUtils.clamp(r, 0.2, 1) * 255;
    ri.data[i * 4 + 3] = 255;
    h[i] = grit[i] * 0.5 + n[i] * 0.5;
  }
  cc.putImageData(ci, 0, 0);
  rc.putImageData(ri, 0, 0);
  return { map: toTexture(col, true), roughnessMap: toTexture(rough, false), normalMap: toTexture(heightToNormal(h, size, 2.0), false) };
}

/**
 * Corrugated steel (shipping containers, warehouse cladding). Grayscale
 * albedo so vertex colors can paint each container.
 */
export function corrugated(size = 512): SurfaceSet {
  const rust = noiseField(size, 41, 5, 6);
  const drip = noiseField(size, 43, 3, 16);
  const col = canvas(size), rough = canvas(size);
  const cc = col.getContext('2d')!, rc = rough.getContext('2d')!;
  const ci = cc.createImageData(size, size), ri = rc.createImageData(size, size);
  const h = new Float32Array(size * size);
  const ribs = 10;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const u = (x / size) * ribs;
      const f = u - Math.floor(u);
      // trapezoidal rib profile
      const profile = THREE.MathUtils.clamp(Math.abs(f - 0.5) * 4 - 0.6, 0, 1);
      h[i] = profile;
      // vertical drip streaks: sample the noise stretched along y
      const sy = Math.floor(y * 0.12) * size + x;
      const streak = drip[sy % (size * size)] * THREE.MathUtils.smoothstep(y / size, 0.0, 0.9);
      const rusty = THREE.MathUtils.smoothstep(rust[i] * 0.8 + streak * 0.35, 0.7, 0.92);
      const grime = rust[i] * 0.35 + streak * 0.25;
      const v = 205 - rusty * 55 - profile * 26 - grime * 45;
      ci.data[i * 4] = v + rusty * 22;
      ci.data[i * 4 + 1] = v - rusty * 6;
      ci.data[i * 4 + 2] = v - rusty * 24;
      ci.data[i * 4 + 3] = 255;
      const r = 0.45 + rusty * 0.45 + streak * 0.1;
      ri.data[i * 4] = ri.data[i * 4 + 1] = ri.data[i * 4 + 2] = r * 255;
      ri.data[i * 4 + 3] = 255;
    }
  }
  cc.putImageData(ci, 0, 0);
  rc.putImageData(ri, 0, 0);
  return { map: toTexture(col, true), roughnessMap: toTexture(rough, false), normalMap: toTexture(heightToNormal(h, size, 6), false) };
}

/** Chain-link fence alpha texture. */
export function chainLink(size = 256) {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(200,205,210,1)';
  ctx.lineWidth = size / 64;
  const step = size / 8;
  for (let i = -8; i <= 16; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step + size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i * step, size);
    ctx.lineTo(i * step + size, 0);
    ctx.stroke();
  }
  const t = toTexture(c, true);
  return t;
}

/** Lit office windows for the distant skyline. */
export function windows(size = 256) {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  const r = rng(99);
  // hazy dusk facade: lighter toward the bottom where the city glow is
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#2b3342');
  grad.addColorStop(1, '#3a3a48');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const cols = 16, rows = 32;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const on = r() < 0.22;
      if (!on) continue;
      const warm = r() < 0.7;
      const b = 0.5 + r() * 0.5;
      ctx.fillStyle = warm ? `rgba(255,${190 + r() * 40},${120 + r() * 40},${b})` : `rgba(170,210,255,${b})`;
      ctx.fillRect((x / cols) * size + 2, (y / rows) * size + 2, size / cols - 4, size / rows - 3);
    }
  }
  return toTexture(c, true);
}

/** Stencil text decal, e.g. container company names. */
export function stencil(text: string, color = '#e8e8e8') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = 'bold 84px "Arial Black", Impact, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft radial sprite used for glows, lens flares and splashes. */
export function radial(size = 128, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Scrolling water ripple normal map. */
export function waterNormals(size = 256) {
  const n = noiseField(size, 77, 5, 8);
  return toTexture(heightToNormal(n, size, 5), false);
}
