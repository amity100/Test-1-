import * as THREE from 'three';
import { heightToNormal, imgPair, noiseField, rng, toTexture, type SurfaceSet } from '../textures';

// Halcyon's surfaces: cream limestone, polished slabs, wrought iron and the
// festival's cloth. Albedos are near-white where vertex colours tint them.
// Every texture tiles in world metres (the Builder's world UVs).

/** A non-square canvas. */
function rect(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const smooth = THREE.MathUtils.smoothstep;

/**
 * T1 ashlar: courses of blocks in running bond with bevelled joints, per-block
 * tone (ochre / rose shifts), pitting and rain streaks under each course. One
 * tile is `tile` metres (2.4: four 0.6 m courses of 1.2 m blocks). Roughness in G.
 */
export function ashlar(size: number, o: { tile?: number; course?: number; block?: number; joint?: number; seed?: number } = {}): SurfaceSet {
  const tile = o.tile ?? 2.4, course = o.course ?? 0.6, block = o.block ?? 1.2, joint = o.joint ?? 0.012;
  const seed = o.seed ?? 211;
  const px = size / tile;
  const rows = Math.round(tile / course), cols = Math.round(tile / block);
  const pit = noiseField(size, seed, 5, 8);
  const grain = noiseField(size, seed + 1, 2, 64);
  const cloud = noiseField(size, seed + 2, 4, 3);
  const streak = noiseField(size, seed + 3, 3, 32);
  const r = rng(seed + 4);
  const tone: number[][] = [];
  for (let i = 0; i < rows * cols; i++) {
    const k = 0.94 + r() * 0.1, warm = r() - 0.5;
    tone.push([k * (1 + warm * 0.035), k, k * (1 - warm * 0.06)]);
  }
  const p = imgPair(size);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const cy = y / px;
    const row = Math.min(rows - 1, Math.floor(cy / course));
    const fy = (cy - row * course) / course;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const cx = (x / px + (row % 2) * block * 0.5) % tile;
      const col = Math.min(cols - 1, Math.floor(cx / block));
      const fx = (cx - col * block) / block;
      // distance to the nearest joint (m)
      const d = Math.min(fy * course, (1 - fy) * course, fx * block, (1 - fx) * block);
      const inJ = d < joint;
      const bevel = smooth(d, joint, joint + 0.03);
      const t = tone[row * cols + col];
      // rain streaks below each course's top edge (canvas y grows down)
      const wet = (1 - fy) ** 3 * smooth(streak[i], 0.45, 0.75) * 0.12;
      const v = (inJ ? 0.66 : 0.9 + cloud[i] * 0.1 - pit[i] * pit[i] * 0.18 + grain[i] * 0.06 - wet) * 255;
      p.ci.data[i * 4] = Math.min(255, v * t[0]);
      p.ci.data[i * 4 + 1] = Math.min(255, v * t[1]);
      p.ci.data[i * 4 + 2] = Math.min(255, v * t[2]);
      p.ci.data[i * 4 + 3] = 255;
      p.ri.data[i * 4] = 255;
      p.ri.data[i * 4 + 1] = (inJ ? 0.95 : 0.8 + grain[i] * 0.12 + pit[i] * 0.05) * 255;
      p.ri.data[i * 4 + 2] = 0;
      p.ri.data[i * 4 + 3] = 255;
      h[i] = (inJ ? 0 : 0.35 + 0.65 * bevel) - pit[i] * 0.12 + grain[i] * 0.05;
    }
  }
  p.cc.putImageData(p.ci, 0, 0);
  p.rc.putImageData(p.ri, 0, 0);
  return { map: toTexture(p.col, true), roughnessMap: toTexture(p.rough, false), normalMap: toTexture(heightToNormal(h, size, 2.5), false) };
}

