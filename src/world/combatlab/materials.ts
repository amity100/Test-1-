import * as THREE from 'three';
import * as TX from '../textures';

export interface LabMaterials {
  materials: Record<string, THREE.Material>;
  /** Scrolling pool normal map (null headless). */
  waterNormals: THREE.Texture | null;
}

/**
 * The lab's decal atlas: white glyphs on transparent (vertex colours tint
 * them), DECAL_COLS x DECAL_ROWS square cells; the glyphs fill each cell's middle half (a 2:1 band).
 */
export const DECALS = ['01', '02', '03', '04', '05', 'T1', 'T2', 'R', '10 M', '20 M', '30 M', '40 M', 'SPAWN', 'COMBAT LAB', 'VOID', 'WATER'] as const;
export type DecalId = (typeof DECALS)[number];
export const DECAL_COLS = 4;
export const DECAL_ROWS = 4;

/** UVs of a decal's cell (CCW from bottom left, as Builder.quad takes them). */
export function decalUV(id: DecalId): [number, number][] {
  const i = DECALS.indexOf(id);
  const c = i % DECAL_COLS, r = Math.floor(i / DECAL_COLS);
  const u0 = c / DECAL_COLS, u1 = (c + 1) / DECAL_COLS;
  // (canvas rows run top-down; texture v runs bottom-up; the glyphs fill the cell's middle half: a 2:1 band)
  const v1 = 1 - (r + 0.25) / DECAL_ROWS, v0 = 1 - (r + 0.75) / DECAL_ROWS;
  return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
}

/**
 * Materials, one per merged bucket (the whole arena draws in about six calls):
 *   grid    the grey-box surfaces: a 4 m tile with 1 m and 0.5 m measure lines (vertex colours tint it)
 *   steel   frames, the gantry, the gate recesses (also the dynamic props' metal)
 *   stripe  orange edge markers and painted lines (a hair in front of what they sit on)
 *   decal   gate numbers, distance marks, labels (one atlas)
 *   emissive gate rifts, the spawn pad ring, light strips (HDR vertex colours)
 *   water   the pool
 *   wood / container: the prop factory's crates and cargo
 * Headless (node tests): plain materials, no canvas textures.
 */
