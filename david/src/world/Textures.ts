import * as THREE from 'three';
// World materials (tools/world/gen_world_textures.py): albedo in *_a (alpha = height), normal in *_n (alpha = AO)
import limeA from '../assets/world/limestone_a.webp';
import limeN from '../assets/world/limestone_n.webp';
import groundA from '../assets/world/ground_a.webp';
import groundN from '../assets/world/ground_n.webp';
import soilA from '../assets/world/soil_a.webp';
import soilN from '../assets/world/soil_n.webp';
import gravelA from '../assets/world/gravel_a.webp';
import gravelN from '../assets/world/gravel_n.webp';
import drywallA from '../assets/world/drywall_a.webp';
import drywallN from '../assets/world/drywall_n.webp';
import masonryA from '../assets/world/masonry_a.webp';
import masonryN from '../assets/world/masonry_n.webp';
import barkA from '../assets/world/bark_a.webp';
import barkN from '../assets/world/bark_n.webp';
import oliveLeaves from '../assets/world/olive_leaves.webp';
import cypressLeaves from '../assets/world/cypress_leaves.webp';
import broadLeaves from '../assets/world/broadleaf_leaves.webp';
import shrubLeaves from '../assets/world/shrub_leaves.webp';
// Character cloth (tools/gen_textures.py) — used by DavidModel
import linenA from '../assets/textures/linen_albedo.jpg';
import linenN from '../assets/textures/linen_normal.jpg';
import leatherA from '../assets/textures/leather_albedo.jpg';
import leatherN from '../assets/textures/leather_normal.jpg';
import { worldAnisotropy, worldTexMax, worldTier } from './WorldQuality';

/**
 * Texture set shared by the world and a few props / characters.
 * Terrain-layer albedos carry a height map in alpha; their normal maps carry ambient occlusion in alpha.
 * Foliage textures are 2x2 atlases (see Vegetation.ts for the cell meaning).
 */
export interface TextureSet {
  /** pitted Judean limestone (boulders, outcrops, bedrock) */
  rock: THREE.Texture; rockN: THREE.Texture;
  /** dry golden grassland (terrain) */
  grass: THREE.Texture; grassN: THREE.Texture;
  /** terra rossa */
  soil: THREE.Texture; soilN: THREE.Texture;
  /** dry-stone terrace wall face */
  wall: THREE.Texture; wallN: THREE.Texture;
  linen: THREE.Texture; linenN: THREE.Texture;
  leather: THREE.Texture; leatherN: THREE.Texture;
  /** olive bark (U around the limb, V along it) */
  bark: THREE.Texture; barkN: THREE.Texture;
  /** foliage atlases (RGBA, 2x2 cells) */
  olive: THREE.Texture; oak: THREE.Texture; shrub: THREE.Texture;
  /** wadi gravel */
  gravel: THREE.Texture; gravelN: THREE.Texture;
  /** coursed fieldstone with mud mortar (houses) */
  masonry: THREE.Texture; masonryN: THREE.Texture;
  cypress: THREE.Texture;
  /** same texture as `oak` (oak / carob / terebinth cells) */
  broadleaf: THREE.Texture;
}

/** Downscale an image to `max` px on its long edge (phones: GPU memory). */
function shrink(img: HTMLImageElement | ImageBitmap, max: number): HTMLCanvasElement | null {
  const w = (img as HTMLImageElement).naturalWidth || img.width;
  const h = (img as HTMLImageElement).naturalHeight || img.height;
  if (!w || !h || Math.max(w, h) <= max) return null;
  const s = max / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const g = c.getContext('2d');
  if (!g) return null;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export function loadTextures(renderer: THREE.WebGLRenderer, onProgress: (f: number) => void, quality?: { name?: string; texMax?: number; anisotropy?: number }): Promise<TextureSet> {
  const tier = worldTier(quality);
  const manager = new THREE.LoadingManager();
  const loader = new THREE.TextureLoader(manager);
  const capAniso = quality?.anisotropy || worldAnisotropy() || (tier === 'low' ? 4 : 8);
  const aniso = Math.min(capAniso, renderer.capabilities.getMaxAnisotropy());
  const engineMax = quality?.texMax || worldTexMax() || 4096;
  // phones: secondary materials at 512 px (walls, bark, gravel), primary ground / rock kept at 1024
  const primaryMax = Math.min(engineMax, 1024);
  const secondaryMax = Math.min(engineMax, tier === 'low' ? 512 : 1024);
  const load = (url: string, srgb: boolean, repeat = true, max = primaryMax) => {
    const t = loader.load(url, (tex) => {
      const c = shrink(tex.image as HTMLImageElement, max);
      if (c) {
        tex.image = c;
        tex.needsUpdate = true;
      }
    });
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  };
  const foliage = (url: string) => {
    const t = load(url, true, false, primaryMax);
    t.anisotropy = Math.min(aniso, 4);
    return t;
  };
  const broad = foliage(broadLeaves);
  const set: TextureSet = {
    rock: load(limeA, true), rockN: load(limeN, false),
    grass: load(groundA, true), grassN: load(groundN, false),
    soil: load(soilA, true), soilN: load(soilN, false, true, secondaryMax),
    wall: load(drywallA, true, true, secondaryMax), wallN: load(drywallN, false, true, secondaryMax),
    linen: load(linenA, true), linenN: load(linenN, false),
    leather: load(leatherA, true), leatherN: load(leatherN, false),
    bark: load(barkA, true, true, secondaryMax), barkN: load(barkN, false, true, secondaryMax),
    olive: foliage(oliveLeaves), oak: broad, shrub: foliage(shrubLeaves),
    gravel: load(gravelA, true, true, secondaryMax), gravelN: load(gravelN, false, true, secondaryMax),
    masonry: load(masonryA, true, true, secondaryMax), masonryN: load(masonryN, false, true, secondaryMax),
    cypress: foliage(cypressLeaves),
    broadleaf: broad,
  };
  return new Promise((resolve, reject) => {
    manager.onProgress = (_u, loaded, total) => onProgress(loaded / total);
    manager.onLoad = () => resolve(set);
    manager.onError = (u) => reject(new Error('Failed to load texture ' + u));
  });
}
