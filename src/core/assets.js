// Asset loading: the soldier model and the HDR environment map.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export const ASSET_BASE = (typeof window !== 'undefined' && window.__VANTAGE_ASSET_BASE) || './assets/';

export class Assets {
  constructor(renderer) {
    this.renderer = renderer;
    this.soldier = null;
    this.envMap = null;
    this.factionMaterials = {};
  }

  async load(onProgress = () => {}) {
    const steps = 2; let done = 0;
    const tick = () => onProgress(++done / steps);
    const embedded = (typeof window !== 'undefined' && window.__VANTAGE_EMBED) || null;

    const gltfLoader = new GLTFLoader();
    const soldierP = new Promise((res, rej) => {
      if (embedded && embedded.soldier) gltfLoader.parse(embedded.soldier, '', res, rej);
      else gltfLoader.load(ASSET_BASE + 'models/soldier.glb', res, undefined, rej);
    }).then((g) => { this.soldier = g; tick(); });

    const hdrP = new Promise((res) => {
      const loader = new RGBELoader();
      const onLoad = (tex) => {
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        pmrem.compileEquirectangularShader();
        this.envMap = pmrem.fromEquirectangular(tex).texture;
        tex.dispose(); pmrem.dispose(); tick(); res();
      };
      const onErr = () => { this.envMap = null; tick(); res(); };
      if (embedded && embedded.hdr) { try { const tex = loader.parse(embedded.hdr); const dt = new THREE.DataTexture(tex.data, tex.width, tex.height, tex.format, tex.type); dt.mapping = THREE.EquirectangularReflectionMapping; dt.needsUpdate = true; onLoad(dt); } catch (e) { onErr(); } }
      else loader.load(ASSET_BASE + 'hdr/moonless_golf_1k.hdr', onLoad, undefined, onErr);
    });

    await Promise.all([soldierP, hdrP]);
    this._prepareSoldier();
  }

  _prepareSoldier() {
    const scene = this.soldier.scene;
    let body = null, visor = null;
    scene.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        if (o.name === 'vanguard_Mesh') body = o.material; else if (o.name === 'vanguard_visor') visor = o.material;
      }
    });
    this.bodyMaterial = body;
    this.visorMaterial = visor;
    const mk = (tint, emissive, emissiveI, visorColor, visorEmissive) => {
      const b = body.clone(); b.color = new THREE.Color(tint); b.roughness = 0.75; b.metalness = 0.05;
      if (emissive) { b.emissive = new THREE.Color(emissive); b.emissiveIntensity = emissiveI; }
      const v = visor.clone(); v.color = new THREE.Color(visorColor); v.emissive = new THREE.Color(visorEmissive); v.emissiveIntensity = 0.45; v.roughness = 0.2; v.metalness = 0.6;
      return { body: b, visor: v };
    };
    this.factionMaterials = {
      player: mk(0xffffff, null, 0, 0x9ad6ff, 0x2a8cff),
      squad: mk(0xe8ecd8, null, 0, 0x9ad6ff, 0x2a8cff),
      enemy: mk(0x8a8a90, null, 0, 0xff6a4a, 0xff2a10),
      hostage: mk(0xd9c8b0, null, 0, 0x555555, 0x000000),
    };
  }
}
