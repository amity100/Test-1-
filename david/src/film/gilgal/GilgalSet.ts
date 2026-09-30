import * as THREE from 'three';
import { shared } from '../../core/Shared';
import { PostFX, type PostQuality } from '../../fx/PostFX';
import { SkySystem } from '../../world/Sky';
import { loadTextures, type TextureSet } from '../../world/Textures';
import { armyAt, armySlot, samuelAt, saulAt, SHOT_DURATION, SHOT_ORDER, timeScale, MARCH_SPEED, type ActorState, type ArmyState, type GilgalShotName } from './gilgalBlocking';
import { buildFlora, type Flora, type PalmTextures } from './gilgalFlora';
import { CloudDeck, DustWall, Motes } from './gilgalFx';
import { ARMY, roadZ, SAMUEL, SAMUEL_EXIT, SAUL_FACE, SAUL_HALT, STONES, SUN, TEAR } from './gilgalLayout';
import { buildPlaceholders, buildStones, type Placeholders } from './gilgalProps';
import { buildGilgalShots, type GilgalShots } from './gilgalShots';
import { deadSea, GilgalGround, jordanRiver, loadMask, terrainGeometry, terrainMaterial, DEAD_SEA_Y, ORIGIN_ASL, type GilgalTier } from './gilgalTerrain';
import frondUrl from '../../assets/gilgal/palm_frond.webp?url';
import trunkUrl from '../../assets/gilgal/palm_trunk.webp?url';
import trunkNUrl from '../../assets/gilgal/palm_trunk_n.webp?url';

export { SUN, STONES, SAMUEL, SAUL_FACE, SAUL_HALT, TEAR, ARMY, roadZ } from './gilgalLayout';
export { armyAt, armySlot, samuelAt, saulAt, timeScale, SHOT_ORDER, SHOT_DURATION, SCRIPT_SHOT, MARCH_SPEED, SLOWMO } from './gilgalBlocking';
export type { ActorState, ArmyState, GilgalShotName } from './gilgalBlocking';
export type { GilgalShots, GilgalShotInfo } from './gilgalShots';
export { CloudDeck } from './gilgalFx';

/** a place for a character: feet position on the ground and facing (forward = (sin yaw, 0, cos yaw)) */
export interface Mark { pos: THREE.Vector3; yaw: number; role: string }

export interface GilgalAnchors {
  /** Saul's march along the road (shots 6-7): from the dust to the halt, feet on the ground; speed MARCH_SPEED m/s */
  saulMarch: { path: THREE.Vector3[]; halt: Mark; speed: number };
  /** the face-off / tearing marks (shots 10-12) */
  saulFace: Mark;
  samuel: Mark;
  /** Samuel's way out east along the road after the verdict */
  samuelExit: THREE.Vector3[];
  /** the clean, backlit close-up zone of the tearing and the verdict: centre at hand height; `toSun` = light direction */
  tear: { center: THREE.Vector3; toSun: THREE.Vector3; radius: number };
  /** the twelve stones (Josh 4:20) */
  stones: { center: THREE.Vector3; radius: number; tops: THREE.Vector3[] };
  /**
   * the army on foot: a column along the road behind the king. `slot(file, rank, frontX, part)` gives a soldier's feet
   * (see armySlot); `volume` is the box the column fills at the halt (world axis-aligned; the part hidden in the dust
   * reaches `depth` m back), `road` the centre line from the wilderness ascent to the site.
   */
  army: {
    files: number; ranksVisible: number; fileSpacing: number; rankSpacing: number; leadGap: number; depth: number;
    volume: THREE.Box3; road: THREE.Vector3[];
    slot: typeof armySlot;
  };
}

export interface GilgalSetOptions {
  renderer: THREE.WebGLRenderer;
  quality: { name: 'low' | 'medium' | 'high'; shadowSize?: number; texMax?: number; anisotropy?: number };
  /** engine.tex to share the world textures (loaded on demand otherwise) */
  tex?: TextureSet;
  onProgress?: (f: number, label: string) => void;
}

/**
 * GILGAL (הַגִּלְגָּל) - the film set of ACT I and the transition of the opening film (shots 6-13 of
 * docs/intro-script.md): Saul returns from the war with Amalek and Samuel meets him (1 Sam 15:12-13, 15:27-28).
 * The lower Jordan valley "at the eastern edge of Jericho" (Josh 4:19) from real terrain data, date palms (Deut 34:3),
 * the Jordan's thicket, the marl badlands, the mountains of Moab and the Judean escarpment, the Dead Sea in the south,
 * the twelve stones (Josh 4:20), the road, the dust of the army, a cloud deck for the rise.
 *
 * Use (see gilgalView() for engine.setView):
 *   const gilgal = await GilgalSet.create({ renderer, quality: engine.quality, tex: engine.tex });
 *   each frame: gilgal.setBeat(shotName, shotTime); gilgal.update(dt, camera); ... render with the view / post
 *   gilgal.dispose() after the film.
 */