export function createLabMaterials(envMap: THREE.Texture | null, mobile: boolean, headless: boolean): LabMaterials {
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ vertexColors: true, envMap, envMapIntensity: 0.5, ...p });
  const stripe = () => std({ roughness: 0.55, metalness: 0, emissive: new THREE.Color(0xff5a00), emissiveIntensity: 0.18, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const emissive = () => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true });
  if (headless) {
    const materials: Record<string, THREE.Material> = {
      grid: std({ roughness: 0.85 }),
      steel: std({ roughness: 0.45, metalness: 0.7 }),
      stripe: stripe(),
      decal: std({ roughness: 0.8, alphaTest: 0.5, side: THREE.DoubleSide }),
      emissive: emissive(),
      water: new THREE.MeshStandardMaterial({ color: 0x2a6f86, roughness: 0.1, metalness: 0.1 }),
      wood: std({ roughness: 0.8 }),
      container: std({ roughness: 0.6, metalness: 0.4 }),
    };
    return { materials, waterNormals: null };
  }
  const size = mobile ? 512 : 1024;
  const grid = gridTexture(size);
  const waterN = TX.waterNormals(mobile ? 128 : 256);
  waterN.repeat.set(1, 1);
  const materials: Record<string, THREE.Material> = {
    grid: std({ map: grid.map, roughnessMap: grid.rough, roughness: 1, metalness: 0 }),
    steel: std({ roughness: 0.42, metalness: 0.75, envMapIntensity: 0.9 }),
    stripe: stripe(),
    decal: std({ map: decalAtlas(mobile ? 1024 : 2048), alphaTest: 0.5, roughness: 0.75, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    emissive: emissive(),
    water: new THREE.MeshStandardMaterial({ color: 0x1f6a82, roughness: 0.08, metalness: 0.15, normalMap: waterN, normalScale: new THREE.Vector2(0.35, 0.35), envMap, envMapIntensity: 1.1 }),
    wood: std({ roughness: 0.75, metalness: 0 }),
    container: std({ roughness: 0.55, metalness: 0.45 }),
  };
  return { materials, waterNormals: waterN };
}

/**
 * The grey-box tile: 4 m square. A barely-there concrete grain, 0.5 m hair
 * lines, 1 m lines with a cross at each metre, a heavier 4 m border.
 * Roughness: the lines a touch glossier (they catch the low sun).
 */
function gridTexture(size: number) {
  const c = TX.canvas(size);
  const g = c.getContext('2d')!;
  const px = size / 4;
  // base + grain
  g.fillStyle = '#e2e3e4';
  g.fillRect(0, 0, size, size);
  const n = TX.noiseField(size >> 1, 71, 5, 4);
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = n[(y >> 1) * (size >> 1) + (x >> 1)];
      const k = (v - 0.5) * 16;
      const i = (y * size + x) * 4;
      d[i] += k;
      d[i + 1] += k;
      d[i + 2] += k;
    }
  }
  g.putImageData(img, 0, 0);
  const line = (w: number, a: string, step: number) => {
    g.fillStyle = a;
    for (let i = 0; i <= size; i += step) {
      g.fillRect(i - w / 2, 0, w, size);
      g.fillRect(0, i - w / 2, size, w);
    }
  };
  const s = size / 1024;
  line(Math.max(1, 1.5 * s), 'rgba(40,46,54,0.07)', px / 2);
  line(Math.max(1, 3 * s), 'rgba(40,46,54,0.16)', px);
  // metre crosses
  g.fillStyle = 'rgba(30,36,44,0.34)';
  const arm = 18 * s, w = Math.max(1, 4 * s);
  for (let i = 0; i <= size; i += px) for (let j = 0; j <= size; j += px) {
    g.fillRect(i - arm, j - w / 2, arm * 2, w);
    g.fillRect(i - w / 2, j - arm, w, arm * 2);
  }
  // the 4 m border (half on each side of the tile edge: it tiles to a full line)
  g.fillStyle = 'rgba(28,34,42,0.34)';
  const b = Math.max(1, 4 * s);
  g.fillRect(0, 0, size, b);
  g.fillRect(0, size - b, size, b);
  g.fillRect(0, 0, b, size);
  g.fillRect(size - b, 0, b, size);
  const map = TX.toTexture(c, true);
  // roughness: 0.88 on the surface, 0.6 on the lines
  const r = TX.canvas(size);
  const rg = r.getContext('2d')!;
  rg.fillStyle = 'rgb(224,224,224)';
  rg.fillRect(0, 0, size, size);
  rg.fillStyle = 'rgb(150,150,150)';
  for (let i = 0; i <= size; i += px) {
    rg.fillRect(i - 2 * s, 0, 4 * s, size);
    rg.fillRect(0, i - 2 * s, size, 4 * s);
  }
  const rough = TX.toTexture(r, false);
  return { map, rough };
}

/** White glyphs on transparent: stencil numbers and labels. */
function decalAtlas(w: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = w;
  const g = c.getContext('2d')!;
  const cw = w / DECAL_COLS, ch = w / DECAL_ROWS / 2;
  g.clearRect(0, 0, w, w);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  DECALS.forEach((t, i) => {
    const col = i % DECAL_COLS, row = Math.floor(i / DECAL_COLS);
    // each cell is cw x (2 ch): the glyphs sit in its middle half-height band
    const x = col * cw + cw / 2, y = row * ch * 2 + ch;
    const big = t.length <= 2;
    const fs = big ? ch * 1.55 : t.length <= 5 ? ch * 0.95 : ch * 0.62;
    g.font = `800 ${Math.round(fs)}px Oxanium, 'Arial Black', Impact, sans-serif`;
    g.fillText(t, x, y + fs * 0.04, cw * 0.92);
    // an underline tick for the distance marks
    if (t.endsWith(' M')) g.fillRect(col * cw + cw * 0.18, y + fs * 0.58, cw * 0.64, Math.max(2, ch * 0.06));
  });
  const t = TX.toTexture(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
