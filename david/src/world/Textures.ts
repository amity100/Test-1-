import * as THREE from 'three';
import rockA from '../assets/textures/rock_albedo.jpg';
import rockN from '../assets/textures/rock_normal.jpg';
import grassA from '../assets/textures/grass_albedo.jpg';
import grassN from '../assets/textures/grass_normal.jpg';
import soilA from '../assets/textures/soil_albedo.jpg';
import soilN from '../assets/textures/soil_normal.jpg';
import wallA from '../assets/textures/wall_albedo.jpg';
import wallN from '../assets/textures/wall_normal.jpg';
import linenA from '../assets/textures/linen_albedo.jpg';
import linenN from '../assets/textures/linen_normal.jpg';
import leatherA from '../assets/textures/leather_albedo.jpg';
import leatherN from '../assets/textures/leather_normal.jpg';
import barkA from '../assets/textures/bark_albedo.jpg';
import barkN from '../assets/textures/bark_normal.jpg';
import oliveLeaves from '../assets/textures/olive_leaves.webp';
import oakLeaves from '../assets/textures/oak_leaves.webp';
import shrubLeaves from '../assets/textures/shrub_leaves.webp';

export interface TextureSet {
  rock: THREE.Texture; rockN: THREE.Texture;
  grass: THREE.Texture; grassN: THREE.Texture;
  soil: THREE.Texture; soilN: THREE.Texture;
  wall: THREE.Texture; wallN: THREE.Texture;
  linen: THREE.Texture; linenN: THREE.Texture;
  leather: THREE.Texture; leatherN: THREE.Texture;
  bark: THREE.Texture; barkN: THREE.Texture;
  olive: THREE.Texture; oak: THREE.Texture; shrub: THREE.Texture;
}

export function loadTextures(renderer: THREE.WebGLRenderer, onProgress: (f: number) => void): Promise<TextureSet> {
  const manager = new THREE.LoadingManager();
  const loader = new THREE.TextureLoader(manager);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const load = (url: string, srgb: boolean, repeat = true) => {
    const t = loader.load(url);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  };
  const set: TextureSet = {
    rock: load(rockA, true), rockN: load(rockN, false),
    grass: load(grassA, true), grassN: load(grassN, false),
    soil: load(soilA, true), soilN: load(soilN, false),
    wall: load(wallA, true), wallN: load(wallN, false),
    linen: load(linenA, true), linenN: load(linenN, false),
    leather: load(leatherA, true), leatherN: load(leatherN, false),
    bark: load(barkA, true), barkN: load(barkN, false),
    olive: load(oliveLeaves, true, false), oak: load(oakLeaves, true, false), shrub: load(shrubLeaves, true, false),
  };
  return new Promise((resolve, reject) => {
    manager.onProgress = (_u, loaded, total) => onProgress(loaded / total);
    manager.onLoad = () => resolve(set);
    manager.onError = (u) => reject(new Error('Failed to load texture ' + u));
  });
}