export class GilgalSet {
  readonly scene = new THREE.Scene();
  readonly sky: SkySystem;
  readonly tier: GilgalTier;
  readonly ground: GilgalGround;
  readonly anchors: GilgalAnchors;
  readonly shots: GilgalShots;
  readonly placeholders: Placeholders;
  readonly flora: Flora;
  readonly clouds: CloudDeck;
  readonly dust: DustWall;
  readonly motes: Motes;
  /** recommended renderer.toneMappingExposure (base x the current shot's exposure hint) */
  exposure = 0.62;
  static BASE_EXPOSURE = 0.62;
  static ATMOSPHERE = { density: 0.00011, heightFalloff: 0.0011, baseHeight: -140, godRays: 0.32, hazeTint: new THREE.Color(1.0, 0.93, 0.84) };
  /** the beat set by setBeat (null = free camera: no shot-driven state) */
  beat: { name: GilgalShotName; time: number } | null = null;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly ownsWorld: TextureSet | null;
  private readonly ownTex: THREE.Texture[];
  private readonly setSun = { dir: new THREE.Vector3(), color: new THREE.Color() };
  private readonly gameSun = { dir: new THREE.Vector3(), color: new THREE.Color() };
  private readonly focus = new THREE.Vector3();
  private shadowHalf = 0;
  private placeholdersOn = false;

  static async create(opts: GilgalSetOptions): Promise<GilgalSet> {
    const q = opts.quality;
    const prog = opts.onProgress ?? (() => {});
    prog(0.02, 'הַגִּלְגָּל');
    const world = opts.tex ?? (await loadTextures(opts.renderer, (f) => prog(0.02 + f * 0.4, 'הַגִּלְגָּל'), q));
    const loader = new THREE.TextureLoader();
    const aniso = Math.min(q.anisotropy ?? 8, opts.renderer.capabilities.getMaxAnisotropy());
    const tex = (url: string, srgb: boolean, name: string) => loader.loadAsync(url).then((t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = aniso;
      t.name = 'gilgal.' + name;
      return t;
    });
    const [ground, mask, frond, trunk, trunkN] = await Promise.all([GilgalGround.load(), loadMask(opts.renderer), tex(frondUrl, true, 'frond'), tex(trunkUrl, true, 'trunk'), tex(trunkNUrl, false, 'trunkN')]);
    frond.wrapS = frond.wrapT = THREE.ClampToEdgeWrapping;
    prog(0.6, 'הַגִּלְגָּל');
    const set = new GilgalSet(opts, world, ground, mask, { frond, trunk, trunkN }, !opts.tex);
    prog(1, 'הַגִּלְגָּל');
    return set;
  }