/** T3 dressed stone: fine-grained cream with faint warped veining (cornices, columns, stairs). Roughness in G. */
export function dressed(size: number, seed = 223): SurfaceSet {
  const n = noiseField(size, seed, 5, 4);
  const w = noiseField(size, seed + 1, 3, 2);
  const grain = noiseField(size, seed + 2, 2, 96);
  const p = imgPair(size);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const vein = Math.abs(Math.sin((x / size) * Math.PI * 6 + w[i] * 9 + n[i] * 4));
      const dark = smooth(1 - vein, 0.92, 1) * 0.06;
      const v = (0.93 + n[i] * 0.05 + grain[i] * 0.03 - dark) * 255;
      p.ci.data[i * 4] = v;
      p.ci.data[i * 4 + 1] = v * 0.985;
      p.ci.data[i * 4 + 2] = v * 0.95;
      p.ci.data[i * 4 + 3] = 255;
      p.ri.data[i * 4] = 255;
      p.ri.data[i * 4 + 1] = (0.55 + n[i] * 0.15 + grain[i] * 0.05) * 255;
      p.ri.data[i * 4 + 2] = 0;
      p.ri.data[i * 4 + 3] = 255;
      h[i] = grain[i] * 0.4 + n[i] * 0.2;
    }
  }
  p.cc.putImageData(p.ci, 0, 0);
  p.rc.putImageData(p.ri, 0, 0);
  return { map: toTexture(p.col, true), roughnessMap: toTexture(p.rough, false), normalMap: toTexture(heightToNormal(h, size, 1.2), false) };
}

/**
 * T4 paving (tile 2.4 m): 1.2 x 0.8 m slabs in cream, honey and grey, darker
 * joints; some slabs polished (they glint in the low sun). Roughness in G.
 */
export function slabs(size: number, seed = 229): SurfaceSet {
  const n = noiseField(size, seed, 5, 4);
  const grain = noiseField(size, seed + 1, 2, 64);
  const r = rng(seed + 2);
  const tones = [[1, 0.97, 0.9], [1, 0.93, 0.8], [0.93, 0.92, 0.9], [0.98, 0.95, 0.86]];
  const cells: { t: number[]; k: number; polished: boolean }[] = [];
  for (let i = 0; i < 6; i++) cells.push({ t: tones[Math.floor(r() * tones.length)], k: 0.9 + r() * 0.12, polished: r() < 0.08 });
  const p = imgPair(size);
  const h = new Float32Array(size * size);
  const px = size / 2.4, joint = 0.008;
  for (let y = 0; y < size; y++) {
    const my = y / px;
    const row = Math.min(2, Math.floor(my / 0.8)), fy = my - row * 0.8;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const mx = x / px;
      const col = Math.min(1, Math.floor(mx / 1.2)), fx = mx - col * 1.2;
      const d = Math.min(fy, 0.8 - fy, fx, 1.2 - fx);
      const j = d < joint;
      const c = cells[row * 2 + col];
      const v = (j ? 0.55 : c.k * (0.88 + n[i] * 0.1 + grain[i] * 0.05)) * 235;
      p.ci.data[i * 4] = v * c.t[0];
      p.ci.data[i * 4 + 1] = v * c.t[1];
      p.ci.data[i * 4 + 2] = v * c.t[2];
      p.ci.data[i * 4 + 3] = 255;
      p.ri.data[i * 4] = 255;
      p.ri.data[i * 4 + 1] = (j ? 0.95 : c.polished ? 0.58 + grain[i] * 0.08 : 0.68 + n[i] * 0.12) * 255;
      p.ri.data[i * 4 + 2] = 0;
      p.ri.data[i * 4 + 3] = 255;
      h[i] = j ? 0 : 0.6 + smooth(d, joint, joint + 0.02) * 0.4 + grain[i] * 0.04;
    }
  }
  p.cc.putImageData(p.ci, 0, 0);
  p.rc.putImageData(p.ri, 0, 0);
  return { map: toTexture(p.col, true), roughnessMap: toTexture(p.rough, false), normalMap: toTexture(heightToNormal(h, size, 2.2), false) };
}

