import * as THREE from 'three';

// Procedural PBR-ish textures generated at load time. Deterministic noise so
// every run looks identical.

export function rng(seed: number) {
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
export function noiseField(size: number, seed: number, octaves = 5, base = 4): Float32Array {
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

export function toTexture(canvas: HTMLCanvasElement, srgb: boolean, repeat = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

export function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

export function heightToNormal(h: Float32Array, size: number, strength: number) {
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

// ---------------------------------------------------------------------------
// The Tower: construction-site surfaces (golden hour). Albedos are kept light
// where noted so vertex colours can paint them. Where a function says
// "roughness in G, metalness in B", pass the same texture as roughnessMap and
// metalnessMap.
// ---------------------------------------------------------------------------

export function imgPair(size: number) {
  const col = canvas(size), rough = canvas(size);
  const cc = col.getContext('2d')!, rc = rough.getContext('2d')!;
  return { col, rough, cc, rc, ci: cc.createImageData(size, size), ri: rc.createImageData(size, size) };
}

/**
 * Painted structural steel with wear: near-white albedo (tint with vertex
 * colours), chipped edges and scratches showing dark bare metal, a few rust
 * blooms and drips. Roughness in G, metalness in B.
 */
export function paintedSteel(size = 512, seed = 61): SurfaceSet {
  const n = noiseField(size, seed, 5, 4);
  const chip = noiseField(size, seed + 3, 4, 24);
  const rust = noiseField(size, seed + 5, 4, 6);
  const drip = noiseField(size, seed + 9, 3, 32);
  const p = imgPair(size);
  const h = new Float32Array(size * size);
  const r = rng(seed);
  const scratch = new Float32Array(size * size);
  for (let k = 0; k < size / 3; k++) {
    let x = r() * size, y = r() * size;
    const a = r() * Math.PI, len = 6 + r() * size * 0.08;
    for (let s = 0; s < len; s++) {
      x += Math.cos(a);
      y += Math.sin(a) * 0.35;
      const xi = ((Math.floor(x) % size) + size) % size, yi = ((Math.floor(y) % size) + size) % size;
      scratch[yi * size + xi] = 1;
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const chipped = THREE.MathUtils.smoothstep(chip[i] * 0.75 + n[i] * 0.25, 0.71, 0.75) * 0.8;
      const sy = Math.floor(y * 0.08) * size + x;
      const streak = drip[sy % (size * size)] * THREE.MathUtils.smoothstep(y / size, 0.1, 1.0);
      const rusty = THREE.MathUtils.smoothstep(rust[i] * 0.75 + streak * 0.35, 0.7, 0.86) * 0.7;
      const bare = Math.max(chipped, scratch[i] * 0.5);
      const v = 214 + (n[i] - 0.5) * 26 - streak * 22;
      let cr = v * (1 - bare) + 118 * bare;
      let cg = v * (1 - bare) + 120 * bare;
      let cb = v * (1 - bare) + 124 * bare;
      cr = cr * (1 - rusty * 0.8) + 120 * rusty * 0.8;
      cg = cg * (1 - rusty * 0.8) + 66 * rusty * 0.8;
      cb = cb * (1 - rusty * 0.8) + 36 * rusty * 0.8;
      p.ci.data[i * 4] = cr;
      p.ci.data[i * 4 + 1] = cg;
      p.ci.data[i * 4 + 2] = cb;
      p.ci.data[i * 4 + 3] = 255;
      const rough = 0.42 + n[i] * 0.12 + bare * 0.18 + rusty * 0.35;
      const metal = 0.25 + bare * 0.6 - rusty * 0.2;
      p.ri.data[i * 4] = 255;
      p.ri.data[i * 4 + 1] = THREE.MathUtils.clamp(rough, 0.05, 1) * 255;
      p.ri.data[i * 4 + 2] = THREE.MathUtils.clamp(metal, 0, 1) * 255;
      p.ri.data[i * 4 + 3] = 255;
      h[i] = (1 - bare) * 0.6 + n[i] * 0.2 + rusty * 0.3;
    }
  }
  p.cc.putImageData(p.ci, 0, 0);
  p.rc.putImageData(p.ri, 0, 0);
  return { map: toTexture(p.col, true), roughnessMap: toTexture(p.rough, false), normalMap: toTexture(heightToNormal(h, size, 2.2), false) };
}

/** Worn yellow / black safety stripes (45 degrees). Roughness in G, metalness in B. */
export function hazardStripes(size = 256): SurfaceSet {
  const n = noiseField(size, 71, 5, 8);
  const chip = noiseField(size, 73, 3, 32);
  const p = imgPair(size);
  const h = new Float32Array(size * size);
  const bands = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const s = ((x + y) / size) * bands;
      const yellow = s - Math.floor(s) < 0.5;
      const dirt = n[i] * 0.35;
      const chipped = THREE.MathUtils.smoothstep(chip[i], 0.72, 0.78);
      let r0 = yellow ? 242 : 28, g0 = yellow ? 178 : 26, b0 = yellow ? 16 : 24;
      r0 = r0 * (1 - dirt) * (1 - chipped) + 96 * chipped;
      g0 = g0 * (1 - dirt) * (1 - chipped) + 94 * chipped;
      b0 = b0 * (1 - dirt) * (1 - chipped) + 90 * chipped;
      p.ci.data[i * 4] = r0;
      p.ci.data[i * 4 + 1] = g0;
      p.ci.data[i * 4 + 2] = b0;
      p.ci.data[i * 4 + 3] = 255;
      const rough = 0.5 + dirt * 0.6 + chipped * 0.2;
      p.ri.data[i * 4] = 255;
      p.ri.data[i * 4 + 1] = THREE.MathUtils.clamp(rough, 0, 1) * 255;
      p.ri.data[i * 4 + 2] = 40;
      p.ri.data[i * 4 + 3] = 255;
      h[i] = 1 - chipped * 0.6;
    }
  }
  p.cc.putImageData(p.ci, 0, 0);
  p.rc.putImageData(p.ri, 0, 0);
  return { map: toTexture(p.col, true), roughnessMap: toTexture(p.rough, false), normalMap: toTexture(heightToNormal(h, size, 1.5), false) };
}

/** Plywood / planks (crates, hoarding, formwork, scaffold boards). Light albedo for tinting. Roughness in G. */
export function plywood(size = 512): SurfaceSet {
  const grain = noiseField(size, 81, 4, 4);
  const fine = noiseField(size, 83, 2, 64);
  const stain = noiseField(size, 87, 3, 3);
  const p = imgPair(size);
  const h = new Float32Array(size * size);
  const planks = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const pv = (y / size) * planks;
      const plank = Math.floor(pv);
      const f = pv - plank;
      const seam = f < 0.025 || f > 0.975 ? 1 : 0;
      const gx = Math.floor((x * 0.18 + plank * 97) % size);
      const g = grain[y * size + gx];
      const rings = 0.5 + 0.5 * Math.sin(g * 40 + plank * 3);
      const tone = 0.86 + ((plank * 37) % 7) * 0.02;
      const v = (180 + rings * 30 + fine[i] * 20 - stain[i] * stain[i] * 50) * tone;
      p.ci.data[i * 4] = v * (1 - seam * 0.55);
      p.ci.data[i * 4 + 1] = v * 0.8 * (1 - seam * 0.6);
      p.ci.data[i * 4 + 2] = v * 0.58 * (1 - seam * 0.65);
      p.ci.data[i * 4 + 3] = 255;
      p.ri.data[i * 4] = 255;
      p.ri.data[i * 4 + 1] = (0.72 + fine[i] * 0.2 + seam * 0.08) * 255;
      p.ri.data[i * 4 + 2] = 0;
      p.ri.data[i * 4 + 3] = 255;
      h[i] = (1 - seam) * 0.8 + rings * 0.1 + fine[i] * 0.1;
    }
  }
  p.cc.putImageData(p.ci, 0, 0);
  p.rc.putImageData(p.ri, 0, 0);
  return { map: toTexture(p.col, true), roughnessMap: toTexture(p.rough, false), normalMap: toTexture(heightToNormal(h, size, 3), false) };
}