  private constructor(opts: GilgalSetOptions, world: TextureSet, ground: GilgalGround, mask: THREE.Texture, ptex: PalmTextures, ownsWorld: boolean) {
    const q = opts.quality;
    this.renderer = opts.renderer;
    this.tier = q.name;
    this.ground = ground;
    this.ownsWorld = ownsWorld ? world : null;
    this.ownTex = [mask, ptex.frond, ptex.trunk, ptex.trunkN];
    const scene = this.scene;
    scene.name = 'gilgal';
    // ---------------------------------------------------------------- sky and sun: late afternoon, low in the west
    this.gameSun.dir.copy(shared.uSunDir.value);
    this.gameSun.color.copy(shared.uSunColor.value);
    this.sky = new SkySystem(this.renderer, q.shadowSize ?? (this.tier === 'low' ? 1024 : this.tier === 'medium' ? 2048 : 4096));
    scene.add(this.sky.group);
    // fewer dome clouds: the real cloud deck carries the sky's clouds
    const cu = (this.sky.clouds.material as THREE.ShaderMaterial).uniforms;
    cu.uCoverage.value = 0.66;
    this.sky.setSun(SUN.elevation, SUN.azimuth, scene);
    this.sky.sun.shadow.bias = -0.0003;
    this.sky.sun.shadow.normalBias = 0.03;
    this.setSun.dir.copy(shared.uSunDir.value);
    this.setSun.color.copy(shared.uSunColor.value);
    // ---------------------------------------------------------------- land
    const terrain = new THREE.Mesh(terrainGeometry(ground, this.tier), terrainMaterial(world, mask));
    terrain.name = 'gilgal:terrain';
    terrain.receiveShadow = true;
    scene.add(terrain);
    scene.add(deadSea(), jordanRiver(ground));
    this.flora = buildFlora(ground, ptex, world, this.tier);
    scene.add(this.flora.group);
    const stones = buildStones(ground, world);
    scene.add(stones.group);
    // ---------------------------------------------------------------- air: dust, motes, clouds
    this.dust = new DustWall(this.tier);
    this.motes = new Motes(this.tier);
    this.clouds = new CloudDeck(this.tier);
    scene.add(this.dust.mesh, this.motes.points, this.clouds.group);
    // ---------------------------------------------------------------- stand-ins
    this.placeholders = buildPlaceholders(ground, this.tier);
    this.placeholders.group.visible = false;
    scene.add(this.placeholders.group);
    // ---------------------------------------------------------------- anchors
    const gy = (v: THREE.Vector3) => v.clone().setY(ground.height(v.x, v.z));
    const road: THREE.Vector3[] = [];
    for (let x = -900; x <= 300; x += 20) road.push(new THREE.Vector3(x, ground.height(x, roadZ(x)), roadZ(x)));
    const march: THREE.Vector3[] = [];
    for (let x = -175; x <= SAUL_HALT.x + 0.01; x += 5) march.push(new THREE.Vector3(x, ground.height(x, roadZ(x)), roadZ(x)));
    const vol = new THREE.Box3();
    for (const [f, r] of [[0, 0], [ARMY.files - 1, 0], [0, ARMY.ranks], [ARMY.files - 1, ARMY.ranks]]) vol.expandByPoint(armySlot(f, r, SAUL_HALT.x, 0, 0));
    vol.min.x = SAUL_HALT.x - ARMY.depth;
    vol.min.y = ground.height(SAUL_HALT.x, 0) - 3;
    vol.max.y = vol.min.y + 8;
    const sunEl = THREE.MathUtils.degToRad(SUN.elevation), sunAz = THREE.MathUtils.degToRad(SUN.azimuth);
    this.anchors = {
      saulMarch: { path: march, halt: { pos: gy(SAUL_HALT), yaw: Math.PI / 2, role: 'Saul: the halt, the spear raised (shot 8)' }, speed: MARCH_SPEED },
      saulFace: { pos: gy(SAUL_FACE.pos), yaw: SAUL_FACE.yaw, role: 'Saul: face-off and tearing (shots 10-12)' },
      samuel: { pos: gy(SAMUEL.pos), yaw: SAMUEL.yaw, role: 'Samuel in the road, facing the army' },
      samuelExit: SAMUEL_EXIT.map(gy),
      tear: { center: TEAR.clone().setY(ground.height(TEAR.x, TEAR.z) + TEAR.y), toSun: new THREE.Vector3(Math.sin(sunAz) * Math.cos(sunEl), Math.sin(sunEl), Math.cos(sunAz) * Math.cos(sunEl)), radius: 4 },
      stones: { center: gy(STONES.center), radius: STONES.radius, tops: stones.tops },
      army: { files: ARMY.files, ranksVisible: ARMY.ranks, fileSpacing: ARMY.fileSpacing, rankSpacing: ARMY.rankSpacing, leadGap: ARMY.leadGap, depth: ARMY.depth, volume: vol, road, slot: armySlot },
    };
    this.shots = buildGilgalShots(ground);
    for (const g of [this.flora.group, stones.group]) g.updateMatrixWorld(true);
    this.setBeat('dustWall', 0);
  }

  /** ground height of the set at (x, z) (feet placement) */
  height(x: number, z: number) {
    return this.ground.height(x, z);
  }

  /**
   * Drive the shot-dependent state for shot `name` at shot time `time` (s): stand-ins (if shown), the dust wall
   * (following the army, settling after the halt), the motes, sun-shadow framing and the exposure hint.
   */
  setBeat(name: GilgalShotName, time: number) {
    this.beat = { name, time };
    const army = armyAt(name, time);
    const saul = saulAt(name, time);
    const samuel = samuelAt(name, time);
    if (this.placeholdersOn) this.placeholders.pose(saul, samuel, army, shared.uTime.value);
    const du = this.dust.uniforms;
    du.uFrontX.value = army.frontX;
    const idx = SHOT_ORDER.indexOf(name);
    du.uSettle.value = idx < 2 ? 0 : Math.min(0.6, 0.12 * (idx - 1) + time * 0.01);
    du.uOpacity.value = idx < 3 ? 1 : 0.75;
    const mu = this.motes.uniforms;
    const close = name === 'faceOff' || name === 'tear' || name === 'verdict' || name === 'saulAlone';
    mu.uAmount.value = close ? 1 : name === 'king' ? 0.8 : 0;
    if (name === 'king') mu.uCenter.value.copy(saul.pos).setY(this.ground.height(saul.pos.x, saul.pos.z) - 0.3).add(new THREE.Vector3(3.5, 0, 0));
    else mu.uCenter.value.copy(this.anchors.tear.center).setY(this.anchors.tear.center.y - 1.2);
    // sun shadow framing per shot
    let half = 50;
    switch (name) {
      case 'dustWall': this.focus.set(army.frontX - 12, 0, 0); half = 55; break;
      case 'king': this.focus.copy(saul.pos).add(new THREE.Vector3(-2, 0, 0)); half = 22; break;
      case 'spearRaised': this.focus.set(SAUL_HALT.x - 16, 0, 0); half = 40; break;
      case 'silence': this.focus.set(-12, 0, 0); half = 42; break;
      case 'rise': this.focus.copy(this.anchors.tear.center); half = 60; break;
      default: this.focus.copy(this.anchors.tear.center); half = 11;
    }
    this.focus.y = this.ground.height(this.focus.x, this.focus.z);
    if (half !== this.shadowHalf) {
      this.shadowHalf = half;
      const sc = this.sky.sun.shadow.camera;
      sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
      sc.updateProjectionMatrix();
    }
    this.exposure = GilgalSet.BASE_EXPOSURE * this.shots[name].exposure;
  }

