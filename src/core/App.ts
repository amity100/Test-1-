import * as THREE from 'three';
import { GameRenderer } from '../render/Renderer';
import { SkySystem } from '../render/Sky';
import { Terrain } from '../world/Terrain';
import { WaterSurface } from '../render/Water';
import { Foliage } from '../render/Foliage';
import { VoxelWorld } from '../world/VoxelWorld';
import { ChunkRenderer } from '../render/ChunkRenderer';
import { generateVoxelTextures } from '../render/Textures';
import { createVoxelMaterials, type VoxelMaterials } from '../render/VoxelMaterial';
import { makePlots, PLOT_Y, type Plot } from '../world/Layout';
import { Random } from './Random';
import { Input } from './Input';
import { settings } from './Settings';
import { setLang, t } from './i18n';
import { Mat, encodeBlock } from '../world/Voxel';
import { clamp } from './MathUtil';
import { Game } from './Game';
import { buildDecor } from '../world/Decor';

const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

/** Application root: owns rendering, world and the main loop. */
export class App {
  gr!: GameRenderer;
  input!: Input;
  sky!: SkySystem;
  terrain!: Terrain;
  water!: WaterSurface;
  foliage!: Foliage;
  world = new VoxelWorld();
  chunks!: ChunkRenderer;
  materials!: VoxelMaterials;
  plots: Plot[] = [];
  time = 0;
  ready = false;
  private last = 0;
  private camYaw = 0;
  private camPitch = -0.2;
  camPos = new THREE.Vector3(0, 40, 120);
  freeFly = false;
  game!: Game;
  fps = 0;
  private fpsAcc = 0;
  private fpsN = 0;

  constructor(readonly canvas: HTMLCanvasElement) {}

  private setLoading(pct: number, status: string): void {
    const fill = document.getElementById('loading-fill');
    const st = document.getElementById('loading-status');
    if (fill) fill.style.width = `${Math.round(pct * 100)}%`;
    if (st) st.textContent = status;
  }

  async init(): Promise<void> {
    settings.load();
    setLang(settings.data.language);
    this.setLoading(0.05, t('loading'));
    await nextFrame();
    this.gr = new GameRenderer(this.canvas);
    this.input = new Input(this.canvas);
    let quality = settings.resolveQuality(this.gr.gpuName);
    for (const q of ['low', 'medium', 'high', 'ultra'] as const) if (this.gr.flags.has(q)) quality = q;
    const scene = this.gr.scene;
    this.sky = new SkySystem(this.gr.renderer, scene);
    const flags = this.gr.flags;
    if (flags.has('noenv')) {
      this.sky.envEnabled = false;
      scene.environment = null;
    }
    if (flags.has('noshadow')) {
      this.gr.renderer.shadowMap.enabled = false;
      this.sky.sun.castShadow = false;
    }
    if (flags.has('nosky')) {
      this.sky.sky.visible = false;
      this.sky.clouds.visible = false;
      scene.background = new THREE.Color(0x87b7e8);
    }
    if (flags.has('nohemi')) this.sky.hemi.visible = false;
    if (flags.has('nosun')) this.sky.sun.visible = false;
    this.gr.attachSky(this.sky);
    this.gr.setQuality(quality);
    this.sky.setShadowMapSize(this.gr.profile.shadowMap);
    this.sky.setShadowRadius(this.gr.profile.shadowRadius);
    this.sky.setSun(26, 140);
    window.addEventListener('resize', () => this.gr.resize());
    this.gr.resize();

    this.setLoading(0.15, t('loadingTextures'));
    await nextFrame();
    const textures = generateVoxelTextures(256, 7);
    const maxAniso = this.gr.renderer.capabilities.getMaxAnisotropy();
    for (const tex of [textures.albedo, textures.normal, textures.orm]) tex.anisotropy = Math.min(this.gr.profile.anisotropy, maxAniso);
    this.materials = createVoxelMaterials(textures);

    this.setLoading(0.45, t('loadingWorld'));
    await nextFrame();
    this.plots = makePlots(8);
    this.terrain = new Terrain(this.plots, 11);
    scene.add(this.terrain.buildMesh());
    this.water = new WaterSurface(this.terrain);
    scene.add(this.water.mesh);

    this.setLoading(0.65, t('loadingFoliage'));
    await nextFrame();
    this.foliage = new Foliage(this.terrain, new Random(99));
    if (!this.gr.flags.has('nofoliage')) this.foliage.build(this.gr.profile);
    scene.add(this.foliage.group);

    this.setLoading(0.8, t('loadingWorld'));
    await nextFrame();
    this.chunks = new ChunkRenderer(this.world, this.materials);
    scene.add(this.chunks.group);
    this.placePlotFloors();
    buildDecor(this.world, this.terrain, this.plots, new Random(4242));
    this.chunks.flush();
    this.game = new Game(this);
    this.game.init();

    this.setLoading(1, t('ready'));
    await nextFrame();
    document.getElementById('loading')?.classList.add('hidden');
    this.ready = true;
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  private placePlotFloors(): void {
    const floorMats = [Mat.COBBLE, Mat.SMOOTH_STONE, Mat.MARBLE, Mat.STONE_BRICK, Mat.SANDSTONE, Mat.CONCRETE, Mat.METAL_PANEL, Mat.WOOD_PLANKS];
    const floorCols = [2, 41, 30, 21, 60, 31, 51, 6];
    for (const p of this.plots) {
      const v = encodeBlock(floorMats[p.index % floorMats.length], floorCols[p.index % floorCols.length]);
      for (let x = p.minX; x <= p.maxX; x++) for (let z = p.minZ; z <= p.maxZ; z++) this.world.set(x, PLOT_Y - 1, z, v);
    }
  }

  private fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v: number): void {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.world.set(x, y, z, v);
  }