/**
 * Glass curtain wall. One tile = one 6 m storey, four 1.5 m panes, with the
 * spandrel band at the slab line: map it with a 6 m uv scale so storeys line
 * up with slabs every 6 m. Roughness in G, metalness in B.
 */
export function curtainWall(size = 512, seed = 91): SurfaceSet {
  const n = noiseField(size, seed, 4, 4);
  const streak = noiseField(size, seed + 2, 3, 32);
  const r = rng(seed);
  const p = imgPair(size);
  const h = new Float32Array(size * size);
  const panes = 4;
  const paneTone: number[] = [];
  for (let k = 0; k < panes * 2; k++) paneTone.push(r());
  const mull = size / 160;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const u = x / size, v = 1 - y / size; // canvas y=0 is the top; v = 0 at the slab
      const px = (u * panes) % 1;
      const col = Math.floor(u * panes);
      const nearV = Math.min(px, 1 - px) * (size / panes);
      const spandrel = v < 0.12 || v > 0.985;
      const transom = Math.abs(v - 0.62) * size < mull;
      const mullion = nearV < mull || transom || Math.abs(v - 0.12) * size < mull;
      const row = v > 0.62 ? 1 : 0;
      let cr: number, cg: number, cb: number, rough: number, metal: number, hh: number;
      if (spandrel) {
        const t = 58 + n[i] * 16;
        cr = t; cg = t * 1.01; cb = t * 1.05;
        rough = 0.45; metal = 0.5; hh = 0.4;
      } else if (mullion) {
        cr = 168; cg = 170; cb = 174;
        rough = 0.32; metal = 0.9; hh = 1;
      } else {
        const tone = paneTone[col * 2 + row];
        const s = streak[(Math.floor(y * 0.1) * size + x) % (size * size)];
        cr = 40 + tone * 26 + s * 10; cg = 58 + tone * 26 + s * 10; cb = 72 + tone * 26 + s * 10;
        rough = 0.05 + s * 0.08 + tone * 0.05;
        metal = 0.85;
        hh = 0.5;
      }
      p.ci.data[i * 4] = cr;
      p.ci.data[i * 4 + 1] = cg;
      p.ci.data[i * 4 + 2] = cb;
      p.ci.data[i * 4 + 3] = 255;
      p.ri.data[i * 4] = 255;
      p.ri.data[i * 4 + 1] = THREE.MathUtils.clamp(rough, 0, 1) * 255;
      p.ri.data[i * 4 + 2] = THREE.MathUtils.clamp(metal, 0, 1) * 255;
      p.ri.data[i * 4 + 3] = 255;
      h[i] = hh;
    }
  }
  p.cc.putImageData(p.ci, 0, 0);
  p.rc.putImageData(p.ri, 0, 0);
  return { map: toTexture(p.col, true), roughnessMap: toTexture(p.rough, false), normalMap: toTexture(heightToNormal(h, size, 4), false) };
}