/**
 * T6 + T7, one alpha-tested atlas (u repeats every 2 m): the top half is a
 * wrought-iron railing (rails, bars every 12.5 cm, a band of interlaced rings,
 * gilt knobs), the bottom half a row of stone balusters (8 per 2 m).
 */
export function lattice(w: number) {
  const hgt = w / 2, half = hgt / 2;
  const c = rect(w, hgt);
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, w, hgt);
  const u = w / 512;
  // ---- railing (rows 0..half-2: a 1.1 m panel)
  const iron = '#20252d', hi = '#4a5260';
  const rail = (y: number, t: number) => {
    g.fillStyle = iron;
    g.fillRect(0, y, w, t);
    g.fillStyle = hi;
    g.fillRect(0, y, w, Math.max(1, t * 0.3));
  };
  rail(1, 9 * u);
  rail(half - 12 * u, 7 * u);
  g.fillStyle = iron;
  for (let x = 0; x < w; x += 32 * u) g.fillRect(x + 14 * u, 1, 4 * u, half - 12 * u);
  // interlaced rings at 40 % height and a lower band
  g.strokeStyle = iron;
  g.lineWidth = 3.2 * u;
  for (let x = 0; x < w + 32 * u; x += 32 * u) {
    g.beginPath();
    g.arc(x, half * 0.4, 15 * u, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillRect(0, half * 0.4 - 17 * u, w, 2.5 * u);
  g.fillRect(0, half * 0.4 + 15 * u, w, 2.5 * u);
  // gilt knobs on the top rail, every fourth bar
  g.fillStyle = '#c9a24a';
  for (let x = 0; x < w; x += 128 * u) {
    g.beginPath();
    g.arc(x + 16 * u, 6 * u, 5 * u, 0, Math.PI * 2);
    g.fill();
  }
  // ---- balusters (rows half+2..hgt): vase silhouettes, shaded as cylinders
  const b0 = half + 2, bh = half - 4;
  const prof = (t: number) => {
    // radius (fraction of the 64 px cell) up the baluster, t 0 = bottom
    if (t < 0.1) return 0.36;
    if (t < 0.16) return 0.24;
    if (t < 0.55) return 0.2 + 0.18 * Math.sin(((t - 0.16) / 0.39) * Math.PI * 0.95);
    if (t < 0.78) return 0.2 - 0.09 * Math.sin(((t - 0.55) / 0.23) * Math.PI);
    if (t < 0.86) return 0.23;
    return 0.34;
  };
  const cell = 64 * u;
  for (let yy = 0; yy < bh; yy++) {
    const t = 1 - yy / bh;
    const r = prof(t) * cell;
    for (let x0 = 0; x0 < w; x0 += cell) {
      const cx = x0 + cell / 2;
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const s = (x - cx) / Math.max(1, r);
        if (Math.abs(s) > 1) continue;
        const lit = 0.72 + 0.32 * Math.cos((s + 0.35) * 1.4);
        const v = Math.round(Math.min(255, 238 * lit));
        g.fillStyle = `rgb(${v},${Math.round(v * 0.965)},${Math.round(v * 0.9)})`;
        g.fillRect(x, b0 + yy, 1, 1);
      }
    }
  }
  const t = toTexture(c, true);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Where each picture sits in the decal atlas (u0, v0, u1, v1; v up). */
export const DECAL = {
  redBanner: [0, 0.5, 0.25, 1] as const,
  navyBanner: [0.25, 0.5, 0.75, 1] as const,
  flag: [0.75, 0.75, 1, 1] as const,
  clock: [0.75, 0.5, 1, 0.75] as const,
  /** Sign rows, full width, one eighth of the lower half each. */
  sign: (k: number) => [0, 0.5 - (k + 1) * 0.0625, 1, 0.5 - k * 0.0625] as const,
};
export const SIGNS = ['TOMORROW CENTRAL', 'KESSLER  ·  A BRIGHTER TOMORROW', 'RIVER LAUNCHES', 'MERIDIAN EXPRESS  ·  THE TOWER  ·  18:40', 'TOMORROW BELONGS TO THOSE WHO BUILD IT', 'HALL OF PROGRESS', 'FESTIVAL OF TOMORROW', 'THE LOGGIA'] as const;

/** Kessler's emblem: a gold ring crossed by a vertical bar (the armillary's ring and axis). */
export function emblem(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = r * 0.16;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = r * 0.08;
  g.beginPath();
  g.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  g.stroke();
  g.fillRect(cx - r * 0.07, cy - r * 1.45, r * 0.14, r * 2.9);
  g.beginPath();
  g.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
  g.fill();
}

/**
 * T8 decal atlas (square, `size` px): the red Kessler banner, the navy "A
 * BRIGHTER TOMORROW TOGETHER" banner with its sunrise, a red-and-gold flag,
 * the clock face at 18:40 and eight sign rows (gilt letters on navy).
 * Alpha cuts the banners' swallowtails.
 */
export function decals(size: number) {
  const c = rect(size, size);
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, size, size);
  const S = size / 1024;
  const gold = '#d6a846', cream = '#eee4cf';
  // ---- red banner: x 0..256, y 0..512 (canvas y down)
  {
    const x0 = 0, w = 256 * S, h = 512 * S;
    const grd = g.createLinearGradient(x0, 0, x0 + w, 0);
    for (let k = 0; k <= 8; k++) grd.addColorStop(k / 8, k % 2 ? '#8a1a17' : '#a8231f');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x0, 0);
    g.lineTo(x0 + w, 0);
    g.lineTo(x0 + w, h);
    g.lineTo(x0 + w / 2, h - 40 * S);
    g.lineTo(x0, h);
    g.closePath();
    g.fill();
    g.strokeStyle = gold;
    g.lineWidth = 5 * S;
    g.strokeRect(x0 + 12 * S, 10 * S, w - 24 * S, h - 70 * S);
    g.lineWidth = 2 * S;
    g.strokeRect(x0 + 20 * S, 18 * S, w - 40 * S, h - 86 * S);
    emblem(g, x0 + w / 2, h * 0.25, 58 * S, gold);
    g.fillStyle = gold;
    g.fillRect(x0 + w * 0.3, h * 0.5, w * 0.4, 3 * S);
  }
  // ---- navy banner: x 256..768, y 0..512
  {
    const x0 = 256 * S, w = 512 * S, h = 512 * S;
    g.fillStyle = '#1d2b45';
    g.fillRect(x0, 0, w, h);
    g.strokeStyle = gold;
    g.lineWidth = 5 * S;
    g.strokeRect(x0 + 12 * S, 10 * S, w - 24 * S, h - 20 * S);
    emblem(g, x0 + w / 2, 78 * S, 38 * S, gold);
    g.fillStyle = cream;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${Math.round(58 * S)}px Georgia, "Times New Roman", serif`;
    ['A BRIGHTER', 'TOMORROW', 'TOGETHER'].forEach((s, i) => g.fillText(s, x0 + w / 2, (168 + i * 64) * S));
    // sunrise vignette: a gold half-disc behind navy towers, a tiny airship
    const cy = 468 * S, R = 120 * S;
    const sun = g.createRadialGradient(x0 + w / 2, cy, 0, x0 + w / 2, cy, R);
    sun.addColorStop(0, '#f4d98a');
    sun.addColorStop(1, '#c9953a');
    g.fillStyle = sun;
    g.beginPath();
    g.arc(x0 + w / 2, cy, R, Math.PI, 0);
    g.fill();
    g.fillStyle = '#16213a';
    const r = rng(7);
    for (let k = -6; k <= 6; k++) {
      const tw = (10 + r() * 14) * S, th = (30 + r() * 80 - Math.abs(k) * 6) * S;
      const tx = x0 + w / 2 + k * 18 * S;
      g.fillRect(tx - tw / 2, cy - th, tw, th + 2);
      g.fillRect(tx - 1.5 * S, cy - th - 14 * S, 3 * S, 14 * S);
    }
    g.fillRect(x0 + 20 * S, cy, w - 40 * S, 22 * S);
    g.beginPath();
    g.ellipse(x0 + w * 0.7, 340 * S, 22 * S, 7 * S, 0, 0, Math.PI * 2);
    g.fill();
  }
  // ---- flag: x 768..1024, y 0..256
  {
    const x0 = 768 * S, w = 256 * S, h = 256 * S;
    g.fillStyle = '#9e1f1c';
    g.fillRect(x0, 0, w, h);
    g.fillStyle = gold;
    g.fillRect(x0, h * 0.42, w, h * 0.16);
    emblem(g, x0 + w * 0.3, h * 0.5, 36 * S, gold);
  }
  // ---- clock face at 18:40: x 768..1024, y 256..512
  {
    const cx = 896 * S, cy = 384 * S, R = 120 * S;
    g.fillStyle = '#efe7d4';
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#c9a24a';
    g.lineWidth = 10 * S;
    g.stroke();
    g.fillStyle = '#1f2a36';
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      g.save();
      g.translate(cx + Math.sin(a) * R * 0.8, cy - Math.cos(a) * R * 0.8);
      g.rotate(a);
      g.fillRect(-3 * S, -9 * S, 6 * S, 18 * S);
      g.restore();
    }
    const hand = (a: number, len: number, wd: number) => {
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      g.fillRect(-wd / 2, -len, wd, len + 8 * S);
      g.restore();
    };
    hand(((6 + 40 / 60) / 12) * Math.PI * 2, R * 0.5, 9 * S);
    hand((40 / 60) * Math.PI * 2, R * 0.75, 6 * S);
  }
  // ---- sign rows: y 512..1024, 64 px each
  SIGNS.forEach((s, k) => {
    const y0 = (512 + k * 64) * S, h = 64 * S;
    g.fillStyle = '#1d2b45';
    g.fillRect(0, y0 + 2 * S, size, h - 4 * S);
    g.strokeStyle = gold;
    g.lineWidth = 3 * S;
    g.strokeRect(4 * S, y0 + 6 * S, size - 8 * S, h - 12 * S);
    g.fillStyle = gold;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${Math.round(34 * S)}px Georgia, "Times New Roman", serif`;
    g.fillText(s, size / 2, y0 + h * 0.54);
  });
  const t = toTexture(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Where each picture sits in the foliage atlas (u0, v0, u1, v1; v up). */
export const LEAF = {
  /** Top half: ivy trails hanging from the top edge (u repeats across). */
  ivy: [0, 0.5, 1, 1] as const,
  /** Bottom left: a round clump of leaves in greys (the vertex colour tints it: red maple, green). */
  clump: [0, 0, 0.5, 0.5] as const,
  /** Bottom right: geraniums and white blooms among leaves. */
  flowers: [0.5, 0, 1, 0.5] as const,
};

/**
 * T11 foliage atlas (alpha-cut): hanging ivy trails, a round leaf clump for
 * the tree crowns (grey, so a vertex colour makes it a red maple or a green
 * tree; lit from the upper left, darker inside), and flower clusters.
 */
export function foliage(size: number) {
  const c = rect(size, size);
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, size, size);
  const r = rng(307);
  const S = size / 512, half = size / 2;
  /** A pointed leaf of length len, width wid, turned by ang. */
  const leaf = (x: number, y: number, len: number, wid: number, ang: number, fill: string) => {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(0, -len / 2);
    g.quadraticCurveTo(wid, 0, 0, len / 2);
    g.quadraticCurveTo(-wid, 0, 0, -len / 2);
    g.fill();
    g.restore();
  };
  /** Three lobes fanned out (ivy and maple read alike this small). */
  const lobed = (x: number, y: number, s: number, ang: number, fill: string) => {
    for (const k of [-0.75, 0, 0.75]) leaf(x + Math.sin(ang + k) * s * 0.28, y - Math.cos(ang + k) * s * 0.28, s * (k ? 0.8 : 1), s * 0.42, ang + k, fill);
  };
  const green = (l: number) => `hsl(${95 + r() * 30}, ${40 + r() * 20}%, ${l}%)`;
  // ---- ivy: a dense mat along the top, strands of leaves trailing down (canvas y 0..half)
  for (let i = 0; i < 180; i++) lobed(r() * size, r() * half * 0.16, (9 + r() * 6) * S, (r() - 0.5) * 2, green(14 + r() * 22));
  const strands = 30;
  for (let i = 0; i < strands; i++) {
    let x = ((i + r()) / strands) * size, y = 0;
    const len = (0.35 + r() * 0.62) * half;
    while (y < len) {
      x += (r() - 0.5) * 3 * S;
      y += (4 + r() * 3) * S;
      const s = (7 + r() * 7) * S * (1 - (y / half) * 0.4);
      lobed(x + (r() - 0.5) * 8 * S, y, s, (r() - 0.5) * 1.6 + Math.PI, green(16 + r() * 26));
    }
  }
  // ---- the clump: grey leaves in a disc, lighter toward the upper left (the sun), darker in the middle
  const cx = half / 2, cy = half + half / 2, R = half * 0.46;
  for (let i = 0; i < 420; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    const lit = 0.55 + 0.35 * (-(Math.cos(a) + Math.sin(a)) * 0.5 * (d / R)) + r() * 0.2 - (1 - d / R) * 0.15;
    const v = Math.round(Math.max(0.25, Math.min(1, lit)) * 255);
    lobed(x, y, (10 + r() * 9) * S, r() * Math.PI * 2, `rgb(${v},${Math.round(v * (0.95 + r() * 0.05))},${Math.round(v * (0.88 + r() * 0.1))})`);
  }
  // ---- flowers: leaves, then clusters of red, pink and white blooms
  const fx = half + half / 2, fy = cy;
  for (let i = 0; i < 260; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R;
    leaf(fx + Math.cos(a) * d, fy + Math.sin(a) * d, (10 + r() * 8) * S, (5 + r() * 3) * S, r() * Math.PI * 2, green(18 + r() * 20));
  }
  const bloom = ['#d2304a', '#e0405a', '#b81e36', '#f4e6e0', '#e86a3a'];
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.9;
    const x = fx + Math.cos(a) * d, y = fy + Math.sin(a) * d;
    const col = bloom[Math.floor(r() * bloom.length)];
    for (let k = 0; k < 6; k++) {
      g.fillStyle = col;
      g.beginPath();
      g.arc(x + (r() - 0.5) * 9 * S, y + (r() - 0.5) * 9 * S, (2 + r() * 2.2) * S, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = toTexture(c, true);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** A leafy, opaque texture for clipped hedges and far trees (grey: the vertex colour gives the green or red). */
export function leafy(size: number) {
  const c = rect(size, size);
  const g = c.getContext('2d')!;
  const r = rng(311);
  g.fillStyle = 'rgb(120,120,112)';
  g.fillRect(0, 0, size, size);
  const S = size / 256;
  for (let i = 0; i < 900; i++) {
    const v = Math.round(70 + r() * 150);
    g.save();
    g.translate(r() * size, r() * size);
    g.rotate(r() * Math.PI * 2);
    g.fillStyle = `rgb(${v},${v},${Math.round(v * 0.92)})`;
    g.beginPath();
    g.ellipse(0, 0, (4 + r() * 4) * S, (2 + r() * 2) * S, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  return toTexture(c, true);
}