  private loop = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.update(dt);
    requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    const input = this.input;
    let focus: THREE.Vector3 = this.gr.camera.position;
    if (!this.freeFly) {
      focus = this.game.update(dt);
    }
    if (this.freeFly) {
      if (input.buttonPressed(0) && !input.looking) input.requestPointerLock();
      if (input.looking) {
        const sens = 0.0022 * settings.data.sensitivity;
        this.camYaw -= input.mouseDX * sens;
        this.camPitch = clamp(this.camPitch - input.mouseDY * sens, -1.5, 1.5);
      }
      const speed = (input.isDown('ShiftLeft') ? 60 : 18) * dt;
      const fwd = new THREE.Vector3(-Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), -Math.cos(this.camYaw) * Math.cos(this.camPitch));
      const right = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
      this.camPos.addScaledVector(fwd, input.axisY() * speed);
      this.camPos.addScaledVector(right, input.axisX() * speed);
      if (input.isDown('KeyE') || input.isDown('Space')) this.camPos.y += speed;
      if (input.isDown('KeyQ') || input.isDown('ControlLeft')) this.camPos.y -= speed;
      this.gr.camera.position.copy(this.camPos);
      this.gr.camera.rotation.set(0, 0, 0);
      this.gr.camera.rotateY(this.camYaw);
      this.gr.camera.rotateX(this.camPitch);
    }
    this.gr.camera.updateMatrixWorld();
    this.sky.update(dt, this.time, focus);
    this.gr.fog.setSun(this.sky.sunDir, this.sky.sun.color.clone().multiplyScalar(1.05));
    this.water.update(this.time);
    this.foliage.update(this.time);
    this.chunks.update(6);
    this.gr.render(dt);
    input.endFrame();
    this.fpsAcc += dt;
    this.fpsN++;
    if (this.fpsAcc >= 0.5) {
      this.fps = this.fpsN / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
  }

  /** Debug helper used by smoke tests: positions the free camera. */
  debugView(name: string): void {
    this.freeFly = true;
    this.game.screens.hideAll();
    const p = this.plots[0];
    switch (name) {
      case 'overview':
        this.camPos.set(0, 120, 210);
        this.camYaw = 0;
        this.camPitch = -0.55;
        break;
      case 'plot0':
        this.camPos.set(p.cx + 26, PLOT_Y + 9, p.cz + 40);
        this.camYaw = Math.atan2(-(p.cx - this.camPos.x), -(p.cz - this.camPos.z)) ;
        this.camYaw = -Math.atan2(p.cx - this.camPos.x, -(p.cz - this.camPos.z));
        this.camPitch = -0.18;
        break;
      case 'ground':
        this.camPos.set(p.cx, PLOT_Y + 1.7, p.cz + 30);
        this.camYaw = Math.PI;
        this.camPitch = 0.05;
        break;
      case 'beach':
        this.camPos.set(60, 4, 150);
        this.camYaw = 0.6;
        this.camPitch = 0.02;
        break;
      case 'inside':
        this.camPos.set(p.cx, PLOT_Y + 1.7, p.cz + 12);
        this.camYaw = Math.PI;
        this.camPitch = 0.1;
        break;
    }
  }

  lookAt(target: THREE.Vector3): void {
    const d = target.clone().sub(this.camPos);
    this.camYaw = Math.atan2(-d.x, -d.z);
    this.camPitch = Math.atan2(d.y, Math.sqrt(d.x * d.x + d.z * d.z));
  }
}