  /** Per frame (before rendering): sun uniforms, sky dome / shadow frame, cloud deck, point sprite scale. */
  update(dt: number, camera: THREE.PerspectiveCamera, opts: { advanceTime?: boolean } = {}) {
    if (opts.advanceTime) shared.uTime.value += dt;
    shared.uSunDir.value.copy(this.setSun.dir);
    shared.uSunColor.value.copy(this.setSun.color);
    if (!this.beat) this.focus.copy(camera.position).setY(this.ground.height(camera.position.x, camera.position.z));
    this.sky.update(camera, this.focus);
    this.clouds.update(camera);
    const size = this.renderer.getDrawingBufferSize(tmpV2);
    this.motes.uniforms.uPx.value = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }

  /** the slow-motion factor of the action at the current beat (actors' animation clocks: dt * timeScale) */
  get timeScale() {
    return this.beat ? timeScale(this.beat.name, this.beat.time) : 1;
  }

  applyExposure(renderer: THREE.WebGLRenderer = this.renderer) {
    renderer.toneMappingExposure = this.exposure;
  }

  /** Put the game's sun back into the shared uniforms (after the Gilgal beats, before the world renders again). */
  restoreSharedSun() {
    shared.uSunDir.value.copy(this.gameSun.dir);
    shared.uSunColor.value.copy(this.gameSun.color);
  }

  createPost(camera: THREE.PerspectiveCamera, q: PostQuality) {
    const post = new PostFX(this.renderer, this.scene, camera, this.sky.cubeTarget.texture, q);
    this.configurePost(post);
    return post;
  }

  /** hot, dusty air of the rift: denser low haze with a long scale height, strong god rays through the dust */
  configurePost(post: PostFX) {
    const a = post.atmosphere.uniforms, A = GilgalSet.ATMOSPHERE;
    a.uDensity.value = A.density;
    a.uHeightFalloff.value = A.heightFalloff;
    a.uBaseHeight.value = A.baseHeight;
    a.uGodRays.value = A.godRays;
    (a.uHazeTint.value as THREE.Color).copy(A.hazeTint);
  }

  showPlaceholders(on: boolean) {
    this.placeholdersOn = on;
    this.placeholders.group.visible = on;
    if (on && this.beat) this.setBeat(this.beat.name, this.beat.time);
  }

  stats() {
    let meshes = 0, instances = 0, triangles = 0;
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !o.visible) return;
      meshes++;
      const g = m.geometry;
      const n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      const inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : (g as THREE.InstancedBufferGeometry).isInstancedBufferGeometry ? (g as THREE.InstancedBufferGeometry).instanceCount : 1;
      instances += inst;
      triangles += n * inst;
    });
    return { drawCalls: this.renderer.info.render.calls, triangles: Math.round(triangles), meshes, instances, flora: this.flora.stats, soldiers: this.placeholders.soldiers, deadSeaY: DEAD_SEA_Y, originASL: ORIGIN_ASL };
  }

  dispose() {
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) geos.add(m.geometry);
      const mm = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mm)) mm.forEach((x) => mats.add(x));
      else if (mm) mats.add(mm);
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    for (const t of this.ownTex) t.dispose();
    if (this.ownsWorld) for (const t of Object.values(this.ownsWorld)) (t as THREE.Texture).dispose();
    this.sky.cubeTarget.dispose();
    this.sky.lut.dispose();
    (this.scene.environment as THREE.Texture | null)?.dispose();
    this.sky.sun.shadow.map?.dispose();
    this.scene.clear();
  }
}

const tmpV2 = new THREE.Vector2();
export { SAMUEL_EXIT };
export type { ActorState as GilgalActorState, ArmyState as GilgalArmyState };
