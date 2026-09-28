import * as THREE from 'three';
import { Colliders } from './Colliders';
import { shared } from './Shared';
import { PostFX } from '../fx/PostFX';
import { Motes, ParticleSystem, SmokeColumns } from '../fx/Particles';
import { SkySystem } from '../world/Sky';
import { Terrain } from '../world/Terrain';
import { Vegetation } from '../world/Vegetation';
import { Rocks } from '../world/Rocks';
import { Grass } from '../world/Grass';
import { Village } from '../world/Village';
import { loadTextures, type TextureSet } from '../world/Textures';
import { SUN } from '../world/Layout';

export interface Quality {
  name: 'low' | 'medium' | 'high';
  pixelRatio: number;
  shadowSize: number;
  nearSpacing: number;
  farSegments: number;
  grassCount: number;
  grassPatch: number;
  treeScale: number;
  shrubs: number;
  farTrees: number;
  rocks: number;
  msaa: number;
  bloom: boolean;
  godRaySamples: number;
  motes: number;
}

export function detectQuality(): Quality {
  const params = new URLSearchParams(location.search);
  const forced = params.get('q');
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820);
  const name = (forced === 'low' || forced === 'medium' || forced === 'high' ? forced : mobile ? 'low' : 'high') as Quality['name'];
  const dpr = window.devicePixelRatio || 1;
  if (name === 'low')
    return { name, pixelRatio: Math.min(dpr, 1.25), shadowSize: 1024, nearSpacing: 2.6, farSegments: 180, grassCount: 11000, grassPatch: 32, treeScale: 0.55, shrubs: 1200, farTrees: 3000, rocks: 1200, msaa: 0, bloom: true, godRaySamples: 16, motes: 250 };
  if (name === 'medium')
    return { name, pixelRatio: Math.min(dpr, 1.5), shadowSize: 2048, nearSpacing: 2.0, farSegments: 240, grassCount: 28000, grassPatch: 44, treeScale: 0.8, shrubs: 2600, farTrees: 6000, rocks: 2400, msaa: 2, bloom: true, godRaySamples: 28, motes: 450 };
  return { name, pixelRatio: Math.min(dpr, 2), shadowSize: 4096, nearSpacing: 1.6, farSegments: 300, grassCount: 46000, grassPatch: 54, treeScale: 1, shrubs: 4200, farTrees: 9000, rocks: 3600, msaa: 4, bloom: true, godRaySamples: 40, motes: 700 };
}

/** Owns renderer, scene, camera, the whole environment and the post-processing stack. */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly colliders = new Colliders();
  readonly quality: Quality;
  tex!: TextureSet;
  terrain!: Terrain;
  sky!: SkySystem;
  post!: PostFX;
  vegetation!: Vegetation;
  rocks!: Rocks;
  grass!: Grass;
  village!: Village;
  particles!: ParticleSystem;
  motes!: Motes;
  smoke!: SmokeColumns;
  readonly dynamic = new THREE.Group(); // things simulated in world space (sling, projectiles, fx)
  focus = new THREE.Vector3();
  timeScale = 1;

  constructor(container: HTMLElement) {
    this.quality = detectQuality();
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.58;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 26000);
    this.scene.add(this.dynamic);
  }

  async build(progress: (f: number, label: string) => void) {
    const q = this.quality;
    const step = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    progress(0.02, 'טוען מרקמים…');
    this.tex = await loadTextures(this.renderer, (f) => progress(0.02 + f * 0.2, 'טוען מרקמים…'));
    progress(0.25, 'מעצב את הרי יהודה…');
    await step();
    this.terrain = new Terrain({ nearSpacing: q.nearSpacing, farSegments: q.farSegments });
    progress(0.45, 'מדליק את השמש…');
    await step();
    this.sky = new SkySystem(this.renderer, q.shadowSize);
    this.scene.add(this.sky.group);
    this.sky.setSun(SUN.elevation, SUN.azimuth, this.scene);
    this.terrain.build(this.tex, shared.uSunDir.value);
    this.scene.add(this.terrain.group);
    progress(0.6, 'בונה את בית לחם…');
    await step();
    this.village = new Village(this.terrain, this.tex, this.colliders);
    this.village.build();
    this.scene.add(this.village.group);
    progress(0.7, 'נוטע עצי זית…');
    await step();
    this.rocks = new Rocks(this.terrain, this.tex, this.colliders, q.rocks);
    this.rocks.build();
    this.scene.add(this.rocks.group);
    this.vegetation = new Vegetation(this.terrain, this.tex, this.colliders, { treeScale: q.treeScale, shrubs: q.shrubs, farTrees: q.farTrees });
    this.vegetation.build();
    this.scene.add(this.vegetation.group);
    progress(0.82, 'מגדל עשב…');
    await step();
    this.grass = new Grass(this.terrain, q.grassCount, q.grassPatch);
    this.scene.add(this.grass.mesh);
    this.particles = new ParticleSystem(1800);
    this.scene.add(this.particles.points);
    this.motes = new Motes(q.motes);
    this.scene.add(this.motes.points);
    this.smoke = new SmokeColumns(this.particles, this.village.smokeSources);
    this.post = new PostFX(this.renderer, this.scene, this.camera, this.sky.cubeTarget.texture, {
      msaa: q.msaa, bloom: q.bloom, godRaySamples: q.godRaySamples, pixelRatio: q.pixelRatio,
    });
    this.resize();
    addEventListener('resize', () => this.resize());
    progress(0.95, 'מכין את הצאן…');
    await step();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.post?.setSize(Math.floor(w * pr), Math.floor(h * pr));
    this.particles?.setPixelScale(h * pr, this.camera.fov);
    this.motes?.setPixelScale(h * pr, this.camera.fov);
  }

  setFov(fov: number) {
    if (Math.abs(this.camera.fov - fov) < 0.01) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.particles.setPixelScale(innerHeight * pr, fov);
    this.motes.setPixelScale(innerHeight * pr, fov);
  }

  /** Advance time-based environment state without rendering (used by tests). */
  tickEnvironment(gdt: number) {
    shared.uTime.value += gdt;
    shared.uCamPos.value.copy(this.camera.position);
    this.particles.update(gdt);
    this.smoke.update(gdt);
  }

  /** Per-frame environment update + render. dt is real (unscaled) seconds. */
  render(dt: number, gdt: number) {
    shared.uTime.value += gdt;
    shared.uCamPos.value.copy(this.camera.position);
    this.sky.update(this.camera, this.focus);
    this.particles.update(gdt);
    this.smoke.update(gdt);
    this.post.render(dt);
  }
}
