import { Mat, encodeBlock } from './Voxel';

export type StyleId = 'candy' | 'gothic' | 'modern' | 'medieval' | 'neon' | 'desert';
export const STYLE_IDS: StyleId[] = ['candy', 'gothic', 'modern', 'medieval', 'neon', 'desert'];

export type BlockRole = 'wall' | 'wallAlt' | 'trim' | 'floor' | 'roof' | 'accent' | 'glass' | 'light' | 'pillar' | 'stairs' | 'ground' | 'door';

export interface StyleDef {
  id: StyleId;
  nameKey: string;
  roles: Record<BlockRole, number>;
  /** Palette indices offered in the UI for this style (style colours first, then neutrals). */
  colors: number[];
  /** Materials offered in the UI, in display order. */
  materials: Mat[];
  /** Accent colour hex for UI chips. */
  accentHex: string;
}

const neutrals = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const allMats: Mat[] = [
  Mat.STONE_BRICK, Mat.SMOOTH_STONE, Mat.COBBLE, Mat.MARBLE, Mat.CONCRETE, Mat.SANDSTONE, Mat.WOOD_PLANKS, Mat.WOOD_LOG,
  Mat.METAL_PANEL, Mat.BRUSHED_METAL, Mat.GOLD, Mat.CANDY, Mat.NEON, Mat.CRYSTAL, Mat.ROOF_TILES, Mat.GLASS, Mat.LAMP,
];

function order(first: Mat[]): Mat[] {
  return [...first, ...allMats.filter((m) => !first.includes(m))];
}

