import * as THREE from 'three';
import { shared } from '../../core/Shared';
import { PostFX, type PostQuality } from '../../fx/PostFX';
import { SkySystem } from '../../world/Sky';
import { loadTextures, type TextureSet } from '../../world/Textures';
import { armyAt, armySlot, samuelAt, saulAt, SHOT_DURATION, SHOT_ORDER, timeScale, MARCH_SPEED, type ActorState, type ArmyState, type GilgalShotName } from './gilgalBlocking';
import { buildFlora, type Flora, type PalmTextures } from './gilgalFlora';
import { CloudDeck, CloudVeil, DustWall, Motes } from './gilgalFx';
import { buildCamp } from './gilgalCamp';
import type { Smoke } from '../../palace/palaceFx';
// the land teammate's raymarched cloud deck: the SAME clouds as the prologue / Bethlehem descent (shot 14)
import { LandClouds } from '../land/landClouds';
import { cloudShared, landAtmo } from '../land/landAtmo';
import { ARMY, roadZ, SAMUEL, SAMUEL_EXIT, SAUL_FACE, SAUL_HALT, STONES, SUN, TEAR } from './gilgalLayout';
import { buildPebbles, buildPlaceholders, buildStones, type Placeholders } from './gilgalProps';
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
  /** build the raymarched cloud deck of the old 'rise' (shot 13; default true). The film builds it only if a take
   *  still climbs into it (CUT v3: no) — it costs a 3D noise texture at load and a raymarch program. */
  deck?: boolean;
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
  /** 2.5D layered deck (fallback, not in the scene by default) */
  readonly clouds: CloudDeck;
  /** the raymarched deck shared with the land set (shown in shot 13); null when not built (GilgalSetOptions.deck) */
  readonly deck: LandClouds | null;
  /** the land set's shared cloud / haze uniforms as they were before this set took them over (restored on leave) */
  private landSnap: { sunDir: THREE.Vector3; sunCol: THREE.Color; sky: THREE.Texture | null; haze: THREE.Vector4; deck: THREE.Vector4; time: number } | null = null;
  /** deck of the rise in set metres: base, top (= 1850 / 2450 m ASL as in the land set), east edge x, coverage gain */
  static DECK = new THREE.Vector4(2116, 2716, -1500, 0.85);
  readonly dust: DustWall;
  readonly motes: Motes;
  readonly veil: CloudVeil;
  private readonly smoke: Smoke;
  private post: PostFX | null = null;
  /** recommended renderer.toneMappingExposure (base x the current shot's exposure hint) */
  exposure = 0.56;
  static BASE_EXPOSURE = 0.5;
  /** near plane of the view (close inserts at 0.5-1 m); update() raises it with the camera's height above the ground */
  static NEAR = 0.05;
  static ATMOSPHERE = { density: 0.00007, heightFalloff: 0.0011, baseHeight: -140, godRays: 0.22, hazeTint: new THREE.Color(1.0, 0.86, 0.7) };
  /** the beat set by setBeat (null = free camera: no shot-driven state) */
  beat: { name: GilgalShotName; time: number } | null = null;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly ownsWorld: TextureSet | null;
  private readonly ownTex: THREE.Texture[];
  private readonly setSun = { dir: new THREE.Vector3(), color: new THREE.Color() };
  private readonly gameSun = { dir: new THREE.Vector3(), color: new THREE.Color() };
  private readonly focus = new THREE.Vector3();
  /** cut4: the per-take light cheat (setSunCheat) — the sun's direction for the close set-ups, null = the set's sun */
  private cheatDir: THREE.Vector3 | null = null;
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
    const [ground, mask, relief, frond, trunk, trunkN] = await Promise.all([GilgalGround.load(), loadMask(opts.renderer), loadMask(opts.renderer, true), tex(frondUrl, true, 'frond'), tex(trunkUrl, true, 'trunk'), tex(trunkNUrl, false, 'trunkN')]);
    frond.wrapS = frond.wrapT = THREE.ClampToEdgeWrapping;
    prog(0.6, 'הַגִּלְגָּל');
    const set = new GilgalSet(opts, world, ground, mask, relief, { frond, trunk, trunkN }, !opts.tex);
    prog(1, 'הַגִּלְגָּל');
    return set;
  }

  private constructor(opts: GilgalSetOptions, world: TextureSet, ground: GilgalGround, mask: THREE.Texture, relief: THREE.Texture, ptex: PalmTextures, ownsWorld: boolean) {
    const q = opts.quality;
    this.renderer = opts.renderer;
    this.tier = q.name;
    this.ground = ground;
    this.ownsWorld = ownsWorld ? world : null;
    this.ownTex = [mask, relief, ptex.frond, ptex.trunk, ptex.trunkN];
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
    const terrain = new THREE.Mesh(terrainGeometry(ground, this.tier), terrainMaterial(world, mask, relief));
    terrain.name = 'gilgal:terrain';
    terrain.receiveShadow = true;
    scene.add(terrain);
    scene.add(deadSea(), jordanRiver(ground));
    this.flora = buildFlora(ground, ptex, world, this.tier);
    scene.add(this.flora.group);
    const stones = buildStones(ground, world);
    scene.add(stones.group, buildPebbles(ground, world, this.tier, () => true));
    const camp = buildCamp(ground, world, this.tier);
    scene.add(camp.group);
    this.smoke = camp.smoke;
    // ---------------------------------------------------------------- air: dust, motes, clouds
    this.dust = new DustWall(this.tier);
    this.motes = new Motes(this.tier);
    this.clouds = new CloudDeck(this.tier);
    this.veil = new CloudVeil();
    this.deck = opts.deck === false ? null : new LandClouds(this.tier, { x0: -48000, x1: 16000, z0: -30000, z1: 42000 });
    if (this.deck) {
      this.deck.mesh.visible = false;
      // the late-afternoon sun is far stronger than the land set's dawn sun: scale the deck's sun term down
      this.deck.uniforms.uSunI.value = 5.0;
      scene.add(this.deck.mesh);
    }
    scene.add(this.dust.mesh, this.motes.points, this.veil.mesh);
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
    for (const g of [this.flora.group, stones.group, camp.group]) g.updateMatrixWorld(true);
    // initial state = the start of shot 6; then free-camera mode until the film calls setBeat (shadow focus follows
    // the camera, base exposure)
    this.setBeat('dustWall', 0);
    this.beat = null;
    this.exposure = GilgalSet.BASE_EXPOSURE;
  }

  /**
   * Gilgal set metres -> the land set's frame (src/film/land/landData.ts: origin Bethlehem 31.7054 N 35.2024 E, +X east,
   * +Z south, y = metres above sea level). Same projection family as both bakers; error < 30 m over the region.
   * Use it to line up the hand-off of shot 13 -> 14 (the end pose of the rise, in the land set's coordinates).
   */
  static toLandFrame(v: THREE.Vector3, out = new THREE.Vector3()) {
    return out.set(25343.5 + 1.0017 * v.x, v.y + ORIGIN_ASL, -17315.9 + 0.99706 * v.z);
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
    mu.uAmount.value = close ? 1 : name === 'king' ? 0.35 : 0;
    if (name === 'king') mu.uCenter.value.copy(saul.pos).setY(this.ground.height(saul.pos.x, saul.pos.z) - 0.3).add(new THREE.Vector3(3.5, 0, 0));
    else mu.uCenter.value.copy(this.anchors.tear.center).setY(this.anchors.tear.center.y - 1.2);
    // sun shadow framing per shot
    let half = 50;
    switch (name) {
      case 'dustWall': this.focus.set(army.frontX - 12, 0, 0); half = 55; break;
      case 'king': this.focus.copy(saul.pos).add(new THREE.Vector3(-2, 0, 0)); half = 22; break;
      case 'spearRaised': this.focus.set(SAUL_HALT.x - 16, 0, 0); half = 40; break;
      // (cut7, CUT v5.2: the front rank, the king and the old man come up the road to him — a tighter, sharper box)
      case 'silence': this.focus.set(SAUL_HALT.x + 2, 0, 0.4); half = 24; break;
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
    // shot 13 ends inside the cloud deck: the hand-off to the land set's descent through the clouds (shot 14)
    this.veil.uniforms.uAmount.value = name === 'rise' ? 0.85 * THREE.MathUtils.smoothstep(time, 14.1, 15) : 0;
    if (this.deck) this.deck.mesh.visible = name === 'rise';
    this.dust.mesh.visible = name !== 'rise' || time < 2.2;
    if (name === 'rise') du.uOpacity.value = 0.75 * (1 - THREE.MathUtils.smoothstep(time, 0.3, 2.0));
  }

  /**
   * A cinematographer's light cheat for one set-up (cut4): the sun (key light, shadows, the sky's glow — the sky LUT is
   * azimuth-relative, so it rotates with it) is moved to `azimuthDeg` at the set's own elevation; null = the real sun.
   * The tear and the verdict (G5a-G6) are filmed from the south with the sun BEHIND the two men (docs/director-notes-v5:
   * "the low sun behind them", "the sun behind him"); the image-based ambient keeps the real sky (subtle).
   */
  setSunCheat(azimuthDeg: number | null) {
    if (azimuthDeg === null) {
      this.cheatDir = null;
      return;
    }
    const phi = THREE.MathUtils.degToRad(90 - SUN.elevation), theta = THREE.MathUtils.degToRad(azimuthDeg);
    this.cheatDir = (this.cheatDir ?? new THREE.Vector3()).setFromSphericalCoords(1, phi, theta);
  }

  /** Per frame (before rendering): sun uniforms, sky dome / shadow frame, cloud deck, point sprite scale. */
  update(dt: number, camera: THREE.PerspectiveCamera, opts: { advanceTime?: boolean } = {}) {
    if (opts.advanceTime) shared.uTime.value += dt;
    shared.uSunDir.value.copy(this.cheatDir ?? this.setSun.dir);
    shared.uSunColor.value.copy(this.setSun.color);
    if (!this.beat) {
      // free camera: frame the sun shadows on the ground ~15 m ahead of the lens
      camera.getWorldDirection(this.focus);
      this.focus.y = 0;
      if (this.focus.lengthSq() < 1e-6) this.focus.set(0, 0, 1);
      this.focus.normalize().multiplyScalar(15).add(camera.position);
      this.focus.y = this.ground.height(this.focus.x, this.focus.z);
      if (this.shadowHalf !== 30) {
        this.shadowHalf = 30;
        const sc = this.sky.sun.shadow.camera;
        sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30;
        sc.updateProjectionMatrix();
      }
    }
    this.sky.update(camera, this.focus);
    if (this.deck) this.driveLandClouds();
    // depth precision for the rise: close inserts need a 5 cm near plane, the view from 3 km up a far larger one
    const agl = camera.position.y - this.ground.height(camera.position.x, camera.position.z);
    const near = agl > 120 ? Math.min(8, agl * 0.004) : GilgalSet.NEAR;
    if (Math.abs(camera.near - near) > 1e-3 && (agl > 120 || camera.near > GilgalSet.NEAR)) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    // high above the valley the sunlit cloud deck fills the frame: stop down like a camera operator would
    if (this.beat) this.exposure = GilgalSet.BASE_EXPOSURE * this.shots[this.beat.name].exposure * THREE.MathUtils.lerp(1, 0.58, THREE.MathUtils.smoothstep(camera.position.y, 700, 2600));
    if (this.post) {
      // the valley haze is a low dust layer: from high above the deck the air is clear (the deck itself is not hazed)
      const alt = camera.position.y;
      this.post.atmosphere.uniforms.uDensity.value = GilgalSet.ATMOSPHERE.density * (1 - 0.9 * THREE.MathUtils.smoothstep(alt, 150, 2000));
    }
    const size = this.renderer.getDrawingBufferSize(tmpV2);
    this.motes.uniforms.uPx.value = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    this.smoke.setPixelScale(size.y, camera.fov);
  }

  /** the slow-motion factor of the action at the current beat (actors' animation clocks: dt * timeScale) */
  get timeScale() {
    return this.beat ? timeScale(this.beat.name, this.beat.time) : 1;
  }

  applyExposure(renderer: THREE.WebGLRenderer = this.renderer) {
    renderer.toneMappingExposure = this.exposure;
  }

  /** leaving the view: the game's sun back, and forget the post chain (its haze belongs to the world again) */
  leave() {
    this.restoreSharedSun();
    this.post = null;
    if (this.landSnap) {
      const s = this.landSnap;
      landAtmo.uSunDirA.value.copy(s.sunDir);
      landAtmo.uSunColA.value.copy(s.sunCol);
      landAtmo.tSkyCube.value = s.sky;
      landAtmo.uHaze.value.copy(s.haze);
      cloudShared.uDeck.value.copy(s.deck);
      cloudShared.uCloudTime.value = s.time;
      this.landSnap = null;
    }
  }

  /** point the shared land cloud / haze uniforms at this set (sun, sky, deck in set metres, haze base) */
  private driveLandClouds() {
    if (!this.landSnap) {
      this.landSnap = {
        sunDir: landAtmo.uSunDirA.value.clone(), sunCol: landAtmo.uSunColA.value.clone(), sky: landAtmo.tSkyCube.value,
        haze: landAtmo.uHaze.value.clone(), deck: cloudShared.uDeck.value.clone(), time: cloudShared.uCloudTime.value,
      };
    }
    landAtmo.uSunDirA.value.copy(this.cheatDir ?? this.setSun.dir);
    landAtmo.uSunColA.value.copy(this.setSun.color);
    landAtmo.tSkyCube.value = this.sky.cubeTarget.texture;
    landAtmo.uHaze.value.set(2.4e-5, 1 / 1900, -400 - ORIGIN_ASL, 1);
    cloudShared.uDeck.value.copy(GilgalSet.DECK);
    cloudShared.uCloudTime.value = shared.uTime.value;
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
    this.post = post;
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
    this.deck?.dispose();
    this.leave();
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