/** Orange safety netting (alpha): use with alphaTest + DoubleSide. */
export function safetyNet(size = 256) {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,110,20,1)';
  ctx.lineWidth = Math.max(1.5, size / 110);
  const step = size / 10;
  for (let i = -10; i <= 20; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step + size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i * step, size);
    ctx.lineTo(i * step + size, 0);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(230,90,10,1)';
  ctx.lineWidth = size / 40;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.02);
  ctx.lineTo(size, size * 0.02);
  ctx.stroke();
  return toTexture(c, true);
}

/** Quay paving: 2 m concrete slabs (tile = 4 m), joints, tone variation, oil stains. Roughness in G. */
export function pavers(size = 512): SurfaceSet {
  const n = noiseField(size, 101, 6, 4);
  const stain = noiseField(size, 103, 3, 3);
  const grit = noiseField(size, 107, 2, 64);
  const r = rng(109);
  const tones = [r(), r(), r(), r()];
  const p = imgPair(size);
  const h = new Float32Array(size * size);
  const half = size / 2;
  const joint = Math.max(1, size / 180);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const jx = Math.min(x % half, half - (x % half)), jy = Math.min(y % half, half - (y % half));
      const j = jx < joint || jy < joint ? 1 : 0;
      const slab = (x < half ? 0 : 1) + (y < half ? 0 : 2);
      const tone = 0.9 + tones[slab] * 0.16;
      const oil = THREE.MathUtils.smoothstep(stain[i], 0.62, 0.8);
      const v = (150 + n[i] * 48 + grit[i] * 22) * tone * (1 - oil * 0.35) * (1 - j * 0.5);
      p.ci.data[i * 4] = v * 1.02;
      p.ci.data[i * 4 + 1] = v;
      p.ci.data[i * 4 + 2] = v * 0.95;
      p.ci.data[i * 4 + 3] = 255;
      const rough = 0.82 + n[i] * 0.12 - oil * 0.4;
      p.ri.data[i * 4] = 255;
      p.ri.data[i * 4 + 1] = THREE.MathUtils.clamp(rough, 0, 1) * 255;
      p.ri.data[i * 4 + 2] = 0;
      p.ri.data[i * 4 + 3] = 255;
      h[i] = (1 - j) * 0.7 + grit[i] * 0.3;
    }
  }
  p.cc.putImageData(p.ci, 0, 0);
  p.rc.putImageData(p.ri, 0, 0);
  return { map: toTexture(p.col, true), roughnessMap: toTexture(p.rough, false), normalMap: toTexture(heightToNormal(h, size, 2.5), false) };
}

