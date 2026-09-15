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
import { settings, type Quality } from './Settings';
import { setLang, t } from './i18n';
import { Mat, encodeBlock } from '../world/Voxel';
import { clamp } from './MathUtil';
import { Game } from './Game';
import { buildDecor } from '../world/Decor';
import { perf } from './Perf';

const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

/**
 * The only three sizes the picture is ever rendered at. Every step in between was a rebuild of
 * every render target for a sharpness nobody could see, and the black frame that came with it.
 */
const RES_STEPS = [1, 0.92, 0.85];

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
  private frameNo = 0;
  private rawDt = 1 / 60;
  /** Quality tier pinned by a ?debug= flag (tests and screenshots), overriding the settings. */
  forcedQuality: Quality | null = null;

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
    for (const q of ['low', 'medium', 'high', 'ultra'] as const) if (this.gr.flags.has(q)) quality = this.forcedQuality = q;
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
    this.gr.mobileSafe = settings.mobileSafe || flags.has('mobile');
    this.gr.setQuality(quality);
    this.sky.setShadowMapSize(this.gr.profile.shadowMap);
    this.sky.setShadowRadius(this.gr.profile.shadowRadius);
    this.sky.setSun(26, 140);
    // Applied at once, never deferred: the camera has to match the window before anything is aimed
    // through it or drawn into it.
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
    if (flags.has('info')) this.showDiagnostics();
    perf.on = flags.has('perf');
  }

  /** ?debug=info: GPU, tier and capability readout in the corner, refreshed once a second. */
  private showDiagnostics(): void {
    const pre = document.createElement('pre');
    pre.style.cssText = 'position:fixed;left:6px;top:6px;z-index:9999;margin:0;padding:6px 8px;font:11px/1.35 monospace;color:#dff;background:rgba(0,0,0,.65);border-radius:6px;pointer-events:none;white-space:pre-wrap;max-width:60vw;direction:ltr;text-align:left';
    document.body.appendChild(pre);
    const refresh = (): void => {
      pre.textContent = `${this.gr.diagnostics()}\nfps: ${this.fps.toFixed(0)}  ua: ${navigator.userAgent.slice(0, 90)}`;
    };
    refresh();
    setInterval(refresh, 1000);
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
    const raw = (now - this.last) / 1000;
    // A long frame is caught up in two steps rather than being thrown away: below twenty frames a
    // second the old single clamped step quietly ran the whole game in slow motion.
    const dt = Math.min(0.1, raw);
    this.last = now;
    this.time += dt;
    this.rawDt = raw;
    this.update(dt);
    requestAnimationFrame(this.loop);
  };

  /**
   * Holds the frame rate with two dials, in this order: first a little sharpness, and only once
   * that is spent, a quality tier. The judge is the typical frame, not the average: one hitch (a
   * remesh, a tab switch) must not cost anything, and on a 60 Hz screen the rate can never exceed
   * sixty, so recovery is earned by a steady run of full-speed frames rather than by a rate the
   * display would never report.
   */
  private tuneQuality(): void {
    if (this.gr.flags.has('noadapt') || this.freeFly) return;
    // Ignore the odd long frame: sort a short window and read the frame at the 70th percentile.
    if (this.rawDt < 0.5) this.frameWindow.push(this.rawDt);
    this.resTimer -= this.rawDt;
    this.sinceChange += this.rawDt;
    if (this.resTimer > 0 || this.frameWindow.length < 12) return;
    this.resTimer = 0.6;
    const sorted = this.frameWindow.slice().sort((a, b) => a - b);
    const typical = sorted[Math.floor(sorted.length * 0.7)];
    const best = sorted[Math.floor(sorted.length * 0.25)];
    this.frameWindow.length = 0;
    const mobile = settings.mobileSafe || this.gr.mobileSafe;
    const wantMs = 1000 / (mobile ? 50 : 52);
    // Every change of size throws away the render targets and costs a frame, so nothing moves
    // twice in a row without a couple of seconds in between.
    const settled = this.sinceChange >= 2.5;
    if (typical * 1000 > wantMs) {
      this.steadyFor = 0;
      this.slowFor += 0.6;
      if (!settled) return;
      if (this.resStep < RES_STEPS.length - 1) this.setResStep(this.resStep + 1);
      // The smallest picture we are willing to render, and still short of the rate: the card is
      // simply above its tier.
      else if (this.slowFor >= 3) this.stepQualityDown();
    } else if (best * 1000 < 1000 / 59 + 0.3) {
      // Running at the display's own rate for a couple of seconds: try a step back up.
      this.slowFor = 0;
      this.steadyFor += 0.6;
      if (this.steadyFor >= 2 && this.resStep > 0 && settled) {
        this.setResStep(this.resStep - 1);
        this.steadyFor = 0;
      }
    } else {
      this.steadyFor = 0;
      this.slowFor = 0;
    }
  }
  private resTimer = 1.5;
  private frameWindow: number[] = [];
  private steadyFor = 0;
  private slowFor = 0;
  private sinceChange = 0;
  private resStep = 0;

  private setResStep(i: number): void {
    const next = clamp(i, 0, RES_STEPS.length - 1);
    if (next === this.resStep) return;
    this.resStep = next;
    this.gr.setResolutionScale(RES_STEPS[next]);
    this.sinceChange = 0;
  }

  /**
   * Drops one quality tier: god rays go first, then the screen-space occlusion and the soft
   * shadows. Only ever downward, and never when a tier was chosen by hand — a picked tier is a
   * decision, not a guess. The sharpness comes back with it, because the cheaper picture can
   * afford it.
   */
  private stepQualityDown(): void {
    if (this.forcedQuality || settings.data.quality !== 'auto') return;
    const order: Quality[] = ['ultra', 'high', 'medium', 'low'];
    const next = order[order.indexOf(this.gr.quality) + 1];
    if (!next) return;
    this.gr.setQuality(next);
    this.sky.setShadowMapSize(this.gr.profile.shadowMap);
    this.sky.setShadowRadius(this.gr.profile.shadowRadius);
    this.resStep = 0;
    this.gr.setResolutionScale(RES_STEPS[0]);
    this.sinceChange = 0;
    this.slowFor = 0;
  }

  private update(dt: number): void {
    const input = this.input;
    let focus: THREE.Vector3 = this.gr.camera.position;
    if (!this.freeFly) {
      const tg = perf.now();
      // Never integrate more than a twentieth of a second at once, or a body can pass through a wall.
      const steps = dt > 0.05 ? 2 : 1;
      for (let i = 0; i < steps; i++) focus = this.game.update(dt / steps);
      perf.add('game', tg);
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
    const tsky = perf.now();
    this.sky.update(dt, this.time, focus);
    this.gr.fog.setSun(this.sky.sunDir, this.sky.sun.color.clone().multiplyScalar(1.05));
    this.water.update(this.time);
    this.foliage.update(this.time);
    perf.add('sky', tsky);
    const tch = perf.now();
    // Remesh what changed, nearest the camera first, inside a budget that shrinks when frames are long.
    this.chunks.focus.copy(this.gr.camera.position);
    this.chunks.update(this.fps > 0 && this.fps < 50 ? 2.5 : 4);
    perf.add('chunks', tch);
    // When the device cannot hold 50 fps the shadow map refreshes every other frame: at that rate
    // the half-frame lag of a moving shadow is invisible and its render cost halves.
    this.frameNo++;
    const sm = this.gr.renderer.shadowMap;
    if (this.fps > 0 && this.fps < 50 && !this.gr.flags.has('noadapt')) {
      sm.autoUpdate = false;
      sm.needsUpdate = (this.frameNo & 1) === 0;
    } else if (!sm.autoUpdate) sm.autoUpdate = true;
    // Judged, and any change of size made, before the picture is drawn: a canvas resized after the
    // frame is composited once with nothing in it, which is the black flicker.
    this.tuneQuality();
    const tr = perf.now();
    this.gr.render(dt);
    perf.add('submit', tr);
    input.endFrame();
    if (perf.on) {
      const ri = this.gr.renderer.info.render;
      const size = this.gr.renderer.getDrawingBufferSize(new THREE.Vector2());
      perf.addMs('frame', this.rawDt * 1000);
      perf.tick(this.rawDt, () => `${this.gr.quality}  ${size.x}x${size.y}  calls ${ri.calls}  tris ${(ri.triangles / 1000).toFixed(0)}k`);
    }
    // Frame rate from real frame times (the simulation step is clamped, the counter must not be).
    this.fpsAcc += Math.min(1, this.rawDt);
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
