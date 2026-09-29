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
// 512 px variants for the phone tier (tools/world/make_lowres.py: resampled per channel offline, because a
// runtime canvas downscale premultiplies alpha and wipes the height / AO packed there -> black texels)
import limeA512 from '../assets/world/limestone_a_512.webp';
import limeN512 from '../assets/world/limestone_n_512.webp';
import groundA512 from '../assets/world/ground_a_512.webp';
import groundN512 from '../assets/world/ground_n_512.webp';
import soilA512 from '../assets/world/soil_a_512.webp';
import soilN512 from '../assets/world/soil_n_512.webp';
import gravelA512 from '../assets/world/gravel_a_512.webp';
import gravelN512 from '../assets/world/gravel_n_512.webp';
import drywallA512 from '../assets/world/drywall_a_512.webp';
import drywallN512 from '../assets/world/drywall_n_512.webp';
import masonryA512 from '../assets/world/masonry_a_512.webp';
import masonryN512 from '../assets/world/masonry_n_512.webp';
import oliveLeaves512 from '../assets/world/olive_leaves_512.webp';
import cypressLeaves512 from '../assets/world/cypress_leaves_512.webp';
import broadLeaves512 from '../assets/world/broadleaf_leaves_512.webp';
import shrubLeaves512 from '../assets/world/shrub_leaves_512.webp';
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

/** Downscale an opaque (JPEG) image to `max` px on its long edge. Never use it for images whose alpha carries data. */
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
  // World textures are never resampled at runtime (alpha carries data): pick the offline 512 px variant instead.
  // Phones: primary ground / limestone / olive foliage stay at 1024, secondary materials use 512 px.
  const tiny = engineMax < 1024;
  const primary = (full: string, small: string) => (tiny ? small : full);
  const secondary = (full: string, small: string) => (tiny || tier === 'low' ? small : full);
  const load = (url: string, srgb: boolean, repeat = true) => {
    const t = loader.load(url);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    // already sized per tier; alpha is data -> the engine's texture budget must not canvas-resample it
    t.userData.keepSize = true;
    return t;
  };
  // character cloth (JPEG, no alpha): a canvas downscale is safe here
  const loadJpg = (url: string, srgb: boolean) => {
    const t = loader.load(url, (tex) => {
      const c = shrink(tex.image as HTMLImageElement, Math.min(engineMax, 1024));
      if (c) {
        tex.image = c;
        tex.needsUpdate = true;
      }
    });
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  };
  const foliage = (url: string) => {
    const t = load(url, true, false);
    t.anisotropy = Math.min(aniso, 4);
    return t;
  };
  const broad = foliage(secondary(broadLeaves, broadLeaves512));
  const set: TextureSet = {
    rock: load(primary(limeA, limeA512), true), rockN: load(primary(limeN, limeN512), false),
    grass: load(primary(groundA, groundA512), true), grassN: load(primary(groundN, groundN512), false),
    soil: load(secondary(soilA, soilA512), true), soilN: load(secondary(soilN, soilN512), false),
    wall: load(secondary(drywallA, drywallA512), true), wallN: load(secondary(drywallN, drywallN512), false),
    linen: loadJpg(linenA, true), linenN: loadJpg(linenN, false),
    leather: loadJpg(leatherA, true), leatherN: loadJpg(leatherN, false),
    bark: load(barkA, true), barkN: load(barkN, false),
    olive: foliage(primary(oliveLeaves, oliveLeaves512)), oak: broad, shrub: foliage(secondary(shrubLeaves, shrubLeaves512)),
    gravel: load(secondary(gravelA, gravelA512), true), gravelN: load(secondary(gravelN, gravelN512), false),
    masonry: load(secondary(masonryA, masonryA512), true), masonryN: load(secondary(masonryN, masonryN512), false),
    cypress: foliage(secondary(cypressLeaves, cypressLeaves512)),
    broadleaf: broad,
  };
  return new Promise((resolve, reject) => {
    manager.onProgress = (_u, loaded, total) => onProgress(loaded / total);
    manager.onLoad = () => resolve(set);
    manager.onError = (u) => reject(new Error('Failed to load texture ' + u));
  });
}