/** Compacted site ground: dusty gravel with tyre ruts. Roughness in G. */
export function siteGround(size = 512): SurfaceSet {
  const n = noiseField(size, 121, 6, 6);
  const pebble = noiseField(size, 123, 2, 96);
  const patch = noiseField(size, 127, 3, 2);
  const p = imgPair(size);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const peb = THREE.MathUtils.smoothstep(pebble[i], 0.6, 0.75);
      const fx = ((x / size) * 8) % 1 - 0.5;
      const rut = Math.exp(-fx * fx * 60) * 0.35 * patch[i];
      const damp = THREE.MathUtils.smoothstep(patch[i], 0.55, 0.75);
      const v = 128 + n[i] * 50 + peb * 34 - rut * 60 - damp * 30;
      p.ci.data[i * 4] = v * 1.06;
      p.ci.data[i * 4 + 1] = v * 0.97;
      p.ci.data[i * 4 + 2] = v * 0.84;
      p.ci.data[i * 4 + 3] = 255;
      p.ri.data[i * 4] = 255;
      p.ri.data[i * 4 + 1] = (0.9 - damp * 0.25 - peb * 0.1) * 255;
      p.ri.data[i * 4 + 2] = 0;
      p.ri.data[i * 4 + 3] = 255;
      h[i] = n[i] * 0.4 + peb * 0.6 - rut;
    }
  }
  p.cc.putImageData(p.ci, 0, 0);
  p.rc.putImageData(p.ri, 0, 0);
  return { map: toTexture(p.col, true), roughnessMap: toTexture(p.rough, false), normalMap: toTexture(heightToNormal(h, size, 3.5), false) };
}

/** Clean lab composite panels (tile = 2.4 m, 1.2 m grid) with faint seams. Roughness in G. */
export function labPanel(size = 256): SurfaceSet {
  const n = noiseField(size, 131, 3, 4);
  const p = imgPair(size);
  const h = new Float32Array(size * size);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const jx = Math.min(x % half, half - (x % half)), jy = Math.min(y % half, half - (y % half));
      const seam = jx < 1.2 || jy < 1.2 ? 1 : 0;
      const v = 232 + n[i] * 14 - seam * 90;
      p.ci.data[i * 4] = v;
      p.ci.data[i * 4 + 1] = v;
      p.ci.data[i * 4 + 2] = Math.min(255, v * 1.01);
      p.ci.data[i * 4 + 3] = 255;
      p.ri.data[i * 4] = 255;
      p.ri.data[i * 4 + 1] = (0.32 + n[i] * 0.1 + seam * 0.3) * 255;
      p.ri.data[i * 4 + 2] = 0;
      p.ri.data[i * 4 + 3] = 255;
      h[i] = 1 - seam;
    }
  }
  p.cc.putImageData(p.ci, 0, 0);
  p.rc.putImageData(p.ri, 0, 0);
  return { map: toTexture(p.col, true), roughnessMap: toTexture(p.rough, false), normalMap: toTexture(heightToNormal(h, size, 2), false) };
}

/** Sign / banner text (any aspect), optional background fill. */
export function signText(text: string, opts: { w?: number; h?: number; color?: string; font?: string; bg?: string } = {}) {
  const w = opts.w ?? 1024, hgt = opts.h ?? 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = hgt;
  const ctx = c.getContext('2d')!;
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, w, hgt);
  } else ctx.clearRect(0, 0, w, hgt);
  ctx.font = opts.font ?? `900 ${Math.round(hgt * 0.62)}px "Arial Black", Impact, sans-serif`;
  ctx.fillStyle = opts.color ?? '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, hgt * 0.54);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
