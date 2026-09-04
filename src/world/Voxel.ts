import { hexToLinear } from '../core/MathUtil';

/** Block material ids. 0 is air. */
export enum Mat {
  AIR = 0,
  STONE_BRICK = 1,
  SMOOTH_STONE = 2,
  MARBLE = 3,
  WOOD_PLANKS = 4,
  WOOD_LOG = 5,
  METAL_PANEL = 6,
  BRUSHED_METAL = 7,
  GLASS = 8,
  CONCRETE = 9,
  SANDSTONE = 10,
  CANDY = 11,
  NEON = 12,
  ROOF_TILES = 13,
  GOLD = 14,
  CRYSTAL = 15,
  COBBLE = 16,
  LAMP = 17,
}

export const MAT_COUNT = 18;

export type TextureKind =
  | 'brick'
  | 'smooth'
  | 'marble'
  | 'planks'
  | 'log'
  | 'panel'
  | 'brushed'
  | 'glass'
  | 'concrete'
  | 'sandstone'
  | 'candy'
  | 'neon'
  | 'tiles'
  | 'gold'
  | 'crystal'
  | 'cobble'
  | 'lamp';

export interface MaterialDef {
  id: Mat;
  key: string;
  texture: TextureKind;
  roughness: number;
  metalness: number;
  /** Emissive strength (0 = none). Emissive color = tint * emissive map * strength. */
  emissive: number;
  transparent: boolean;
  opacity: number;
}

export const MATERIALS: MaterialDef[] = [
  { id: Mat.AIR, key: 'air', texture: 'smooth', roughness: 1, metalness: 0, emissive: 0, transparent: false, opacity: 1 },
  { id: Mat.STONE_BRICK, key: 'stoneBrick', texture: 'brick', roughness: 0.85, metalness: 0, emissive: 0, transparent: false, opacity: 1 },
  { id: Mat.SMOOTH_STONE, key: 'smoothStone', texture: 'smooth', roughness: 0.6, metalness: 0, emissive: 0, transparent: false, opacity: 1 },
  { id: Mat.MARBLE, key: 'marble', texture: 'marble', roughness: 0.25, metalness: 0, emissive: 0, transparent: false, opacity: 1 },
  { id: Mat.WOOD_PLANKS, key: 'woodPlanks', texture: 'planks', roughness: 0.7, metalness: 0, emissive: 0, transparent: false, opacity: 1 },
  { id: Mat.WOOD_LOG, key: 'woodLog', texture: 'log', roughness: 0.85, metalness: 0, emissive: 0, transparent: false, opacity: 1 },
  { id: Mat.METAL_PANEL, key: 'metalPanel', texture: 'panel', roughness: 0.45, metalness: 0.9, emissive: 0, transparent: false, opacity: 1 },
  { id: Mat.BRUSHED_METAL, key: 'brushedMetal', texture: 'brushed', roughness: 0.35, metalness: 1, emissive: 0, transparent: false, opacity: 1 },
  { id: Mat.GLASS, key: 'glass', texture: 'glass', roughness: 0.05, metalness: 0.1, emissive: 0, transparent: true, opacity: 0.42 },
  { id: Mat.CONCRETE, key: 'concrete', texture: 'concrete', roughness: 0.9, metalness: 0, emissive: 0, transparent: false, opacity: 1 },
  { id: Mat.SANDSTONE, key: 'sandstone', texture: 'sandstone', roughness: 0.95, metalness: 0, emissive: 0, transparent: false, opacity: 1 },
  { id: Mat.CANDY, key: 'candy', texture: 'candy', roughness: 0.18, metalness: 0, emissive: 0, transparent: false, opacity: 1 },
  { id: Mat.NEON, key: 'neon', texture: 'neon', roughness: 0.35, metalness: 0.6, emissive: 2.2, transparent: false, opacity: 1 },
  { id: Mat.ROOF_TILES, key: 'roofTiles', texture: 'tiles', roughness: 0.8, metalness: 0, emissive: 0, transparent: false, opacity: 1 },
  { id: Mat.GOLD, key: 'gold', texture: 'gold', roughness: 0.28, metalness: 1, emissive: 0, transparent: false, opacity: 1 },
  { id: Mat.CRYSTAL, key: 'crystal', texture: 'crystal', roughness: 0.15, metalness: 0.2, emissive: 1.4, transparent: false, opacity: 1 },
  { id: Mat.COBBLE, key: 'cobble', texture: 'cobble', roughness: 0.9, metalness: 0, emissive: 0, transparent: false, opacity: 1 },
  { id: Mat.LAMP, key: 'lamp', texture: 'lamp', roughness: 0.4, metalness: 0, emissive: 3.5, transparent: false, opacity: 1 },
];

export function isTransparent(mat: number): boolean {
  return mat === Mat.GLASS;
}
export function isSolid(mat: number): boolean {
  return mat !== Mat.AIR;
}

/**
 * Global color palette. Index 0..9 neutrals, then 10 per style:
 * 10 candy, 20 gothic, 30 modern, 40 medieval, 50 neon, 60 desert.
 */
export const PALETTE: string[] = [
  // neutrals
  '#ffffff', '#e8e6e1', '#b8b5ad', '#6e6c66', '#2a2a2e', '#17171a', '#8b6b47', '#5a3f24', '#d9c9a3', '#a0522d',
  // candy
  '#ff8fc2', '#ffd1e8', '#9be7d9', '#fff3a3', '#b8a9ff', '#ffb27a', '#7fd8ff', '#ffe0f0', '#c3ffb2', '#ff6fa5',
  // gothic
  '#2d2a33', '#3e3947', '#1a171f', '#5d3f8a', '#8d2b2b', '#4b5563', '#d4b46a', '#2f4f4f', '#6b21a8', '#111014',
  // modern
  '#f5f5f2', '#d6d6d0', '#9a9a94', '#3d3d3a', '#c8a97e', '#7a5c3e', '#7fb3d5', '#e0e5e8', '#2f6f8f', '#d95f3b',
  // medieval
  '#8f8a82', '#6f6a62', '#b3ada3', '#a83a2e', '#7c4a2a', '#c9b58a', '#4f6f3a', '#3b4a6b', '#8a7048', '#575046',
  // neon cyber
  '#0b0f1a', '#141b2e', '#1e2a44', '#00e5ff', '#ff2bd6', '#7c3aed', '#39ff14', '#ffb300', '#f8fafc', '#ff3355',
  // desert
  '#d8b27a', '#c48b52', '#a6673c', '#efd9b0', '#2aa198', '#e0a850', '#7a4b2b', '#f2e8d5', '#b9412e', '#4a6f5a',
];

export const PALETTE_COUNT = PALETTE.length;

/** Linear RGB palette, 3 floats per color. */
export const PALETTE_LINEAR: Float32Array = (() => {
  const arr = new Float32Array(PALETTE.length * 3);
  for (let i = 0; i < PALETTE.length; i++) {
    const [r, g, b] = hexToLinear(PALETTE[i]);
    arr[i * 3] = r;
    arr[i * 3 + 1] = g;
    arr[i * 3 + 2] = b;
  }
  return arr;
})();

export function encodeBlock(mat: number, color: number): number {
  return ((color & 0xff) << 8) | (mat & 0xff);
}
export function blockMat(v: number): number {
  return v & 0xff;
}
export function blockColor(v: number): number {
  return (v >> 8) & 0xff;
}

export const CHUNK_SIZE = 16;
export const CHUNK_SHIFT = 4;
export const CHUNK_MASK = 15;