export const STYLES: Record<StyleId, StyleDef> = {
  candy: {
    id: 'candy', nameKey: 'sCandy', accentHex: '#ff8fc2',
    roles: {
      wall: encodeBlock(Mat.CANDY, 10), wallAlt: encodeBlock(Mat.CANDY, 12), trim: encodeBlock(Mat.CANDY, 0), floor: encodeBlock(Mat.MARBLE, 17),
      roof: encodeBlock(Mat.CANDY, 14), accent: encodeBlock(Mat.CANDY, 13), glass: encodeBlock(Mat.GLASS, 16), light: encodeBlock(Mat.LAMP, 11),
      pillar: encodeBlock(Mat.CANDY, 0), stairs: encodeBlock(Mat.CANDY, 15), ground: encodeBlock(Mat.COBBLE, 11), door: encodeBlock(Mat.CANDY, 19),
    },
    colors: [...range(10, 19), ...neutrals],
    materials: order([Mat.CANDY, Mat.MARBLE, Mat.GLASS, Mat.LAMP, Mat.GOLD]),
  },
  gothic: {
    id: 'gothic', nameKey: 'sGothic', accentHex: '#6b21a8',
    roles: {
      wall: encodeBlock(Mat.STONE_BRICK, 20), wallAlt: encodeBlock(Mat.SMOOTH_STONE, 21), trim: encodeBlock(Mat.SMOOTH_STONE, 29), floor: encodeBlock(Mat.COBBLE, 22),
      roof: encodeBlock(Mat.ROOF_TILES, 22), accent: encodeBlock(Mat.GOLD, 26), glass: encodeBlock(Mat.GLASS, 23), light: encodeBlock(Mat.CRYSTAL, 28),
      pillar: encodeBlock(Mat.SMOOTH_STONE, 25), stairs: encodeBlock(Mat.STONE_BRICK, 21), ground: encodeBlock(Mat.COBBLE, 20), door: encodeBlock(Mat.WOOD_PLANKS, 7),
    },
    colors: [...range(20, 29), ...neutrals],
    materials: order([Mat.STONE_BRICK, Mat.SMOOTH_STONE, Mat.COBBLE, Mat.CRYSTAL, Mat.GOLD, Mat.ROOF_TILES]),
  },
  modern: {
    id: 'modern', nameKey: 'sModern', accentHex: '#2f6f8f',
    roles: {
      wall: encodeBlock(Mat.CONCRETE, 30), wallAlt: encodeBlock(Mat.CONCRETE, 32), trim: encodeBlock(Mat.BRUSHED_METAL, 37), floor: encodeBlock(Mat.CONCRETE, 31),
      roof: encodeBlock(Mat.CONCRETE, 33), accent: encodeBlock(Mat.WOOD_PLANKS, 34), glass: encodeBlock(Mat.GLASS, 36), light: encodeBlock(Mat.LAMP, 0),
      pillar: encodeBlock(Mat.METAL_PANEL, 33), stairs: encodeBlock(Mat.CONCRETE, 31), ground: encodeBlock(Mat.SMOOTH_STONE, 31), door: encodeBlock(Mat.WOOD_PLANKS, 35),
    },
    colors: [...range(30, 39), ...neutrals],
    materials: order([Mat.CONCRETE, Mat.GLASS, Mat.BRUSHED_METAL, Mat.METAL_PANEL, Mat.WOOD_PLANKS, Mat.LAMP]),
  },
  medieval: {
    id: 'medieval', nameKey: 'sMedieval', accentHex: '#a83a2e',
    roles: {
      wall: encodeBlock(Mat.STONE_BRICK, 40), wallAlt: encodeBlock(Mat.STONE_BRICK, 41), trim: encodeBlock(Mat.SMOOTH_STONE, 42), floor: encodeBlock(Mat.WOOD_PLANKS, 44),
      roof: encodeBlock(Mat.ROOF_TILES, 43), accent: encodeBlock(Mat.WOOD_LOG, 44), glass: encodeBlock(Mat.GLASS, 47), light: encodeBlock(Mat.LAMP, 8),
      pillar: encodeBlock(Mat.SMOOTH_STONE, 41), stairs: encodeBlock(Mat.STONE_BRICK, 41), ground: encodeBlock(Mat.COBBLE, 40), door: encodeBlock(Mat.WOOD_PLANKS, 7),
    },
    colors: [...range(40, 49), ...neutrals],
    materials: order([Mat.STONE_BRICK, Mat.SMOOTH_STONE, Mat.COBBLE, Mat.WOOD_PLANKS, Mat.WOOD_LOG, Mat.ROOF_TILES]),
  },
  neon: {
    id: 'neon', nameKey: 'sNeon', accentHex: '#00e5ff',
    roles: {
      wall: encodeBlock(Mat.NEON, 53), wallAlt: encodeBlock(Mat.METAL_PANEL, 51), trim: encodeBlock(Mat.NEON, 54), floor: encodeBlock(Mat.METAL_PANEL, 50),
      roof: encodeBlock(Mat.BRUSHED_METAL, 52), accent: encodeBlock(Mat.NEON, 56), glass: encodeBlock(Mat.GLASS, 53), light: encodeBlock(Mat.LAMP, 53),
      pillar: encodeBlock(Mat.BRUSHED_METAL, 55), stairs: encodeBlock(Mat.METAL_PANEL, 52), ground: encodeBlock(Mat.METAL_PANEL, 51), door: encodeBlock(Mat.NEON, 57),
    },
    colors: [...range(50, 59), ...neutrals],
    materials: order([Mat.NEON, Mat.METAL_PANEL, Mat.BRUSHED_METAL, Mat.GLASS, Mat.LAMP, Mat.CRYSTAL]),
  },
  desert: {
    id: 'desert', nameKey: 'sDesert', accentHex: '#2aa198',
    roles: {
      wall: encodeBlock(Mat.SANDSTONE, 60), wallAlt: encodeBlock(Mat.SANDSTONE, 61), trim: encodeBlock(Mat.SANDSTONE, 63), floor: encodeBlock(Mat.SANDSTONE, 62),
      roof: encodeBlock(Mat.WOOD_PLANKS, 66), accent: encodeBlock(Mat.GOLD, 65), glass: encodeBlock(Mat.GLASS, 64), light: encodeBlock(Mat.LAMP, 65),
      pillar: encodeBlock(Mat.MARBLE, 67), stairs: encodeBlock(Mat.SANDSTONE, 61), ground: encodeBlock(Mat.SANDSTONE, 60), door: encodeBlock(Mat.WOOD_PLANKS, 66),
    },
    colors: [...range(60, 69), ...neutrals],
    materials: order([Mat.SANDSTONE, Mat.MARBLE, Mat.GOLD, Mat.WOOD_PLANKS, Mat.GLASS, Mat.LAMP]),
  },
};

export function styleBlock(style: StyleId, role: BlockRole): number {
  return STYLES[style].roles[role];
}
