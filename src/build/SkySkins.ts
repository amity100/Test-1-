import { Mat, SKY_CITADEL, SKY_PALETTE, encodeBlock, makeShape, type ShapeKind } from '../world/Voxel';

/**
 * The three finishes a sky citadel can be built in. A skin is a small set of block values with
 * architectural roles — cladding, frame, structure, glass, trim, floor — and the architect asks for
 * roles, never for materials, so one generator yields three different-looking cities. Every builder
 * has a skin; twelve players with three skins give a shared citadel the patchwork of a real skyline.
 */
export type SkinId = 'aurora' | 'obsidian' | 'ember';
export const SKIN_IDS: SkinId[] = ['aurora', 'obsidian', 'ember'];

export interface Skin {
  id: SkinId;
  nameKey: string;
  descKey: string;
  /** Swatches for the picker: cladding, frame, trim. */
  swatch: [string, string, string];
  /** Main cladding: wall spandrels, risers, the plinth. */
  panel: number;
  /** Second cladding, one step darker: floor fields and the underside. */
  panelAlt: number;
  /** Pilasters, beams, posts, floor rims: the dark lines that draw the building. */
  frame: number;
  /** Secondary structure: keels, girders, masts. */
  steel: number;
  /** Window glass and balustrades. */
  glass: number;
  /** Metallic accents: lintels, caps, medallions. */
  trim: number;
  /** The walking surface. */
  floor: number;
  /** Floor pattern lines. */
  inlay: number;
  /** Interior light blocks. */
  lamp: number;
}

const b = (mat: Mat, color: number, shape?: ShapeKind, rot = 0): number => encodeBlock(mat, color, shape ? makeShape(shape, rot) : 0);

export const SKINS: Record<SkinId, Skin> = {
  aurora: {
    id: 'aurora',
    nameKey: 'skinAurora',
    descKey: 'skinAuroraDesc',
    swatch: ['#f4f1ea', '#23272e', '#ffd36a'],
    panel: b(Mat.SMOOTH_STONE, SKY_CITADEL.auroraPanel),
    panelAlt: b(Mat.SMOOTH_STONE, SKY_CITADEL.auroraAlt),
    frame: b(Mat.METAL_PANEL, SKY_CITADEL.graphite),
    steel: b(Mat.BRUSHED_METAL, SKY_CITADEL.gunmetal),
    glass: b(Mat.GLASS, SKY_CITADEL.coolGlass),
    trim: b(Mat.GOLD, SKY_PALETTE.gold),
    floor: b(Mat.SMOOTH_STONE, SKY_CITADEL.auroraAlt),
    inlay: b(Mat.SMOOTH_STONE, SKY_CITADEL.inlay),
    lamp: b(Mat.LAMP, SKY_CITADEL.white),
  },
  obsidian: {
    id: 'obsidian',
    nameKey: 'skinObsidian',
    descKey: 'skinObsidianDesc',
    swatch: ['#2a2d33', '#a7adb5', '#ffd36a'],
    panel: b(Mat.METAL_PANEL, SKY_CITADEL.charcoal),
    panelAlt: b(Mat.SMOOTH_STONE, SKY_CITADEL.slate),
    frame: b(Mat.BRUSHED_METAL, SKY_CITADEL.silver),
    steel: b(Mat.METAL_PANEL, SKY_CITADEL.charcoal),
    glass: b(Mat.GLASS, SKY_CITADEL.smokedGlass),
    trim: b(Mat.GOLD, SKY_PALETTE.gold),
    floor: b(Mat.SMOOTH_STONE, SKY_CITADEL.slate),
    inlay: b(Mat.BRUSHED_METAL, SKY_CITADEL.silver),
    lamp: b(Mat.LAMP, SKY_CITADEL.white),
  },
  ember: {
    id: 'ember',
    nameKey: 'skinEmber',
    descKey: 'skinEmberDesc',
    swatch: ['#e6d8bc', '#4f3526', '#d9a259'],
    panel: b(Mat.CONCRETE, SKY_CITADEL.sand),
    panelAlt: b(Mat.CONCRETE, SKY_CITADEL.tan),
    frame: b(Mat.METAL_PANEL, SKY_CITADEL.bronzeDark),
    steel: b(Mat.BRUSHED_METAL, SKY_PALETTE.bronze),
    glass: b(Mat.GLASS, SKY_CITADEL.warmGlass),
    trim: b(Mat.GOLD, SKY_CITADEL.copper),
    floor: b(Mat.CONCRETE, SKY_CITADEL.tan),
    inlay: b(Mat.METAL_PANEL, SKY_CITADEL.bronzeDark),
    lamp: b(Mat.LAMP, SKY_CITADEL.warmLight),
  },
};

export const SKIN_LIST: Skin[] = SKIN_IDS.map((id) => SKINS[id]);

/** The skin at a slot index (any integer). */
export function skinAt(index: number): Skin {
  return SKIN_LIST[((index % SKIN_LIST.length) + SKIN_LIST.length) % SKIN_LIST.length];
}
export function skinIndex(id: string): number {
  const i = SKIN_IDS.indexOf(id as SkinId);
  return i < 0 ? 0 : i;
}
