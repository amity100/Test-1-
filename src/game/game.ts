import * as THREE from 'three';
import { FEEL, IS_TOUCH, liteContent, QualityName } from '../config';
import {
  LAW,
  type ActorHit,
  type ActorSnap,
  type DeathContext,
  type DynBody,
  type EnemyContext,
  type EnemyHooks,
  type EnemyKind,
  type EnemyView,
  type EntranceContext,
  type ExitAim,
  type GameEvent,
  type HitInfo,
  type ImpactInfo,
  type KillEvent,
  type PhysicsEvents,
  type Projectile,
  type ProjectileHooks,
  type ProjSnap,
  type ReplayHost,
  type RiftEnd,
  type ScreenMarker,
  type Snapshot,
  type SpawnDef,
  type StrikeName,
  type Team,
  type TowerLevel,
  type TrapTarget,
  type TrickAward,
  type V3,
  type ZoneId,
  type ZoneDef,
} from '../core/contracts';
import { Input } from '../engine/input';
import { TouchControls } from '../engine/touch';
import { Audio } from '../engine/audio';
import { Renderer } from '../render/renderer';
import { applySkyStyle, createSky, createSkyEnvMap, createSkyline, DEFAULT_SKY, LampSystem } from '../render/fx';
import { LightGate } from '../render/lightgate';
import { SPARK_PX } from '../render/portalMaterial';
import { PixelLines } from '../render/pixelLines';
import { ShadowBox } from '../render/shadowbox';
import { createDecoSkyline } from '../render/cityscape';
import type { TowerBuild } from '../world/tower';
import { TOWER } from '../world/tower/layout';
import { buildWorld, WORLD_SKY, WORLD_SUN, type WorldId } from '../world/worlds';
import { CameraRig } from './camera';
import { CHAR_RIM, Character, type AnimLibrary, type CharacterAsset, type Look } from './characters';
import { dampAngle, Player, type PlayerEvents, type PlayerInput } from './player';
import { FLOW, FLOW_SPRINT, flowBodyOn, flowOn, pickMark, PowerMeter, PowerMoment, type PowerCandidate } from './flow';
import { ReachMode } from './reachmode';
import { STRIP_HERO, STRIP_KESSLER } from './reachfx';
import { BLADE, HiddenBlade } from './blade';
import { OUTCOME_COLOR, RiftSystem } from './portals';
import { ArcView, PortalKey, type PortalResult } from './portalkey';
import { orientFrame } from './portalMath';
import { Physics } from '../sim/physics';
import { Projectiles } from '../sim/projectiles';
import { EnemySystem, type Enemy } from '../actors/enemies';
import { PropSystem, type Prop } from './props';
import { Hazards, type HazardHooks } from './hazards';
import { ZoneManager, type EncounterState, type LiftState } from './zones';
import { FxKit } from './fxkit';
import { HUD } from '../ui/hud';
import { addStrings, getLang, setDevice, t, worldText } from '../ui/i18n';
import { PhotoUI } from '../ui/photoui';
import { StrikeBar } from '../ui/strikebar';
import { killCredit, STRIKE, STRIKES, Strikes, type StrikeResult } from './strikes';
import type { RunStats } from '../ui/menu';
import { StyleSystem } from '../meta/style';
import { ReplayPlayer, ReplayRecorder } from '../meta/replay';
import { ClipExporter } from '../meta/clip';
import { PhotoMode } from '../meta/photo';
import { ChallengeSystem } from '../meta/challenges';
import { META_STRINGS } from '../meta/strings';
import { LAB_SPAWN_GUARD, LabMode } from './lab';
import type { LabRunStats } from './labdirector';
import { activeVariant, onslaughtOn, reachOn, setLabActive, setVariant, type CombatVariant } from './variant';
import { aimedEnemy, behind, dodgeAt, dodgeSpot, exposedTo, Parry, ParryView, PRECISION, precisionOn, type DodgeRun } from './precision';

import type { Settings } from './settings';
import { beginRenderFrame } from '../render/frameonce';
export type { Settings };

export type { RunStats };

type Mode = 'menu' | 'playing' | 'paused' | 'replay' | 'photo' | 'ended';

/** Who/what applied the damage that may kill, read by the enemy `died` hook. */
interface KillCtx {
  projectile?: Projectile | null;
  impactor?: DynBody | null;
  byPlayer?: boolean;
  playerFling?: boolean;
  byProp?: boolean;
  byBarrel?: boolean;
  /** COMET shockwave: the landing speed (the hit itself is a knock). */
  comet?: number;
  /** Loops of the thing that went off (a looped barrel: CANNONBALL). */
  loops?: number;
  /** A lab laser that went through your rift (scores like a beam: FIRING LINE). */
  laser?: boolean;
  /** Set off by fire a REFLECT sent (a barrel it was steered onto): the strike's kill. */
  reflect?: boolean;
}

/** A gate's next arrival waits while anyone is this close (m) to where he comes out, this long at most (s). */
const GATE_MOUTH = 1.6;
const GATE_MOUTH_WAIT = 4;
/** A wave steps through its gate one man at a time, this far apart at least (s). */
const GATE_SPACING = 0.45;
/** Real spot lights the lamp system moves between the lamps nearest the player (every preset). */
const LAMP_LIGHTS = 4;

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const COL_EXIT = new THREE.Color(0.25, 1.6, 2.2);
const COL_ENTRANCE = new THREE.Color(2.4, 1.2, 0.3);
const COL_CHARGED = new THREE.Color(0.3, 1.6, 2.4);
const COL_SPARK = new THREE.Color(2.6, 1.6, 0.7);
/** ONSLAUGHT's melee red (wind-ups, the slam). */
const COL_MELEE = new THREE.Color(3, 0.25, 0.12);
/** Telegraph line segments drawn per frame (lasers, beams, charges). */
const TELEGRAPH_SEGS = 48;
/** ONSLAUGHT's solid tells (a slam takes 48: two rings). */
const MELEE_SEGS = 160;

const LOOKS: Record<EnemyKind, Look> = {
  rifleman: 'rifleman',
  grenadier: 'grenadier',
  warden: 'warden',
  brute: 'brute',
  sniper: 'sniper',
  turret: 'rifleman',
  boss: 'boss',
};

function disposeMaterial(m: THREE.Material) {
  for (const v of Object.values(m)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
  m.dispose();
}

/** Free a subtree's GPU buffers (skinned characters share their asset's: only their bone textures go). */
function disposeTree(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if ((c as THREE.SkinnedMesh).isSkinnedMesh) {
      (c as THREE.SkinnedMesh).skeleton?.dispose();
      return;
    }
    // (an instanced mesh's matrix and colour buffers are only freed by its own dispose)
    if ((c as THREE.InstancedMesh).isInstancedMesh) (c as THREE.InstancedMesh).dispose();
    if (!m.geometry) return;
    m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (mat) disposeMaterial(mat);
  });
}

/** Distance along segment a→b (0..1) where it passes within r of a vertical cylinder, or -1. */
function segCylinder(a: V3, b: V3, base: V3, r: number, h: number): number {
  const dx = b.x - a.x, dz = b.z - a.z;
  const fx = a.x - base.x, fz = a.z - base.z;
  const A = dx * dx + dz * dz;
  let t: number;
  if (A < 1e-9) t = 0;
  else t = THREE.MathUtils.clamp(-(fx * dx + fz * dz) / A, 0, 1);
  // closest XZ approach; refine to the entry point
  const cx = fx + dx * t, cz = fz + dz * t;
  const d2 = cx * cx + cz * cz;
  if (d2 > r * r) return -1;
  if (A > 1e-9) {
    const back = Math.sqrt(Math.max(0, r * r - d2) / A);
    t = Math.max(0, t - back);
  }
  const y = a.y + (b.y - a.y) * t;
  if (y < base.y - 0.05 || y > base.y + h + 0.05) {
    // vertical segments: check whole span overlap
    const lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
    if (hi < base.y || lo > base.y + h) return -1;
  }
  return t;
}

export class Game {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(FEEL.fov, 1, 0.08, 2400);
  renderer: Renderer;
  input: Input;
  touch: TouchControls | null = null;
  audio = new Audio();
  hud: HUD;
  rig: CameraRig;
  settings: Settings;
  mode: Mode = 'menu';
  time = 0;
  timeScale = 1;

  level!: TowerBuild;
  /** The world the level was built for (mission 1 has two while the owner picks one). */
  world: WorldId = 'harbour';
  zones!: ZoneManager;
  physics!: Physics;
  rifts!: RiftSystem;
  projectiles!: Projectiles;
  enemies!: EnemySystem;
  props!: PropSystem;
  hazards!: Hazards;
  private photoUi: PhotoUI;
  strikes!: Strikes;
  /** The one rift key. */
  portal!: PortalKey;
  /** ACTION's hidden blade. */
  blade!: HiddenBlade;
  private arcView!: ArcView;
  private strikeBar: StrikeBar;
  /** SWAPped men: their own side's fire hurts them until then (game time). */
  private riftMarked = new Map<number, number>();
  /** Gamepad Start while paused (main hides the menu and resumes). */
  onResumeKey: () => void = () => {};
  fx: FxKit;
  player!: Player;
  private hero!: Character;
  lamps: LampSystem | null = null;
  style = new StyleSystem();
  challenges = new ChallengeSystem();
  recorder = new ReplayRecorder(15, 30);
  replay!: ReplayPlayer;
  exporter = new ClipExporter();
  photo = new PhotoMode();

  sky: THREE.Mesh;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  private skyline: THREE.Object3D | null = null;

  hp: number = LAW.player.hp;
  private lastHurtT = -99;
  private respawnT = -1;
  private hitstop = 0;
  private slowT = 0;
  private slowScale = 1;
  private aimT = 0;
  private lastAim: ExitAim | null = null;
  private carried: { body: DynBody; prop: Prop | null } | null = null;
  private shoveT = 0;
  private shoveDir = new THREE.Vector3();
  private shoved = new Set<number>();
  private playerFling = false;
  private airStartT = -1;
  private airCrossings = 0;
  private catchWindow = { t: -1, count: 0 };
  private telegraphs: { kind: 'laser' | 'beam' | 'arc' | 'charge' | 'melee' | 'slam'; from: THREE.Vector3; to: THREE.Vector3; t: number }[] = [];
  private telegraphPool: Game['telegraphs'] = [];
  private telegraphLines: THREE.LineSegments;
  private meleeLines: THREE.LineSegments;
  private meleeWide: PixelLines;
  private arcLine: THREE.Line;
  private arcWasVisible = false;
  private killCtx: KillCtx | null = null;
  private clipOfferT = 0;
  private clipFrames: Snapshot[] | null = null;
  private visionOn = false;
  private helpers: THREE.Object3D[] = [];
  /** Rift glows and blast flashes: out of the light set while none is lit (the same picture, less work). */
  private effectLights: LightGate | null = null;
  private asset!: CharacterAsset;
  private anims!: AnimLibrary;
  private hintsSeen = new Set<string>();
  private liveSnap: Snapshot | null = null;
  private replayProj: THREE.InstancedMesh;
  private replayBeams: THREE.LineSegments;
  /**
   * Lasers and replay beams as 1 CSS pixel wide quads where the render has more than ~1 pixel per
   * CSS pixel (a phone at 2x: a GL line, always 1 device pixel, would be half as wide as meant).
   */
  private wideLines: PixelLines[] = [];
  private bossDead = false;
  private victoryT = -1;
  private tricksSeen = new Set<string>();
  private lastDevice = '';
  private menuT = 0;
  private zoneStartT = 0;
  /** Everything the current world added to the scene (a world switch takes it all away). */
  private worldObjs: THREE.Object3D[] = [];
  /** A world is built and in the scene (a failed build leaves none). */
  private built = false;
  /** The faded Voss that warms the blink's shader programs (kept across world switches). */
  private fadeWarm: Character | null = null;
  /** One man of every enemy look: their casters (a warden's shield, the guns) warm the shadow pass's programs. */
  private castWarm: Character[] = [];
  /** The level's own finish (the train) is open / the player stepped into it. */
  private meReady = false;
  private boarded = false;
  /** Metres ahead of the player (along the view) the sun's shadow box centres. */
  private shadowAhead = 0;
  /** The shadow box in the sun's frame: moved in whole shadow-map texels (no edge crawl). */
  private shadowBox = new ShadowBox();

  stats: RunStats = { time: 0, kills: 0, bestCombo: 0, styleTotal: 0, tricks: 0, deaths: 0, challenges: 0 };
  /** The COMBAT LAB (only while the lab world is loaded): its wave director and HUD. */
  lab: LabMode | null = null;
  /** REACH (the lab's remote hand, its weapons and its enemy side; only while the lab is loaded). */
  reach: ReachMode | null = null;
  /** When you last went through a rift (game time): their hand loses you. */
  private lastCrossT = -99;
  /** The wheel's steps this frame, for REACH's window. */
  private reachWheel = 0;
  /** The lab's results are in (the run ends on them, not on the mission's end screen). */
  private labStats: LabRunStats | null = null;
  /** Game time until which the player can't be hurt (a lab respawn on the pad). */
  private guardUntil = -1;
  // PRECISION (a lab variant; see precision.ts)
  /** RMB's PARRY window and lockout. */
  private parry = new Parry();
  private parryView = new ParryView();
  /** Rounds, beams and grenades a PARRY sent back (they hit for PRECISION.parry.damage). */
  private parried = new WeakSet<Projectile>();
  /** The DODGE under way, its lockout (real s), and game time until which nothing touches you. */
  private dodgeRun: DodgeRun | null = null;
  private dodgeCd = 0;
  private dodgeSafeUntil = -1;
  /** Men a dodge came up behind (or a PERFECT parry rocked): the blade finishes them until this game time. */
  private exposedUntil = new Map<number, number>();
  /** The variant the HUD's key labels were last set for. */
  private hudVariant: CombatVariant | '' = '';
  // FLOW + POWER (a lab variant; see flow.ts)
  /** POWER: fills as you move; full, it can be held. */
  private meter = new PowerMeter();
  /** The POWER moment (held: time near-stopped, marking; then the chain). */
  private power = new PowerMoment();
  /** A thumb marks by holding the crosshair on a man: who, and how long (real s). */
  private powerDwell = { id: -1, t: 0 };
  /** Where the chain's camera turns to (the last dash's heading). */
  private powerYaw = 0;
  /** The man under the crosshair while POWER is held. */
  private powerAim: EnemyView | null = null;
  /** The lab's run is over: its results card. */
  onLabEnd: (stats: LabRunStats) => void = () => {};
  onPause: () => void = () => {};
  onEnd: (win: boolean, stats: RunStats, rank: string) => void = () => {};
  /** Clip ready (blob may be null when recording isn't supported: replay only). */
  onClip: (blob: Blob | null, share: () => void, close: () => void) => void = (_b, _s, close) => close();

  constructor(private canvas: HTMLCanvasElement, private uiRoot: HTMLElement, settings: Settings) {
    this.settings = settings;
    // (the scene's matrices are brought up to date once per frame, in render(), not in each render call:
    // a frame renders the scene once per rift window as well)
    this.scene.matrixWorldAutoUpdate = false;
    this.renderer = new Renderer(canvas, settings.quality, this.scene, this.camera);
    this.input = new Input(canvas);
    this.input.sensitivity = settings.sensitivity;
    this.input.invertY = settings.invertY;
    this.hud = new HUD(uiRoot);
    this.photoUi = new PhotoUI(uiRoot, this.input);
    this.strikeBar = new StrikeBar(uiRoot, this.input);
    this.hud.show(false);
    this.hud.onClip = () => this.startReplay();
    if (IS_TOUCH) {
      this.touch = new TouchControls(this.input, uiRoot);
      this.touch.show(false);
      this.input.lastDevice = 'touch';
    }
    for (const lang of ['en', 'he'] as const) {
      addStrings(lang, (META_STRINGS as any)[lang] ?? {});
    }
    this.rig = new CameraRig(this.camera);

    // golden hour
    this.sky = createSky();
    this.scene.add(this.sky);
    this.scene.fog = new THREE.FogExp2(new THREE.Color().setRGB(0.62, 0.5, 0.42, THREE.LinearSRGBColorSpace), 0.0024);
    this.scene.background = new THREE.Color(0x000000);
    this.hemi = new THREE.HemisphereLight(0xbfd2f0, 0x6b5238, 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffc38a, 3.1);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    const sc = this.sun.shadow.camera;
    sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 260;
    this.scene.add(this.sun, this.sun.target);

    this.fx = new FxKit(this.renderer.renderer.getPixelRatio());
    this.scene.add(this.fx.group);

    // telegraph visuals (lasers, beam charge, grenade arcs)
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TELEGRAPH_SEGS * 6), 3).setUsage(THREE.DynamicDrawUsage));
    lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TELEGRAPH_SEGS * 6), 3).setUsage(THREE.DynamicDrawUsage));
    this.telegraphLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.telegraphLines.frustumCulled = false;
    this.scene.add(this.telegraphLines);
    this.wideLines.push(new PixelLines(this.telegraphLines, 1));
    // ONSLAUGHT's tells (red melee, orange gunfire): solid, and wide on every screen
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MELEE_SEGS * 6), 3).setUsage(THREE.DynamicDrawUsage));
    mg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MELEE_SEGS * 6), 3).setUsage(THREE.DynamicDrawUsage));
    mg.setDrawRange(0, 0);
    this.meleeLines = new THREE.LineSegments(mg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
    this.meleeLines.frustumCulled = false;
    this.scene.add(this.meleeLines);
    this.meleeWide = new PixelLines(this.meleeLines, 3);
    this.meleeWide.enabled = true;
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.arcLine = new THREE.Line(ag, new THREE.LineDashedMaterial({ color: new THREE.Color(3, 1.2, 0.4), dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.9, depthWrite: false }));
    this.arcLine.frustumCulled = false;
    this.arcLine.visible = false;
    this.scene.add(this.arcLine);

    // replay-only projectile visuals
    this.replayProj = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.07, 0.7), new THREE.MeshBasicMaterial({ color: 0xffffff }), 64);
    this.replayProj.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3), 3);
    this.replayProj.visible = false;
    this.replayProj.frustumCulled = false;
    this.scene.add(this.replayProj);
    const rb = new THREE.BufferGeometry();
    rb.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 6), 3));
    this.replayBeams = new THREE.LineSegments(rb, new THREE.LineBasicMaterial({ color: new THREE.Color(3, 0.4, 0.3) }));
    this.replayBeams.visible = false;
    this.replayBeams.frustumCulled = false;
    this.scene.add(this.replayBeams);
    this.wideLines.push(new PixelLines(this.replayBeams, 1));
  }

  // ------------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------------

  async load(asset: CharacterAsset, anims: AnimLibrary, world: WorldId = 'harbour') {
    this.asset = asset;
    this.anims = anims;
    // (shaders compile in parallel where the browser can: the loader keeps going meanwhile)
    await this.buildWorld(world, true);
  }

  /**
   * Swap the level for another world's, in place (the menu's WORLD choice):
   * no page reload, so it works in hosts that block navigation or storage.
   * Call from the menu only.
   */
  setWorld(world: WorldId) {
    if (world === this.world && this.built) return;
    if (this.built) this.unloadWorld();
    this.buildWorld(world);
  }

  /** Take away everything buildWorld() added (and free its GPU memory). */
  private unloadWorld() {
    this.built = false;
    // (the props' meshes before they're cleared out of their group)
    disposeTree(this.props.group);
    this.enemies.clear();
    this.projectiles.clear();
    this.props.clear();
    this.rifts.dispose();
    this.hero.dispose();
    // everything the world added goes, its systems' pools too (rift sparks, bolts, the hologram):
    // anything shared that's used again is simply uploaded again
    for (const o of this.worldObjs) {
      this.scene.remove(o);
      disposeTree(o);
    }
    this.worldObjs = [];
    for (const m of Object.values(this.level.materials)) disposeMaterial(m);
    this.scene.environment?.dispose();
    this.scene.environment = null;
    this.lamps = null;
    this.skyline = null;
    this.riftMarked.clear();
    this.strikeMarks?.clear();
    this.lab?.dispose();
    this.lab = null;
    this.reach?.dispose();
    this.reach = null;
    this.hud?.el.classList.remove('lab');
    setLabActive(false);
  }

  /**
   * Build a world. One that fails (a device that can't take its textures or
   * shaders) leaves nothing in the scene and throws: the caller may build
   * another in its place.
   */
  private buildWorld(id: WorldId): void;
  private buildWorld(id: WorldId, async: true): Promise<void>;
  private buildWorld(id: WorldId, async = false): void | Promise<void> {
    const before = new Set(this.scene.children);
    const fail = (e: unknown) => {
      for (const o of this.scene.children.filter((c) => !before.has(c))) {
        this.scene.remove(o);
        disposeTree(o);
      }
      this.scene.environment?.dispose();
      this.scene.environment = null;
      this.worldObjs = [];
      throw e;
    };
    if (async) {
      return (async () => {
        try {
          await this.buildWorldInto(id, before, true);
        } catch (e) {
          fail(e);
        }
        this.built = true;
      })();
    }
    try {
      this.buildWorldInto(id, before);
    } catch (e) {
      fail(e);
    }
    this.built = true;
  }

  /** Build the level, warm its shaders (`parallel`: without blocking the page), start a run. */
  private buildWorldInto(id: WorldId, before: Set<THREE.Object3D>, parallel = false): void | Promise<void> {
    this.buildLevel(id);
    if (parallel) return this.warmShaders(true).then(() => this.finishWorld(before));
    this.warmShaders(false);
    this.finishWorld(before);
  }

  private buildLevel(id: WorldId) {
    const asset = this.asset, anims = this.anims;
    this.world = id;
    const r = this.renderer.renderer;
    // (the world's lighter variant: phones on low / medium only; high and ultra build the PC's world everywhere)
    const lite = liteContent(this.renderer.preset);
    // image-based light from the world's own sky
    const envMap = createSkyEnvMap(r, WORLD_SUN[id], WORLD_SKY[id]);
    this.scene.environment = envMap;
    this.level = buildWorld(id, envMap, lite);
    this.scene.add(this.level.root);
    const atm = this.level.atmosphere;
    this.scene.environmentIntensity = atm.environmentIntensity;
    this.sun.color.setHex(atm.sunColor);
    this.sun.intensity = atm.sunIntensity;
    this.hemi.color.setHex(atm.hemiSky);
    this.hemi.groundColor.setHex(atm.hemiGround);
    this.hemi.intensity = atm.hemiIntensity;
    (this.scene.fog as THREE.FogExp2).color.setHex(atm.fogColor);
    (this.scene.fog as THREE.FogExp2).density = atm.fogDensity;
    r.toneMappingExposure = atm.exposure;
    applySkyStyle(this.sky, atm.sky ?? DEFAULT_SKY);
    CHAR_RIM.value = atm.rim ?? 0;
    this.renderer.setLook(atm.look);
    const skyline =
      atm.skyline === 'none' ? null : atm.skyline === 'deco' ? createDecoSkyline({ mobile: lite, sunDir: this.level.sunDir, sky: atm.sky }) : createSkyline({ mobile: lite, sunDir: this.level.sunDir });
    this.skyline = skyline;
    if (skyline) this.scene.add(skyline);
    const sunU = (this.sky.material as THREE.ShaderMaterial).uniforms.uSunDir;
    if (sunU) sunU.value.copy(this.level.sunDir);
    const preset = this.renderer.preset;
    this.sun.shadow.mapSize.set(preset.shadowMap, preset.shadowMap);
    const ext = atm.shadow?.extent ?? 38;
    const sc = this.sun.shadow.camera;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
    sc.updateProjectionMatrix();
    this.shadowAhead = atm.shadow?.ahead ?? 0;
    this.shadowBox.setSun(this.level.sunDir);
    if (this.level.lamps.length) {
      this.lamps = new LampSystem(this.level.lamps, LAMP_LIGHTS, false, atm.lampLook);
      this.scene.add(this.lamps.group);
    }

    this.zones = new ZoneManager(this.level);
    const world = this.level.world;
    this.rifts = new RiftSystem(this.scene, r, world, {
      portalScale: preset.portalScale,
      // (the same 4 rift glows on every device: lights are evaluated only where they reach)
      lightCount: 4,
      maxViews: preset.portalViews,
      outcomeAt: (x, z, groundY) => {
        // (ground under a level kill line, the tracks in a rail cut, is no ground)
        if (groundY > -Infinity) {
          const k = this.level.killYAt?.(_v3.set(x, groundY, z));
          return k != null && groundY < k ? 'void' : null;
        }
        return this.level.isSea(_v3.set(x, 0, z)) ? 'splash' : 'void';
      },
    });
    this.physics = new Physics(world, this.rifts, {
      seaY: this.level.seaY,
      isSea: (p) => this.level.isSea(p),
      // off a floor's edge (outside the tower) past its zone's killY is the void; inside the
      // footprint floors are stacked, so a body lands on the one below
      killYAt: (p, b) => this.killYAt(p, b),
    });
    this.projectiles = new Projectiles(world, this.rifts, this.physics, this.projectileHooks());
    this.scene.add(this.projectiles.group);
    this.scene.add(this.parryView.group);
    this.enemies = new EnemySystem(this.physics, this.enemyHooks(), (kind, def) => {
      const c = new Character(asset, anims, def?.onslaught && def.archetype ? def.archetype : LOOKS[kind]);
      // REACH: his hands start empty (his own rifle hidden); the weapons he takes show in them
      if (def?.reach) c.addHeldWeapons(STRIP_KESSLER);
      return c;
    });
    // the COMBAT LAB: its director brings the fights, its variant is in force
    const arena = this.level.lab;
    this.lab = arena
      ? new LabMode(arena, this.hud.el, {
          enemies: this.enemies,
          fx: this.fx,
          audio: this.audio,
          playerPos: () => this.player.body.pos,
          onCleared: () => {
            // PRECISION: no regen in a fight, so a cleared wave gives you your health back
            if (precisionOn() && this.hp > 0 && this.respawnT < 0) {
              this.hp = LAW.player.hp;
            }
            // (REACH: a short beat, no long slow motion)
            this.slowT = Math.max(this.slowT, reachOn() ? 0.45 : 0.9);
            this.slowScale = reachOn() ? 0.45 : 0.3;
            this.audio.sting('alert');
          },
          onFinished: (st) => this.labFinished(st),
          onWave: (_n, def) => {
            if (reachOn()) this.reach?.beginWave(def);
          },
          toolFor: (ev) => (reachOn() && this.reach ? this.reach.toolFor(ev) : null),
        })
      : null;
    this.hud.el.classList.toggle('lab', !!arena);
    setVariant(this.settings.combatVariant);
    setLabActive(!!arena);
    this.scene.add(this.enemies.group);
    for (const z of this.level.zones) this.enemies.setNav(z.id, z.nav, world);
    if (this.level.bossArena) (this.enemies as any).setBossArena?.(this.level.bossArena.center, this.level.bossArena.radius, this.level.bossArena.blinkPoints);
    for (const g of this.level.gates) this.rifts.addGate(g.id, g.inFrame, g.outFrame);
    this.props = new PropSystem(this.physics, this.level);
    this.scene.add(this.props.group);
    this.hazards = new Hazards(this.level, world, this.rifts, lite);
    this.strikes = new Strikes({
      rifts: this.rifts,
      world,
      level: this.level,
      killYAt: (p) => this.killYAt(p),
      enemies: this.enemies,
      props: this.props,
      active: this.zones.active,
      playerFeet: () => this.player.body.pos,
      playerEye: () => this.player.eye(_v4),
      playerBody: () => this.player.body,
      playerGrounded: () => !this.player.airborne,
      aimRay: () => this.rig.aimRay(),
      touch: () => this.input.lastDevice === 'touch',
      looseAim: () => this.input.lastDevice === 'touch' || this.input.lastDevice === 'pad',
    });
    this.portal = new PortalKey({
      rifts: this.rifts,
      world,
      level: this.level,
      killYAt: (p) => this.killYAt(p),
      enemies: this.enemies,
      props: this.props,
      entranceCtx: () => this.entranceCtx(this.trapTargets()),
      aimRay: () => this.rig.aimRay(),
      playerEye: () => this.player.eye(_v4),
      playerFeet: () => this.player.body.pos,
      touch: () => this.input.lastDevice === 'touch',
      looseAim: () => this.input.lastDevice === 'touch' || this.input.lastDevice === 'pad',
      live: (e) => this.zones.active.has(e.def.zone),
      hangingUnderCrosshair: () => this.hangingUnderCrosshair(),
    });
    this.blade = new HiddenBlade({ world, enemies: this.enemies.list, live: (e) => this.zones.active.has(e.def.zone), rifts: this.rifts, reachOnly: () => precisionOn() });
    this.arcView = new ArcView(OUTCOME_COLOR);
    this.scene.add(this.arcView.points);
    this.scene.add(this.hazards.group);

    // player
    const heroChar = new Character(asset, anims, 'hero');
    const body = this.physics.createBody('player', { pos: this.zones.current.playerStart.clone(), radius: FEEL.playerRadius, height: FEEL.playerHeight, team: 'player', simulate: true });
    body.userData.manual = true;
    this.player = new Player(heroChar, body);
    this.hero = heroChar;
    this.scene.add(heroChar.root);
    // the COMBAT LAB's REACH: weapons in the hero's hand, the enemy side's brain, its look
    if (arena) {
      heroChar.addHeldWeapons(STRIP_HERO);
      const reach = (this.reach = this.makeReach());
      this.enemies.reachBrain = reach.ai;
      this.scene.add(reach.fx.group);
      // (one of everything it draws, so the programs compile with the world's)
      reach.fx.warm(this.camera.position.clone().addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()), 6));
    }

    // rift hologram
    const holo = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.6, 1.4), transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending });
    const ghost = new Character(asset, anims, 'hologram', holo);
    ghost.root.visible = false;
    this.rifts.ghostFigure = ghost.root;
    this.rifts.group.add(ghost.root);
    this.rifts.events.opened = (end, which) => {
      this.audio.riftOpen(end.position, which === 'boss' ? 'gate' : which);
      this.fx.riftBurst(end.position, end.normal, which === 'exit' ? COL_EXIT : COL_ENTRANCE);
    };
    this.rifts.events.closed = (end) => this.audio.riftClose(end.position);
    // by the panel or by an entrance on its arena end: either way it's a HIJACK
    this.rifts.events.hijacked = (id) => {
      const g = this.level.gates.find((q) => q.id === id);
      const at = g ? g.panel : this.player.body.pos;
      this.audio.hijack(at);
      this.hud.toast(t('toast.hijack'), 'good');
      this.push({ type: 'hijack', t: this.time, at: at.clone() });
    };
    this.helpers = [];
    this.rifts.group.traverse((o) => {
      if (o.userData.helper) this.helpers.push(o);
    });
    this.helpers.push(ghost.root, this.telegraphLines, this.meleeLines, this.arcLine, this.arcView.points);

    this.replay = new ReplayPlayer(this.replayHost());

    // one global clip plane in every pass (a no-op one in the main view, the rift's far side in
    // rift views): the plane count never changes, so no material swaps programs per pass
    r.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e7)];
    // Voss's blink fades his materials into transparent clones: warm those programs too
    // (one stand-in for every world: a new one per switch would keep its clones for good)
    const fade = (this.fadeWarm ??= new Character(asset, anims, LOOKS.boss));
    fade.setOpacity(0.5);
    fade.root.position.copy(this.camera.position).addScaledVector(this.camera.getWorldDirection(_v), 4);
    this.scene.add(fade.root);
    // every look's casters in the shadow pass: its depth programs (a warden's double-sided shield has
    // its own) compiled now, not when the first warden walks into the sun's box mid-fight
    if (!this.castWarm.length) {
      for (const look of new Set(Object.values(LOOKS))) if (look !== 'boss') this.castWarm.push(new Character(asset, anims, look));
    }
    for (const c of this.castWarm) {
      c.root.position.copy(fade.root.position);
      this.scene.add(c.root);
    }
    // (0, 2 or all 6 in the light set: none lit, one rift pair open, anything more)
    this.effectLights = new LightGate([...this.rifts.glowLights, ...this.fx.flashLights], [0, 2]);
  }

  /**
   * Pre-compile every shader variant so nothing hitches mid-fight: the world with each size of the
   * effect-light set (a program of every material for each), a rift (Halcyon has none
   * in the scene at load: its first one would compile mid-fight), and the post chain. `parallel`:
   * where the browser compiles in the background (KHR_parallel_shader_compile), wait for it
   * without blocking the page. Each pass ends in a tiny render, which finishes what compiling left.
   */
  private warmShaders(parallel: true): Promise<void>;
  private warmShaders(parallel: false): void;
  private warmShaders(parallel: boolean): void | Promise<void> {
    const r = this.renderer.renderer;
    const gate = this.effectLights!;
    const riftWarm = this.rifts.warmRoot(this.camera);
    this.scene.add(riftWarm);
    // (the warm-up draws go into targets like the ones the game draws into: the main view's, with
    // its MSAA, and a rift view's, without)
    const tmp = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: this.renderer.sceneRT.samples });
    const tmpView = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
    // (the sun's shadow box on the stand-ins, and a shadow map drawn in every pass: the depth
    // programs of each caster for each light-set size; the frame places the sun again)
    const at = this.fadeWarm!.root.position;
    this.sun.position.copy(at).addScaledVector(this.level.sunDir, 140);
    this.sun.target.position.copy(at);
    const pass = (on: boolean) => {
      this.scene.updateMatrixWorld();
      r.shadowMap.needsUpdate = true;
      r.setRenderTarget(tmp);
      r.render(this.scene, this.camera);
      // (rift views render while a rift is lit: some effect lights are in)
      if (on) {
        r.setRenderTarget(tmpView);
        r.render(this.scene, this.camera);
      }
      r.setRenderTarget(null);
    };
    const done = () => {
      r.setRenderTarget(null);
      tmp.dispose();
      tmpView.dispose();
      this.rifts.warmDone(riftWarm);
      gate.update();
    };
    const finish = () => {
      this.renderer.compilePost();
      // the windows' targets now, not in the frame the first rift opens
      this.rifts.preallocate(this.renderer.width, this.renderer.height, r.getPixelRatio());
    };
    if (parallel) {
      return (async () => {
        try {
          for (const size of [...gate.sizes].reverse()) {
            gate.setSize(size);
            // (compiled for a render target: the scene is only ever drawn into one, never the canvas)
            r.setRenderTarget(tmp);
            await r.compileAsync(this.scene, this.camera);
            pass(size > 0);
          }
          finish();
        } finally {
          done();
        }
      })();
    }
    try {
      for (const size of [...gate.sizes].reverse()) {
        gate.setSize(size);
        // (compiled for a render target: the scene is only ever drawn into one, never the canvas)
        r.setRenderTarget(tmp);
        r.compile(this.scene, this.camera);
        pass(size > 0);
      }
      finish();
    } finally {
      done();
    }
  }

  /** After the warm-up: the stand-ins go, the world's objects are recorded, a run starts. */
  private finishWorld(before: Set<THREE.Object3D>) {
    const fade = this.fadeWarm!;
    this.scene.remove(fade.root);
    // (its materials stay: they keep the warmed programs; its bone textures don't need to)
    fade.root.traverse((c) => (c as THREE.SkinnedMesh).skeleton?.dispose());
    for (const c of this.castWarm) {
      this.scene.remove(c.root);
      c.root.traverse((o) => (o as THREE.SkinnedMesh).skeleton?.dispose());
    }
    this.reach?.fx.warm(null);
    this.worldObjs = this.scene.children.filter((o) => !before.has(o));
    this.newRun();
  }

  applySettings(s: Settings) {
    const qualityChanged = s.quality !== this.settings.quality;
    this.settings = s;
    this.input.sensitivity = s.sensitivity;
    this.input.invertY = s.invertY;
    if (qualityChanged) {
      this.renderer.applyQuality(s.quality);
      // (the sun's shadow map follows the preset too: three resizes it at the next shadow render)
      const sm = this.renderer.preset.shadowMap;
      this.sun.shadow.mapSize.set(sm, sm);
      this.rifts?.setPortalScale(this.renderer.preset.portalScale);
      if (this.rifts) this.rifts.maxViews = this.renderer.preset.portalViews;
      this.syncPixelScale(true);
    }
  }

  // ------------------------------------------------------------------
  // Run flow
  // ------------------------------------------------------------------

  /** Fresh run from the pier. */
  newRun() {
    this.startAtZone('pier');
  }

  /** Continue / zone select: earlier zones count as done. */
  startAtZone(id: ZoneId) {
    this.enemies.clear();
    this.projectiles.clear();
    this.props.clear();
    this.rifts.reset();
    this.fx.clear();
    this.recorder.clear();
    this.zones.startAt(id);
    for (const l of this.zones.lifts) this.syncLift(l);
    this.gateWaveT.clear();
    this.gateQueue.length = 0;
    this.challenges.setZone(id);
    this.stats = { time: 0, kills: 0, bestCombo: 0, styleTotal: 0, tricks: 0, deaths: 0, challenges: 0 };
    this.tricksSeen.clear();
    for (const g of this.level.gates) this.rifts.setGateOpen(g.id, false);
    for (const z of this.zones.active) this.props.spawnZone(z);
    this.props.setActive(this.zones.active);
    const cp = this.zones.checkpoint;
    this.respawnPlayer(cp.pos, cp.yaw);
    this.bossDead = false;
    this.victoryT = -1;
    // the level's own finish waits again (the train back at the platform, you on your feet)
    this.meReady = false;
    this.boarded = false;
    this.level.missionEnd?.ready(false);
    this.hero.root.visible = true;
    this.hintsSeen.clear();
    this.zoneStartT = this.time;
    this.style.reset();
    this.clearHints();
    this.labStats = null;
    this.guardUntil = -1;
    this.reach?.newRun();
    this.lab?.restart();
    this.updateObjective(true);
  }

  // ------------------------------------------------------------------
  // COMBAT LAB
  // ------------------------------------------------------------------

  /** The lab's run starts over (Enter, the pause menu, a variant switch), in play. */
  labRestart() {
    if (!this.lab) return;
    this.newRun();
    if (this.mode !== 'playing') this.start();
  }

  /** Switch the combat variant (F1-F4, the menus, the HUD chips): the run starts over under it. */
  labVariant(v: CombatVariant) {
    this.settings = { ...this.settings, combatVariant: v };
    setVariant(v);
    if (!this.lab) return;
    const playing = this.mode === 'playing';
    this.newRun();
    if (playing) this.hud.toast(t('lab.switched', { v: t(`lab.v.${v}`) }), 'good');
  }

  /** REACH, wired to this world. */
  private makeReach(): ReachMode {
    const game = this;
    return new ReachMode(
      {
        get world() {
          return game.level.world;
        },
        get enemies() {
          return game.enemies;
        },
        fx: this.fx,
        audio: this.audio,
        camera: this.camera,
        get player() {
          return game.player;
        },
        get hero() {
          return game.hero;
        },
        aimRay: () => this.rig.aimRay(),
        eye: (out) => this.player.eye(out),
        device: () => this.input.lastDevice,
        time: () => this.time,
        alive: () => this.hp > 0 && this.respawnT < 0,
        safe: () => this.time < this.guardUntil || this.respawnT >= 0,
        fighting: () => !!this.lab?.fighting,
        standAt: (x, z, y) => this.standAt(x, z, y),
        lost: (p) => p.y < this.killYAt(p) || (this.level.isSea(p) && p.y < this.level.seaY + 0.2),
        exitOutcome: (p) => {
          if (this.level.isSea(p)) return 'water';
          const g = this.level.world.groundAt(p.x, p.z, 0.25, p.y + 0.6);
          return g === -Infinity || g < this.killYAt(_v.set(p.x, g, p.z)) ? 'void' : 'floor';
        },
        hurt: (amount, from) => this.hurtPlayer(amount, from),
        hitstop: (s) => (this.hitstop = Math.max(this.hitstop, s)),
        shake: (k) => (this.rig.shake = Math.max(this.rig.shake, k)),
        kick: (k) => (this.rig.kick = Math.max(this.rig.kick, k)),
        lastCrossT: () => this.lastCrossT,
        get rifts() {
          return game.rifts;
        },
        markForAllies: (id, secs) => this.riftMarked.set(id, this.time + secs),
      },
      this.hud.el,
    );
  }

  /** REACH: of the lab's respawn spots, the one whose nearest living man is furthest away. */
  private labRespawn(): V3 {
    const lab = this.lab!;
    let best = lab.arena.pad.pos;
    let bd = -1;
    for (const p of lab.arena.respawns ?? []) {
      let d = Infinity;
      for (const e of this.enemies.list) if (e.alive) d = Math.min(d, e.pos.distanceTo(p));
      if (d > bd + 0.5) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  /** Solid floor a man can stand on at (x, z) about level `y` (none over the void or the water, none inside a wall): its top, else null. */
  private standAt(x: number, z: number, y: number): number | null {
    const w = this.level.world;
    const g = w.groundAt(x, z, 0.3, y + 1.2);
    if (g === -Infinity || Math.abs(g - y) > 1.3) return null;
    if (this.level.isSea(_v.set(x, g, z)) || g < this.killYAt(_v)) return null;
    if (w.overlapsCylinder(x, z, 0.35, g + 0.15, g + 1.7)) return null;
    return g;
  }

  /** W5 is down: a slow beat, then the results card. */
  private labFinished(st: LabRunStats) {
    this.labStats = st;
    this.victoryT = 2;
    this.slowT = 2;
    this.slowScale = 0.3;
    this.audio.sting('victory');
  }

  private respawnPlayer(pos: V3, yaw: number) {
    // let go of whatever was carried
    const c = this.carried;
    if (c) {
      c.body.userData.manual = false;
      c.body.userData.carried = false;
      c.body.enabled = !c.prop || c.prop.alive;
    }
    this.carried = null;
    this.player.carrying = null;
    this.strikes?.reset();
    this.portal?.reset();
    this.blade?.reset();
    this.reach?.onRespawn();
    this.strikeMarks?.clear();
    this.riftMarked?.clear();
    this.resetPrecision();
    this.player.teleport(pos.clone(), yaw);
    this.player.body.charge = 0;
    this.hp = LAW.player.hp;
    // transient timers from the life that ended
    this.respawnT = -1;
    this.slowT = 0;
    this.hitstop = 0;
    this.timeScale = 1;
    this.shoveT = 0;
    this.crouchState = false;
    this.clipOfferT = 0;
    this.clipFrames = null;
    // a new life: replays don't reach back past it (the fallen enemies are gone)
    this.recorder.clear();
    this.hud.offerClip(false);
    this.touch?.offerClip(false);
    (this.hud as any).setAirtime?.(null);
    this.rig.yaw = yaw;
    this.rig.pitch = -0.12;
    this.rig.snapTo(this.player.body.pos);
    this.playerFling = false;
    this.airStartT = -1;
    this.player.char.revive();
  }

  start() {
    this.mode = 'playing';
    this.hud.show(true);
    this.touch?.show(true);
    this.audio.unlock();
    this.input.active = true;
    this.input.requestLock();
    const z = this.zones.current;
    this.lab?.show(true);
    // (the lab has its own WAVE banner; its rules are the mission's)
    if (!this.lab) {
      this.showZoneTitle(z);
      this.audio.sting('zone');
    }
    if (z.id === 'pier' && !this.lab && !this.hintsSeen.has('rules')) {
      this.hintsSeen.add('rules');
      // (three sentences to read: it holds its full time before the next hint takes its turn)
      this.hint('rules', `<b>${t('rule.1')}</b><br>${t('rule.2')}<br>${t('rule.3')}`, 9, true);
    }
  }

  pause() {
    if (this.mode !== 'playing') return;
    // a PORTAL / LOOP cannon in hand is let go of, not fired on the way back
    if (this.portal.holding) this.portal.cancel();
    this.strikes.cancelAim();
    this.input.portalHolding = false;
    this.mode = 'paused';
    this.touch?.show(false);
    this.input.active = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.onPause();
  }

  resume() {
    this.mode = 'playing';
    this.hud.show(true);
    this.touch?.show(true);
    this.input.active = true;
    this.input.requestLock();
    // look / wheel that piled up while paused or replaying would snap the camera
    this.input.consumeLook();
    this.input.consumeWheel();
    this.audio.unlock(); // iOS may have suspended audio meanwhile
  }

  retryFromCheckpoint() {
    this.respawn(false);
    this.resume();
  }

  quitToMenu() {
    this.mode = 'menu';
    this.hud.show(false);
    this.touch?.show(false);
    this.input.active = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** A challenge's title and description, in the loaded world's words where it has its own (Halcyon's pier.3). */
  challengeText(id: string) {
    const c = this.challenges.text(id, getLang());
    return { title: worldText(`challenge.${id}.title`) ?? c.title, desc: worldText(`challenge.${id}.desc`) ?? c.desc };
  }

  refreshObjectives() {
    this.updateObjective(true);
  }

  /** Death / fell out: back to the checkpoint, uncleared fights reset. */
  private respawn(died: boolean) {
    if (died) this.stats.deaths++;
    if (this.lab) {
      // the lab: back on the pad, the wave goes on (the run records the death)
      if (died) this.lab.noteDeath();
      // (REACH: the spot furthest from them, so nobody waits on the pad with a knife)
      const at = reachOn() ? this.labRespawn() : this.lab.arena.pad.pos;
      this.respawnPlayer(at, at === this.lab.arena.pad.pos ? this.lab.arena.pad.yaw : Math.atan2(-at.x, -at.z));
      this.guardUntil = this.time + LAB_SPAWN_GUARD;
      this.push({ type: 'death', t: this.time });
      return;
    }
    this.enemies.clear();
    this.projectiles.clear();
    this.rifts.reset();
    for (const g of this.level.gates) this.rifts.setGateOpen(g.id, false);
    this.zones.resetUncleared();
    this.gateWaveT.clear();
    this.gateQueue.length = 0;
    // loads, barrels and crates come back so a lesson can be tried again
    this.props.clear();
    for (const z of this.zones.active) this.props.spawnZone(z);
    this.props.setActive(this.zones.active);
    const cp = this.zones.checkpoint;
    this.respawnPlayer(cp.pos, cp.yaw);
    this.respawnT = -1;
    this.timeScale = 1;
    this.push({ type: 'death', t: this.time });
  }

  private saveProgress() {
    // (zone progress is the harbour tower's: another world's mission 1 leaves it alone)
    if (this.world !== 'harbour') return;
    try {
      const prev = JSON.parse(localStorage.getItem('threshold.progress') || '{}');
      const order: ZoneId[] = ['pier', 'yard', 'skeleton', 'lab', 'crown'];
      const best = order.indexOf(prev.furthest) >= order.indexOf(this.zones.furthest) ? prev.furthest : this.zones.furthest;
      localStorage.setItem('threshold.progress', JSON.stringify({ furthest: best }));
    } catch {}
  }

  static savedZone(): ZoneId | null {
    try {
      const p = JSON.parse(localStorage.getItem('threshold.progress') || '{}');
      return p.furthest ?? null;
    } catch {
      return null;
    }
  }

  /** `full`: nothing takes its place before its `dur` is up (else hints take turns of 4.5 s at most). */
  private hint(key: string, html: string, dur = 7, full = false) {
    if (this.hintsSeen.has('h:' + key)) return;
    this.hintsSeen.add('h:' + key);
    this.hintQueue.push({ key, html, dur, full });
  }

  /** A strike went off (or was refused): marks, feedback. */
  private onStrike(r: StrikeResult) {
    if (!r.ok) {
      this.audio.ui('deny');
      if (r.reason) this.hud.toast(t(r.reason), 'warn');
      return;
    }
    if (r.target && r.name) this.strikeMarks.set(r.target.id, { name: r.name, until: this.time + (r.id === 'reflect' ? 6 : r.id === 'swap' ? 4 : 8) });
    // a strike takes over: a blade lunge under way ends where it is (a DASH / SWAP moves you now)
    this.blade.cancel();
    this.player.endLunge();
    if (r.id === 'swap' && r.target) this.riftMarked.set(r.target.id, this.time + STRIKE.markTime + 0.6);
    // a beat of slow motion and a kick: it should feel like a move, not a menu
    this.slowT = Math.max(this.slowT, r.release ? 0.45 : 0.35);
    this.slowScale = 0.35;
    this.rig.kick = Math.max(this.rig.kick, r.release ? 1 : 0.7);
    this.rig.shake = Math.max(this.rig.shake, 0.25);
    navigator.vibrate?.(18);
    if (r.at) this.fx.ring(r.at, 3.5, 0.35, r.id === 'reflect' ? COL_EXIT : COL_ENTRANCE);
    if (r.id !== 'swap' && r.id !== 'dash') this.player.char.play('push', { fade: 0.05, speed: 1.6 });
    if (r.id === 'loop' && !r.release) this.hint('loopAgain', t('hint.loopAgain'), 6);
  }

  /** `name` if that STRIKE is still working on this man (the mark stays). */
  private strikeOn(id: number, name: StrikeName): StrikeName | null {
    const m = this.strikeMarks.get(id);
    return m && m.name === name && this.time <= m.until ? name : null;
  }

  private strikeOf(id: number): StrikeName | null {
    const m = this.strikeMarks.get(id);
    if (!m) return null;
    this.strikeMarks.delete(id);
    return this.time <= m.until ? m.name : null;
  }

  /** A SWAPped man: his own side's fire and blasts hurt him for now. */
  private marked(id: number) {
    const u = this.riftMarked.get(id);
    return u !== undefined && this.time <= u;
  }

  /** Who a STRIKE is working on (its kill names the strike). */
  private strikeMarks = new Map<number, { name: StrikeName; until: number }>();
  /** Rounds, beams and grenades that came through a REFLECT pair (their kills are the strike's). */
  private reflected = new WeakSet<Projectile>();
  private strikeTargetPt = { x: 0, y: 0 };
  private updateStrikeHud() {
    const tg = this.portal.holding ? null : this.strikes.target();
    let pt: { x: number; y: number } | null = null;
    if (tg) {
      const v = tg.chest(_v).project(this.camera);
      if (v.z < 1) {
        this.strikeTargetPt.x = (v.x * 0.5 + 0.5) * this.renderer.width;
        this.strikeTargetPt.y = (1 - (v.y * 0.5 + 0.5)) * this.renderer.height;
        pt = this.strikeTargetPt;
      }
    }
    const S = this.strikes;
    this.strikeBar.update(
      { reflect: precisionOn() ? this.parry.cooling() : S.cooling('reflect'), loop: S.cooling('loop'), swap: S.cooling('swap'), dash: S.cooling('dash') },
      pt,
      S.charges,
      STRIKE.maxCharges,
      { loop: S.armed('loop') },
    );
  }

  /** The PORTAL key went down: the entrance (or why not). */
  private onPortalPress(r: PortalResult) {
    if (!r.ok) {
      this.audio.ui('deny');
      if (r.reason) this.hud.toast(t(r.reason), 'warn');
      return;
    }
    navigator.vibrate?.(12);
    this.rifts.orientation = 'auto';
    if (r.mode === 'grab' && r.at) {
      this.fx.ring(r.at, 2.4, 0.3, COL_ENTRANCE);
      this.rig.kick = Math.max(this.rig.kick, 0.4);
      this.player.char.play('push', { fade: 0.05, speed: 1.4 });
      this.hint('grab', t('hint.grabHold'), 7);
    }
  }

  /** The PORTAL key let go: the exit opened (or the hold fell through). */
  private onPortalRelease(r: PortalResult) {
    if (!r.ok) {
      if (r.reason) {
        this.audio.ui('deny');
        this.hud.toast(t(r.reason), 'warn');
      }
      return;
    }
    navigator.vibrate?.(15);
    if (r.mode === 'grab' || r.mode === 'load' || r.mode === 'hijack') {
      this.rig.kick = Math.max(this.rig.kick, 0.8);
      this.rig.shake = Math.max(this.rig.shake, 0.2);
      if (r.at) this.fx.ring(r.at, 3.2, 0.35, COL_EXIT);
      this.player.char.play('push', { fade: 0.05, speed: 1.8 });
    }
    if (r.mode === 'door') this.hint('door', t('hint.doorPlaced'), 6);
  }

  /** Hints take turns (each gets a few seconds) and wait for the zone title card, and for a hint the player opened to read (phones). */
  private hintQueue: { key: string; html: string; dur: number; full: boolean }[] = [];
  private hintHold = 0;
  private updateHints(realDt: number) {
    // (REACH: its own one tip; none of the old ones)
    if (this.lab && reachOn()) {
      this.hintQueue.length = 0;
      return;
    }
    this.hintHold -= realDt;
    if (this.hintHold > 0 || !this.hintQueue.length || this.hud.hintOpen) return;
    const h = this.hintQueue.shift()!;
    this.hud.hint(h.key, h.html, h.dur);
    this.hintHold = h.full ? h.dur : Math.min(h.dur, 4.5);
  }

  private clearHints() {
    this.hintQueue.length = 0;
    this.hintHold = 0;
    this.hud.clearHint();
  }

  /** The zone title card; hints wait until it has faded. */
  private showZoneTitle(z: ZoneDef) {
    this.hud.zoneTitle(t(z.nameKey), t(z.subKey));
    this.hintHold = Math.max(this.hintHold, 4.2);
  }

  // ------------------------------------------------------------------
  // Events → style / challenges
  // ------------------------------------------------------------------

  private push(e: GameEvent) {
    this.handleAwards(this.style.push(e), e);
  }

  private handleAwards(awards: TrickAward[], e: GameEvent | null) {
    if (awards.length) this.recorder.addTricks(awards);
    for (const a of awards) {
      this.hud.popTrick(a);
      this.audio.trick(this.style.state.rank, a.points);
      if (!this.tricksSeen.has(a.id)) {
        this.tricksSeen.add(a.id);
        this.stats.tricks = this.tricksSeen.size;
      }
      if (a.points >= 300) {
        this.slowT = Math.max(this.slowT, 0.35);
        this.slowScale = 0.35;
        this.rig.kick = Math.max(this.rig.kick, 1);
      }
    }
    // (the lab is a test range: its kills don't count toward the missions' challenges)
    const done = this.lab ? [] : this.challenges.push(e as GameEvent, awards, this.style.state);
    for (const id of done) {
      this.stats.challenges++;
      this.hud.toast(`${t('toast.challenge')}: ${this.challengeText(id).title}`, 'good');
      this.audio.ui('objective');
    }
  }

  // ------------------------------------------------------------------
  // Hooks: projectiles
  // ------------------------------------------------------------------

  private projectileHooks(): ProjectileHooks {
    return {
      hitTest: (a, b, radius, p) => this.projectileHitTest(a, b, radius, p),
      onHitActor: (p, hit) => this.projectileHitActor(p, hit),
      onHitWorld: (p, hit) => {
        this.fx.sparks(hit.point, hit.normal, p.charged ? COL_CHARGED : COL_SPARK, p.kind === 'beam' ? 4 : 10);
        if (p.kind === 'bolt') this.audio.boltImpact(hit.point, p.charged);
      },
      onExplode: (p, at) => this.explode(at, LAW.grenade.radius, LAW.grenade.damage, { charged: p.charged, barrel: false, projectile: p }),
      steer: (p, at, dir, end) => {
        const e = this.mirrorTarget(end, at) ?? this.assistTarget(at, dir, p.owner);
        if (!e) return false;
        dir.set(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z).sub(at).normalize();
        return true;
      },
      onCross: (p, from, to) => {
        // REACH: a round of theirs through your window is still theirs (it hits you; nobody steers it)
        if (this.reach?.on && this.reach.isWindowEnd(from)) {
          if (p.team === 'kessler') p.charged = false;
          this.fx.riftBurst(to.position, to.normal, COL_CHARGED);
          return;
        }
        // through a live REFLECT pair: whatever it hits now is the strike's work
        if (this.strikes.viaReflect(from)) this.reflected.add(p);
        if (p.kind === 'bolt') this.steerReturned(p, to);
        else if (p.kind === 'grenade') this.steerCaughtGrenade(p, to);
        this.fx.riftBurst(to.position, to.normal, COL_CHARGED);
        this.push({ type: 'cross', t: this.time, who: p.kind === 'grenade' ? 'grenade' : p.kind === 'beam' ? 'beam' : 'bolt', id: 1e6 + p.id, speed: p.vel.length(), loops: p.loops, fromKind: from.kind, toKind: to.kind });
        if (from.owner === 'player' && p.team === 'kessler' && p.crossings === 1) {
          if (this.time - this.catchWindow.t > 0.6) this.catchWindow = { t: this.time, count: 0 };
          this.catchWindow.count++;
          this.audio.riftCatch(from.position);
        }
      },
    };
  }

  /**
   * Rift magnetism: a bolt coming out of a rift bends onto a Kessler body it
   * was nearly heading for (its own shooter gets a wide cone: Return to Sender).
   */
  /** A MIRROR exit sends everything to its target (alive, in sight). */
  private mirrorTarget(end: RiftEnd, from: V3): Enemy | null {
    if (end.aimAt === undefined || end.aimAt < 0) return null;
    const e = this.enemies.get(end.aimAt) as Enemy | null;
    if (!e || !e.alive) return null;
    if (!this.level.world.lineOfSight(from, _v3.set(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z))) return null;
    return e;
  }

  private steerReturned(p: Projectile, to: RiftEnd) {
    const speed = p.vel.length();
    if (speed < 1e-3) return;
    const dir = _v.copy(p.vel).divideScalar(speed);
    const best = this.mirrorTarget(to, p.pos) ?? this.assistTarget(p.pos, dir, p.owner);
    if (!best) return;
    p.vel.set(best.pos.x, best.pos.y + best.height * 0.6, best.pos.z).sub(p.pos).setLength(speed);
  }

  /** The Kessler body a rift-charged shot from `at` along `dir` bends onto (its shooter gets a wide cone), or null. */
  private assistTarget(at: V3, dir: V3, owner: Projectile['owner']): Enemy | null {
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    for (const e of this.enemies.list) {
      if (!e.alive || !this.zones.active.has(e.def.zone)) continue;
      const to = _v2.set(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z).sub(at);
      const d = to.length();
      if (d < 0.5 || d > FEEL.returnAssistRange) continue;
      const cos = to.dot(dir) / d;
      const sender = e.id === owner;
      if (cos < (sender ? FEEL.returnAssistSender : FEEL.returnAssistCone)) continue;
      const score = cos + (sender ? 0.3 : 0) - d * 0.002;
      if (score <= bestScore) continue;
      if (!this.level.world.lineOfSight(at, _v3.set(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z))) continue;
      best = e;
      bestScore = score;
    }
    return best;
  }

  /** A caught grenade leaving a rift arcs onto a Kessler body roughly ahead of it (POSTAGE). */
  private steerCaughtGrenade(p: Projectile, to: RiftEnd) {
    const body = p.body;
    if (!body) return;
    const v = body.vel;
    let hs = Math.hypot(v.x, v.z);
    const mirror = this.mirrorTarget(to, body.pos);
    if (hs < 4 && !mirror) return;
    hs = Math.max(hs, 8);
    const G = LAW.gravity;
    let best: Enemy | null = mirror;
    let bestScore = -Infinity;
    if (!best) for (const e of this.enemies.list) {
      if (!e.alive || !this.zones.active.has(e.def.zone)) continue;
      const dx = e.pos.x - body.pos.x, dz = e.pos.z - body.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.8 || d > FEEL.returnAssistRange * 0.6) continue;
      const cos = (dx * v.x + dz * v.z) / (d * hs);
      const sender = e.id === p.owner;
      if (cos < (sender ? FEEL.returnAssistSender : FEEL.grenadeAssistCone)) continue;
      const score = cos + (sender ? 0.3 : 0) - d * 0.004;
      if (score <= bestScore) continue;
      if (!this.level.world.lineOfSight(body.pos, _v3.set(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z))) continue;
      best = e;
      bestScore = score;
    }
    if (!best) return;
    // same horizontal speed, turned onto him, with the lob that meets his chest
    const dx = best.pos.x - body.pos.x, dz = best.pos.z - body.pos.z;
    const d = Math.hypot(dx, dz);
    const t = d / hs;
    const dy = best.pos.y + best.height * 0.6 - body.pos.y;
    v.set((dx / d) * hs, (dy + 0.5 * G * t * t) / t, (dz / d) * hs);
  }

  private killYAt(p: V3, b?: DynBody) {
    // the level's own kill lines first (a rail cut: the tracks take you well above the sea)
    const k = this.level.killYAt?.(p);
    if (k != null) return k;
    const lost = this.level.seaY - 30;
    // a man who falls below his own fight's floor is out of it for good: the void takes him,
    // inside the tower too (else a lower floor or roof catches him, stranded far below a
    // fight he holds up and can never get back to)
    const e = b && b.kind === 'enemy' ? this.enemies?.enemyOfBody(b) : null;
    if (e) {
      const z = this.zones.zone(e.def.zone);
      if (!z.sea) return Math.max(lost, z.killY);
    }
    if (p.x > TOWER.x0 - 0.5 && p.x < TOWER.x1 + 0.5 && p.z > TOWER.z0 - 0.5 && p.z < TOWER.z1 + 0.5) return lost;
    // the zone of the floor it fell from
    const y = Math.max(p.y, b ? b.peakY : p.y);
    const z = this.zones ? this.zones.zoneAt(_v4.set(p.x, y, p.z)) : null;
    // (sea-level zones: the water takes it, see onSplash)
    return z && !z.sea ? Math.max(lost, z.killY) : lost;
  }

  private projectileHitTest(a: V3, b: V3, radius: number, p: Projectile): ActorHit | null {
    let best = 2;
    let key = '';
    const base = _v2;
    // the player: only uncharged Kessler fire can hurt you (you're attuned to your own rift)
    // (a DODGE under way: nothing touches you; an open PARRY is a little wider than you, facing the fire)
    if (!p.charged && p.team === 'kessler' && this.hp > 0 && this.time >= this.dodgeSafeUntil) {
      const pad = this.parry.open && precisionOn() && Parry.facing(p.vel, this.lookFlat(_v4)) ? PRECISION.parry.pad : 0;
      const tt = segCylinder(a, b, this.player.body.pos, FEEL.playerRadius + radius + pad, this.player.body.height);
      if (tt >= 0 && tt < best) {
        best = tt;
        key = 'player';
      }
    }
    // Kessler actors: IFF-locked rounds pass through them until they cross a rift
    // (or he's rift-marked: a SWAPped man takes his own side's fire, not his own)
    if (p.charged || (p.team === 'kessler' && this.riftMarked.size)) {
      for (const e of this.enemies.list) {
        if (!e.alive) continue;
        if (!this.zones.active.has(e.def.zone)) continue;
        if (!p.charged && (!this.marked(e.id) || p.owner === e.id)) continue;
        base.copy(e.pos);
        const tt = segCylinder(a, b, base, e.radius + radius, e.height);
        if (tt >= 0 && tt < best) {
          best = tt;
          key = `enemy:${e.id}`;
        }
      }
    }
    for (const pr of this.props.items) {
      if (!pr.alive || !pr.active || pr.body.userData.manual) continue;
      if (p.body && p.body === pr.body) continue;
      const tt = segCylinder(a, b, pr.body.pos, pr.body.radius + radius, pr.body.height);
      if (tt >= 0 && tt < best) {
        best = tt;
        key = pr.key;
      }
    }
    if (!key) return null;
    const point = new THREE.Vector3().lerpVectors(a, b, best);
    const normal = new THREE.Vector3().subVectors(a, b).normalize();
    return { key, point, normal };
  }

  private projectileHitActor(p: Projectile, hit: ActorHit): 'stop' | 'pass' {
    if (hit.key === 'player') {
      // PRECISION: fire that meets the open PARRY goes back where it came from
      if (this.parry.open && precisionOn() && Parry.facing(p.vel, this.lookFlat(_v4))) {
        this.parryCatch(p);
        if (p.kind === 'beam') p.life = p.age;
        return 'stop';
      }
      const dmg = p.kind === 'beam' ? LAW.beam.damage : LAW.bolt.damageToPlayer;
      this.hurtPlayer(dmg, hit.point);
      return p.kind === 'beam' ? 'pass' : 'stop';
    }
    if (hit.key.startsWith('enemy:')) {
      const e = this.enemies.byKey(hit.key);
      if (!e) return 'pass';
      const dir = _v.copy(p.vel).normalize();
      const info: HitInfo = {
        source: p.kind === 'beam' ? 'beam' : p.kind === 'grenade' ? 'grenade' : 'bolt',
        amount: this.parried.has(p) ? PRECISION.parry.damage : p.kind === 'beam' ? LAW.beam.damage * 2 : LAW.bolt.damageCharged,
        charged: true,
        dir: dir.clone(),
        from: hit.point.clone().addScaledVector(dir, -1.5),
        team: 'player',
        instigator: p.owner,
        crossings: p.crossings,
        loops: p.loops,
        exitEndId: p.lastEndId,
      };
      const res = this.withKill({ projectile: p }, () => this.enemies.hit(e, info));
      if (res === 'blocked') {
        this.fx.sparks(hit.point, hit.normal, COL_SPARK, 16);
        this.audio.shieldClang(hit.point);
      } else this.fx.sparks(hit.point, hit.normal, COL_CHARGED, 12);
      return p.kind === 'beam' ? 'pass' : 'stop';
    }
    const pr = this.props.byKey(hit.key);
    if (pr) {
      if (pr.def.explosive && (p.charged || p.kind === 'beam')) this.explodeProp(pr, this.reflected.has(p) ? { reflect: true } : {});
      else this.fx.sparks(hit.point, hit.normal, COL_SPARK, 8);
      return 'stop';
    }
    return 'pass';
  }

  // ------------------------------------------------------------------
  // Hooks: enemies
  // ------------------------------------------------------------------

  private enemyHooks(): EnemyHooks {
    return {
      fireBolt: (e, from, dir) => {
        this.projectiles.fireBolt(from, dir, 'kessler', e.id);
        this.audio.boltFire(from);
      },
      throwGrenade: (e, from, vel) => {
        this.projectiles.throwGrenade(from, vel, 'kessler', e.id, LAW.grenade.fuse);
      },
      fireBeam: (e, from, dir) => {
        this.projectiles.fireBeam(from, dir, 'kessler', e.id, LAW.beam.duration, LAW.beam.damage);
        this.audio.beamFire(from);
      },
      telegraph: (_e, kind, from, to, t01) => {
        const n = this.telegraphs.length;
        if (n < 24) {
          // (entries reused frame to frame: the list is refilled every frame)
          const th = (this.telegraphPool[n] ??= { kind, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0 });
          th.kind = kind;
          th.from.copy(from);
          th.to.copy(to);
          th.t = t01;
          this.telegraphs.push(th);
        }
        if ((kind === 'laser' || kind === 'melee') && t01 < 0.05) this.audio.laserLock(from);
        if (kind === 'beam' && t01 < 0.05) this.audio.beamCharge(from);
      },
      bark: (e, key) => {
        if (e.pos.distanceTo(this.player.body.pos) < 32) this.hud.toast(t(key));
      },
      becameAware: () => {
        this.audio.sting('alert');
      },
      died: (e, ctx) => this.onEnemyDied(e, ctx),
      knocked: (e, info) => {
        this.push({ type: 'knock', t: this.time, enemyId: e.id, cause: info.source, impactorId: this.impactorKey(this.killCtx?.impactor ?? null, e.id), at: e.pos.clone() });
        this.fx.dust(e.pos, 0.6);
      },
      melee: (_e, dmg, push) => {
        // ONSLAUGHT: a DODGE's moment untouchable is untouchable by a blow too (no shove either)
        if (onslaughtOn() && this.time < this.dodgeSafeUntil) return;
        this.hurtPlayer(dmg, this.player.body.pos);
        this.player.body.vel.add(push);
        this.player.body.onGround = false;
      },
      sound: (kind, at) => {
        if (kind === 'roar') this.audio.roar(at);
        else if (kind === 'clang') this.audio.shieldClang(at);
        else if (kind === 'thud') this.audio.impact(at, 6);
        else if (kind === 'step') this.audio.footstep(at, 0.5, false);
        else if (kind === 'shout') this.audio.shout(at);
      },
      bossRift: (_e, a, b) => {
        if (!a || !b) {
          this.rifts.setBossPair(null, null);
          return;
        }
        const n = _v.subVectors(b, a).setY(0).normalize();
        const fa = { position: a.clone().setY(a.y + FEEL.portalHeight / 2), quaternion: orientFrame(n.clone().negate(), UP), width: FEEL.portalWidth, height: FEEL.portalHeight, kind: 'stand' as const };
        const fb = { position: b.clone().setY(b.y + FEEL.portalHeight / 2), quaternion: orientFrame(n.clone(), UP), width: FEEL.portalWidth, height: FEEL.portalHeight, kind: 'stand' as const };
        this.rifts.setBossPair(fa, fb);
      },
      windup: (e, kind, secs) => {
        // ONSLAUGHT's red: a melee blow is coming (dodge it)
        const c = e.chest(new THREE.Vector3());
        this.fx.flash(c, kind === 'slam' ? 6 : 4, Math.min(0.5, secs), 0xff1a10);
        this.fx.ring(_v.copy(e.pos).setY(e.pos.y + 0.06), kind === 'slam' ? 1.4 : 0.9, Math.min(0.45, secs), COL_MELEE);
        if (kind === 'strike' || kind === 'rush') this.audio.shout(c);
      },
      opening: (e, secs) => {
        this.exposedUntil.set(e.id, Math.max(this.exposedUntil.get(e.id) ?? -1, this.time + secs));
      },
      slam: (_e, at, radius) => {
        const p = _v.copy(at).setY(at.y + 0.08);
        this.fx.ring(p, radius, 0.35, COL_MELEE);
        this.fx.ring(p, radius * 0.6, 0.25, COL_MELEE);
        this.fx.dust(at, 1.6);
        this.fx.flash(_v.copy(at).setY(at.y + 0.5), 8, 0.25, 0xff3010);
        this.audio.impact(at, 12);
        const d = at.distanceTo(this.player.body.pos);
        if (d < 14) this.rig.shake = Math.max(this.rig.shake, 0.5 * (1 - d / 14));
      },
      summon: (_e, defs) => {
        for (const d of defs) {
          const v = this.enemies.spawn(d);
          const enc = this.zones.encounters.find((x) => x.zone === d.zone && x.def.lesson === 'boss');
          enc?.enemyIds.push(v.id);
        }
      },
    };
  }

  /** Style key of what hit him: an enemy/corpse id, or a prop as a negative key (BOWLING / HEADS UP). */
  private impactorKey(imp: DynBody | null, victimId: number): number | null {
    if (!imp) return null;
    const ie = this.enemies.enemyOfBody(imp);
    if (ie) return ie.id !== victimId ? ie.id : null;
    return imp.kind === 'prop' ? -(imp.id + 1) : null;
  }

  private withKill<T>(ctx: KillCtx, fn: () => T): T {
    const prev = this.killCtx;
    this.killCtx = ctx;
    try {
      return fn();
    } finally {
      this.killCtx = prev;
    }
  }

  private onEnemyDied(e: EnemyView, ctx: DeathContext) {
    const kc = this.killCtx ?? {};
    const p = kc.projectile ?? null;
    const imp = kc.impactor ?? null;
    const impEnemy = imp ? this.enemies.enemyOfBody(imp) : null;
    const shooter = p && typeof p.owner === 'number' ? this.enemies.get(p.owner) : null;
    // a man a HUMAN CANNON was fired into is the cannon's kill too, and so is
    // one a REFLECT's fire was sent into (or its barrel); the blade's kill is
    // always its own, even on a man a strike set up (killCredit)
    const credit = killCredit({
      cause: ctx.cause,
      setBy:
        this.strikeOf(e.id) ??
        ((p && this.reflected.has(p)) || kc.reflect ? 'reflect' : null) ??
        (impEnemy && impEnemy !== e ? this.strikeOn(impEnemy.id, 'cannon') : null),
      viaTrapdoor: ctx.viaTrapdoor,
    });
    const ev: KillEvent = {
      type: 'kill',
      t: this.time,
      enemyId: e.id,
      enemyKind: e.kind,
      cause: ctx.cause,
      charged: ctx.info.charged,
      speed: Math.max(ctx.info.speed ?? 0, kc.comet ?? 0),
      fallHeight: ctx.fallHeight,
      killerCrossings: p ? p.crossings : imp ? imp.crossings : ctx.info.crossings ?? 0,
      killerLoops: p ? p.loops : imp ? imp.loops : Math.max(ctx.info.loops ?? 0, kc.loops ?? 0),
      victimCrossings: ctx.crossings,
      ownShot: !!p && p.owner === e.id,
      shotBy: p && typeof p.owner === 'number' && p.owner !== e.id ? p.owner : null,
      projectileKind: p ? p.kind : kc.laser ? 'beam' : null,
      turretShot: shooter?.kind === 'turret',
      shotAge: p ? this.time - p.firedAt : 0,
      unaware: ctx.unaware,
      witnessed: ctx.witnessed,
      viaTrapdoor: credit.viaTrapdoor,
      matador: ctx.matador,
      byBody: !!imp && (imp.kind === 'enemy' || imp.kind === 'corpse') && imp !== e.body,
      byProp: !!kc.byProp,
      byBarrel: !!kc.byBarrel,
      byPlayer: !!kc.byPlayer,
      playerFling: !!kc.playerFling,
      playerAirborne: this.player.airborne,
      impactorId: this.impactorKey(imp, e.id),
      strike: credit.strike,
      at: ctx.at.clone(),
    };
    // every kill that isn't a STRIKE's recharges the strikes
    if (credit.refund) this.strikes.refund(1);
    this.stats.kills++;
    this.lab?.noteKill(ev);
    // FLOW: a kill fills POWER (in the air, sliding, or rift-charged: twice over); the chain's own don't
    if (flowOn() && this.power.phase === 'idle') {
      const pl = this.player;
      this.meter.add(pl.airborne || pl.slideT > 0 || pl.body.charge > 0 ? FLOW.meter.styleKill : FLOW.meter.kill);
    }
    this.push(ev);
    // the PORTAL first; the STRIKES once you've made your first kill with it
    // (PRECISION's rules card says how its keys work)
    if (!precisionOn() && !reachOn()) this.hint('strikes', t('hint.strikes'), 10);
    this.fx.embers(ctx.at, 16);
    // (a kill landing after you died heals no one: you stay dead)
    if (this.respawnT < 0) this.hp = Math.min(LAW.player.hp, this.hp + LAW.player.killHeal);
    this.hitstop = Math.max(this.hitstop, 0.05);
    this.rig.kick = Math.max(this.rig.kick, 0.6);
    const cleared = this.zones.checkClears((id) => this.enemies.get(id)?.alive ?? false, (enc) => this.wavesPending(enc));
    for (const c of cleared) this.onEncounterCleared(c);
    if (e.kind === 'boss') this.onBossDown();
  }

  private onEncounterCleared(c: EncounterState) {
    if (c.def.requireClear) this.hud.toast(t('toast.zoneClear'), 'good');
    const cp = c.def.checkpoint;
    if (cp) this.zones.setCheckpoint(cp.pos, cp.yaw, c.zone);
    else if (this.player.body.onGround) this.zones.setCheckpoint(this.player.body.pos, this.player.yaw, c.zone);
    this.hud.toast(t('toast.checkpoint'));
    // last kill of a fight: cinematic beat
    this.slowT = Math.max(this.slowT, 1.1);
    this.slowScale = 0.25;
    this.push({ type: 'checkpoint', t: this.time });
    this.checkMissionEnd();
    this.updateObjective(true);
  }

  /** Every fight the level's finish waits for is won: open it (the train's doors, its toast). */
  private checkMissionEnd() {
    const me = this.level.missionEnd;
    if (!me || this.meReady || !this.zones.allCleared(me.requires)) return;
    this.meReady = true;
    me.ready(true);
    if (me.toastKey) this.hud.toast(t(me.toastKey), 'good');
    this.audio.sting('zone');
  }

  /** Stepped into the open finish: aboard, it leaves, the run is won. */
  private board() {
    const me = this.level.missionEnd!;
    this.boarded = true;
    me.depart();
    this.hero.root.visible = false;
    this.victory();
  }

  private onBossDown() {
    this.bossDead = true;
    // Voss is done for good: his fight counts as won even with his adds still up
    const enc = this.zones.encounters.find((x) => x.def.lesson === 'boss');
    if (enc && !enc.cleared) {
      enc.cleared = true;
      this.onEncounterCleared(enc);
    }
    this.audio.sting('victory');
    this.hud.setObjective(t('obj.escape'));
    this.hint('leap', t('hint.leap'), 9);
    this.rifts.setBossPair(null, null);
  }

  // ------------------------------------------------------------------
  // Physics events: crossings, impacts, touches, water, void
  // ------------------------------------------------------------------

  private physEv: PhysicsEvents = {
    crossed: (b, from, to, speed) => {
      this.fx.riftBurst(to.position, to.normal, from.owner === 'gate' ? COL_ENTRANCE : COL_EXIT);
      this.audio.riftPass(to.position, speed);
      if (b.kind === 'player') {
        this.airCrossings++;
        this.playerFling = (from.kind === 'floor' || from.kind === 'air') && Math.abs(to.normal.y) < 0.5;
        this.strikes.crossed('player', -1, from, to);
        const fin = this.portal.playerCrossed();
        if (fin) this.onPortalRelease(fin);
        this.push({ type: 'cross', t: this.time, who: 'player', speed, loops: b.loops, fromKind: from.kind, toKind: to.kind });
        return;
      }
      const e = this.enemies.enemyOfBody(b);
      if (e) {
        this.portal.crossed(`enemy:${e.id}`);
        this.strikes.crossed('enemy', e.id, from, to);
      } else {
        const pr = this.props.byBody(b);
        if (pr) this.portal.crossed(pr.key);
      }
      if (e && e.alive) {
        // MATADOR is the move itself: his charge into your entrance
        if (e.kind === 'brute' && e.state === 'charge' && from.owner === 'player') this.push({ type: 'matador', t: this.time, at: e.pos.clone() });
        this.enemies.onCrossed(e, from, to, speed);
      }
      // (a grenade's crossing is reported by its projectile)
      if (b.kind !== 'grenade') this.push({ type: 'cross', t: this.time, who: b.kind, id: b.id, speed, loops: b.loops, fromKind: from.kind, toKind: to.kind });
    },
    impact: (b, info) => this.onImpact(b, info),
    touch: (a, b, rel) => this.onTouch(a, b, rel),
    splash: (b) => this.onSplash(b),
    fellOut: (b) => this.onFellOut(b),
  };

  private onImpact(b: DynBody, info: ImpactInfo) {
    if (b.kind === 'player') return; // the player controller reports its own landings
    const e = this.enemies.enemyOfBody(b);
    if (e && e.alive) {
      const res = this.withKill({ impactor: b }, () => this.enemies.onImpact(e, info));
      if (res === 'killed' || res === 'knocked') {
        this.fx.dust(info.point, 1.2);
        this.audio.impact(info.point, info.speed);
        this.rig.shake = Math.max(this.rig.shake, Math.min(0.6, info.speed / 40));
      }
      return;
    }
    const pr = this.props.byBody(b);
    if (pr && pr.alive) {
      if (info.speed > 6) {
        this.fx.dust(info.point, Math.min(2, info.speed / 10));
        this.audio.impact(info.point, info.speed);
      }
      if (pr.def.explosive && info.charged && info.speed >= LAW.knockSpeed) this.explodeProp(pr, { byProp: true });
      return;
    }
    if (b.kind === 'corpse' && info.speed > 6) {
      this.fx.dust(info.point, 0.8);
      this.audio.impact(info.point, info.speed);
    }
  }

  /** Something rift-charged and fast hits something: the core kill law. */
  private onTouch(a: DynBody, b: DynBody, rel: number) {
    for (const [imp, vic] of [[a, b], [b, a]] as [DynBody, DynBody][]) {
      if (imp.charge <= 0 || imp.kind === 'grenade') continue;
      // a charged player hits with his whole speed, even at a glance (shoulder first)
      const speed = imp.kind === 'player' ? Math.max(rel, imp.vel.length()) : rel;
      if (speed < LAW.knockSpeed) continue;
      const v = this.enemies.enemyOfBody(vic);
      if (v && v.alive && vic !== imp) {
        const kc: KillCtx = imp.kind === 'player'
          ? { byPlayer: true, playerFling: this.playerFling, impactor: null }
          : imp.kind === 'prop'
            ? { byProp: true, impactor: imp }
            : { impactor: imp };
        this.impactEnemy(v, speed, imp, kc);
        if (imp.kind === 'player') {
          // punch through, keep some momentum for the next target
          imp.vel.multiplyScalar(0.65);
          this.hitstop = Math.max(this.hitstop, 0.08);
          this.rig.shake = Math.max(this.rig.shake, 0.5);
        }
        continue;
      }
      const pr = this.props.byBody(vic);
      if (pr && pr.alive && pr.def.explosive) this.explodeProp(pr, { byProp: imp.kind === 'prop', byPlayer: imp.kind === 'player', impactor: imp });
    }
  }

  private impactEnemy(v: EnemyView, speed: number, imp: DynBody, kc: KillCtx) {
    const lethal = v.armored ? LAW.armorSpeed : LAW.killSpeed;
    const info: HitInfo = {
      source: 'impact',
      amount: speed >= lethal ? 9999 : speed >= LAW.knockSpeed ? 25 : 0,
      charged: true,
      speed,
      dir: imp.vel.clone().normalize(),
      from: imp.pos.clone(),
      team: 'player',
      instigator: 'player',
      crossings: imp.crossings,
      loops: imp.loops,
      exitEndId: imp.lastEnd ? imp.lastEnd.id : null,
    };
    if (info.amount <= 0) return;
    const res = this.withKill(kc, () => this.enemies.hit(v, info));
    void res;
    this.fx.dust(v.pos, 1);
    this.audio.impact(v.pos, speed);
  }

  private onSplash(b: DynBody) {
    this.fx.splash(b.pos, b.kind === 'prop' ? 1.4 : 1);
    this.audio.splash(b.pos, 1);
    if (b.kind === 'player') {
      if (this.bossDead) this.victory();
      else this.fallDeath(this.level.drownKey ?? 'respawn.void');
      return;
    }
    const e = this.enemies.enemyOfBody(b);
    if (e && e.alive) {
      this.withKill({ impactor: b }, () => this.enemies.onSplash(e));
      return;
    }
    const pr = this.props.byBody(b);
    if (pr) this.props.remove(pr);
    else if (b.kind === 'corpse') b.enabled = false;
  }

  private onFellOut(b: DynBody) {
    if (b.kind === 'player') {
      if (this.bossDead) this.victory();
      else this.fallDeath('respawn.void');
      return;
    }
    const e = this.enemies.enemyOfBody(b);
    if (e && e.alive) {
      this.withKill({ impactor: b }, () => this.enemies.onFellOut(e));
      return;
    }
    const pr = this.props.byBody(b);
    if (pr) this.props.remove(pr);
    else b.enabled = false;
  }

  /** Lost to the sea / the void: back to the checkpoint shortly (respawn counts the death). */
  private fallDeath(key: string) {
    if (this.respawnT >= 0) return;
    this.hud.toast(t(key), 'warn');
    this.respawnT = 0.7;
  }

  // ------------------------------------------------------------------
  // Explosions
  // ------------------------------------------------------------------

  private explodeProp(pr: Prop, kc: KillCtx) {
    if (!pr.alive || pr.fuse >= 0) return;
    pr.fuse = 0; // explode this frame (chains get a short delay)
    const at = pr.body.pos.clone().setY(pr.body.pos.y + pr.body.height * 0.5);
    const loops = pr.body.loops;
    this.props.remove(pr);
    this.explode(at, LAW.barrel.radius, LAW.barrel.damage, { charged: true, barrel: true, kc: { ...kc, loops: Math.max(kc.loops ?? 0, loops) } });
  }

  private explode(at: V3, radius: number, damage: number, o: { charged: boolean; barrel: boolean; projectile?: Projectile; kc?: KillCtx }) {
    this.fx.explosion(at, o.barrel ? 1.2 : 0.9);
    this.audio.explosion(at, o.barrel ? 1.2 : 0.9);
    this.rig.shake = Math.max(this.rig.shake, THREE.MathUtils.clamp(1 - at.distanceTo(this.player.body.pos) / 30, 0, 0.8));
    this.push({ type: 'explode', t: this.time, at: at.clone() });
    // the player: barrels hurt everyone; grenades hurt you only while IFF-locked (uncharged)
    const pd = at.distanceTo(_v.copy(this.player.body.pos).setY(this.player.body.pos.y + 1));
    if (pd < radius && (o.barrel || !o.charged)) {
      const k = 1 - pd / radius;
      this.hurtPlayer(damage * k * (o.barrel ? LAW.barrel.playerScale : 1), at);
      this.player.body.vel.addScaledVector(_v2.subVectors(this.player.body.pos, at).setY(0.6).normalize(), 9 * k);
    }
    // Kessler: only charged blasts (a grenade that went through your rift) or neutral barrels
    // (a rift-marked man is caught by his own side's too)
    if (o.charged || o.barrel || this.riftMarked.size) {
      for (const e of this.enemies.list) {
        if (!e.alive || !this.zones.active.has(e.def.zone)) continue;
        if (!(o.charged || o.barrel || this.marked(e.id))) continue;
        const d = at.distanceTo(e.chest(_v));
        if (d > radius) continue;
        const k = 1 - d / radius;
        const info: HitInfo = {
          source: 'explosion',
          amount: damage * (0.35 + k),
          charged: true,
          from: at.clone(),
          dir: _v2.subVectors(e.pos, at).normalize().clone(),
          team: o.barrel ? 'neutral' : 'player',
          instigator: o.projectile ? o.projectile.owner : 'player',
          crossings: o.projectile?.crossings ?? 0,
          loops: o.projectile?.loops ?? o.kc?.loops ?? 0,
        };
        // a barrel's blast is BOOM whatever lit it (not the bolt/beam that did)
        const kc: KillCtx = o.projectile ? { projectile: o.projectile } : { ...(o.kc ?? {}), projectile: null, byBarrel: o.barrel };
        const res = this.withKill(kc, () => this.enemies.hit(e, info));
        if (res === 'hurt' && k > 0.35) this.enemies.stagger(e, 1.4, _v2.subVectors(e.pos, at).setY(0).normalize().multiplyScalar(4 * k));
      }
    }
    // push loose things, chain barrels
    for (const pr of this.props.items) {
      if (!pr.alive || !pr.active) continue;
      const d = at.distanceTo(pr.body.pos);
      if (d > radius * 1.2) continue;
      if (pr.def.explosive) {
        pr.fuse = pr.fuse < 0 ? 0.12 + Math.random() * 0.1 : pr.fuse;
        continue;
      }
      if (pr.hanging) continue;
      const k = 1 - d / (radius * 1.2);
      pr.body.vel.addScaledVector(_v2.subVectors(pr.body.pos, at).setY(0.8).normalize(), 10 * k);
      pr.body.onGround = false;
    }
    for (const b of this.physics.bodies) {
      if (b.kind !== 'corpse' || !b.enabled) continue;
      const d = at.distanceTo(b.pos);
      if (d > radius) continue;
      const k = 1 - d / radius;
      b.vel.addScaledVector(_v2.subVectors(b.pos, at).setY(0.9).normalize(), 12 * k);
      b.onGround = false;
    }
  }

  private hurtPlayer(amount: number, from: V3) {
    if (amount <= 0 || this.hp <= 0 || this.respawnT >= 0) return;
    if (this.time < this.guardUntil) return;
    // PRECISION: a DODGE's moment untouchable
    if (this.time < this.dodgeSafeUntil) return;
    this.lab?.noteDamage(Math.min(amount, this.hp));
    this.hp -= amount;
    this.lastHurtT = this.time;
    this.hud.damageFlash(Math.min(1, amount / 40));
    this.audio.hurt();
    this.rig.shake = Math.max(this.rig.shake, 0.45);
    navigator.vibrate?.(40);
    this.push({ type: 'hurt', t: this.time, amount });
    void from;
    if (this.hp <= 0) {
      this.hp = 0;
      if (this.reach?.on) this.reach.playerDown();
      this.respawnT = 1.1;
      this.player.char.die('shot');
      this.slowT = 1.1;
      this.slowScale = 0.3;
    }
  }

  // ------------------------------------------------------------------
  // Per-frame
  // ------------------------------------------------------------------

  debugStep(dt: number, n = 1) {
    for (let i = 0; i < n; i++) {
      this.input.poll(dt);
      if (this.mode === 'playing') this.update(dt);
      this.input.endFrame();
    }
  }

  frame(realDt: number) {
    this.input.poll(realDt);
    if (this.lastDevice !== this.input.lastDevice) {
      this.lastDevice = this.input.lastDevice;
      setDevice(this.input.lastDevice);
    }
    // (REACH has no strikes: their bar stays away)
    this.strikeBar.show(this.mode === 'playing' && !(this.lab && reachOn()));
    switch (this.mode) {
      case 'playing':
        this.update(realDt);
        this.render(realDt);
        break;
      case 'replay':
        this.updateReplay(realDt);
        break;
      case 'photo':
        this.updatePhoto(realDt);
        break;
      case 'menu':
        this.updateMenu(realDt);
        this.render(realDt);
        break;
      default:
        this.updateAmbient(realDt * 0.3);
        this.render(realDt);
        if (this.mode === 'paused' && this.input.lastDevice === 'pad' && this.input.wasPressed('pause')) this.onResumeKey();
    }
    this.input.endFrame();
  }

  /** Clock for scenery only (sky, lamps, animated props): it runs in menus, pauses and replays; `time` is the game's and doesn't. */
  private ambientT = 0;
  private updateAmbient(dt: number) {
    this.ambientT += dt;
    for (const f of this.level.animated) f(this.ambientT);
    (this.sky.material as THREE.ShaderMaterial).uniforms.uTime && ((this.sky.material as THREE.ShaderMaterial).uniforms.uTime.value = this.ambientT);
    this.sky.position.copy(this.camera.position);
    if (this.skyline) this.skyline.position.set(this.camera.position.x * 0.9, 0, this.camera.position.z * 0.9);
    const mv = this.level.menuView;
    const focus = this.mode === 'menu' ? (mv ? _v.copy(mv.look) : _v.set(0, 20, 30)) : this.player.body.pos;
    // the shadow box can reach ahead along the view (a square seen from a terrace above it)
    const shadowAt = _v2.copy(focus);
    if (this.mode !== 'menu' && this.shadowAhead > 0) {
      this.camera.getWorldDirection(_v4).setY(0);
      if (_v4.lengthSq() > 1e-6) shadowAt.addScaledVector(_v4.normalize(), this.shadowAhead);
    }
    // (moved across the light in whole texels: static shadow edges stay on their texels, no crawl)
    const sh = this.sun.shadow;
    this.shadowBox.place(shadowAt, (sh.camera.right - sh.camera.left) / sh.mapSize.x, shadowAt);
    this.sun.position.copy(shadowAt).addScaledVector(this.level.sunDir, 140);
    this.sun.target.position.copy(shadowAt);
    this.lamps?.update(this.ambientT, focus);
  }

  private updateMenu(dt: number) {
    this.menuT += dt;
    const mv = this.level.menuView;
    if (mv) {
      // the world's postcard, drifting a little side to side
      this.camera.position.copy(mv.pos).x += Math.sin((this.menuT * Math.PI * 2) / 40) * mv.sway;
      this.camera.lookAt(mv.look);
      // (an ultra-wide screen keeps a phone's width of the postcard and crops top and bottom:
      // wider, it would take in the low sun past the left edge and bloom it over everything)
      const wide = this.camera.aspect / 2.2;
      this.camera.fov = wide > 1 ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(mv.fov / 2)) / wide)) : mv.fov;
    } else {
      const a = this.menuT * 0.05;
      const c = _v.set(0, 0, 40);
      this.camera.position.set(c.x + Math.sin(a) * 95, 30 + Math.sin(this.menuT * 0.09) * 12, c.z + Math.cos(a) * 95);
      this.camera.lookAt(c.x, 45, c.z);
      this.camera.fov = 50;
    }
    this.camera.updateProjectionMatrix();
    this.updateAmbient(dt);
    this.fx.update(dt);
  }

  private update(realDt: number) {
    const inp = this.input;
    const p = this.player;
    const body = p.body;
    this.updateHints(realDt);

    // ----- time -----
    let ts = 1;
    // (aboard the train: nothing more to do but ride)
    const alive = this.respawnT < 0 && !this.boarded;
    // REACH: the lab's default (its HUD and its look on; the old verbs below all off)
    const reach = !!this.reach && reachOn();
    this.reach?.show(reach);
    this.hud.el.classList.toggle('reach-on', reach);
    // held PORTAL (aiming the exit) and the LOOP cannon run in slow motion (REACH: no long slow motion)
    if (this.settings.slowmo && alive && !reach) {
      // (a grab, a fall: time slows at once; a door or a load once you're aiming)
      const H = this.portal.hold;
      if (H && (this.portal.aiming || H.mode === 'grab' || H.mode === 'air')) ts = this.portal.timeScale();
      if (this.strikes.aiming) ts = Math.min(ts, 0.12);
    }
    const aiming = alive && (this.portal.aiming || this.strikes.aiming);
    if (this.slowT > 0) {
      this.slowT -= realDt;
      ts = Math.min(ts, this.slowScale);
    }
    if (this.respawnT >= 0) ts = Math.min(ts, 0.35);
    // FLOW: the POWER moment all but stops time (at once: it's the whole point)
    const flow = flowOn();
    const pts = flow ? this.power.timeScale() : 1;
    ts = Math.min(ts, pts);
    this.timeScale = pts < 1 && this.timeScale > pts ? pts : THREE.MathUtils.damp(this.timeScale, ts, 12, realDt);
    let dt = realDt * this.timeScale;
    if (this.hitstop > 0) {
      this.hitstop -= realDt;
      dt *= 0.08;
    }
    this.time += dt;
    this.stats.time += realDt;
    this.audio.setSlowmo(THREE.MathUtils.clamp((1 - this.timeScale) / 0.7, 0, 1));

    // ----- respawn -----
    if (this.respawnT >= 0) {
      this.respawnT -= realDt;
      if (this.respawnT < 0) this.respawn(true);
    }

    // ----- look -----
    const look = inp.consumeLook();
    this.rig.look(look.x, look.y);

    // ----- rifts: the PORTAL key, close, the STRIKES -----
    this.rifts.aiming = aiming;
    p.aim = THREE.MathUtils.damp(p.aim, aiming ? 1 : 0, 12, realDt);
    // cancel first: a touch slide-to-cancel lets go of the key in the same frame
    if (inp.wasPressed('close')) {
      if (this.portal.holding) {
        this.portal.cancel();
        this.audio.ui('deny');
      } else this.closeRifts();
    }
    if (this.portal.holding) {
      const wheel = inp.consumeWheel();
      if (wheel) this.rifts.airDistance = THREE.MathUtils.clamp((this.rifts.airDistance ?? 12) + wheel * 1.5, 3, LAW.riftRange);
      if (inp.wasPressed('flip')) {
        this.rifts.orientation = this.rifts.orientation === 'auto' ? 'hatch' : this.rifts.orientation === 'hatch' ? 'door' : 'auto';
        this.audio.ui('click');
      }
    } else {
      // (REACH: the wheel sets how far its window stands in mid-air)
      this.reachWheel = inp.consumeWheel();
      this.rifts.airDistance = null;
    }
    // FLOW: POWER (held: marks with the crosshair; let go: the chain); nothing else starts meanwhile
    if (flow) this.updatePower(realDt, alive);
    else if (this.power.phase !== 'idle') this.power.reset();
    const free = alive && this.power.phase === 'idle';
    // (REACH has no PORTAL key: its window is your way through; LMB is the weapon)
    if (free && !reach && inp.wasPressed('portal')) this.onPortalPress(this.portal.press());
    const released = this.portal.update(realDt, free && !reach && inp.isHeld('portal'));
    if (released) this.onPortalRelease(released);
    // STRIKES: one press, a whole rift attack (none start while the PORTAL is in hand; a LOOP's
    // second press being held still counts, and dying lets go of it)
    this.strikes.update(realDt, dt);
    const prec = precisionOn();
    this.parry.update(realDt, dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - realDt);
    for (let i = 0; i < STRIKES.length && !reach; i++) {
      const a = `strike${i + 1}` as 'strike1';
      // PRECISION: REFLECT's key is the PARRY (no lock-on, no charge)
      if (prec && i === 0) {
        if (free && !this.portal.holding && inp.wasPressed(a)) this.parryPress();
        continue;
      }
      const r = this.strikes.input(STRIKES[i], free && !this.portal.holding && inp.wasPressed(a), free && inp.isHeld(a));
      if (r) this.onStrike(r);
    }
    this.updateStrikeHud();
    const H = this.portal.hold;
    const aim = H && this.portal.aiming ? H.aim : null;
    this.lastAim = aim;
    this.hud.setAim(
      aim
        ? {
            valid: aim.valid,
            reason: aim.reason,
            kind: aim.kind,
            distance: aim.distance,
            outcome: aim.outcome,
            dropBelow: aim.dropBelow,
            orientation: this.rifts.orientation,
            chip: H && H.mode !== 'door' && H.mode !== 'air' && H.mode !== 'hole' ? t('aim.throw') : undefined,
          }
        : null,
    );
    this.rifts.updatePreview(aim, this.handPos(), this.camera, !!H && (H.mode === 'door' || H.mode === 'air' || H.mode === 'hole'));
    this.strikeBar.setDimmed(this.portal.holding);
    // (on a man you could grab, the preview also lays out where a tap would throw him)
    // (not while FLOW's POWER has time stopped: the marks are the only thing on screen then)
    const pv = !reach && !this.portal.holding && alive && this.power.phase === 'idle' ? this.portal.preview(!this.strikes.aiming) : null;
    this.arcView.update(this.portal.arcN > 1 ? this.portal : this.strikes, this.time);
    if (pv) {
      this.hud.setGateHint({ mode: pv.mode, reason: pv.reason, targetKey: pv.key });
      // the touch PORTAL button says what it will do (and pulses while you fall)
      this.touch?.setPortalLabel(pv.reason ? null : t(`portal.${pv.mode}`), pv.reason ? null : pv.mode);
    } else {
      this.hud.setGateHint(null);
      this.touch?.setPortalLabel(null);
    }
    this.hud.setRiftState({ exit: this.rifts.hasExit(), entrance: this.rifts.hasEntrance(), aiming, orientation: this.rifts.orientation });
    this.touch?.setPortalHeld(this.portal.holding);
    this.input.portalHolding = !reach && this.portal.holding;
    this.touch?.setFlip(!reach && !!H && this.portal.aiming && (H.mode === 'door' || H.mode === 'air' || H.mode === 'hole'));
    this.touch?.setAiming(aiming);

    // ----- player -----
    // FLOW: crouch at a run is a SLIDE (it doesn't toggle crouching); the chain moves you itself
    const still = this.respawnT >= 0 || this.boarded || this.power.phase === 'chain';
    const flowBody = flowBodyOn();
    const slide = flowBody && inp.wasPressed('crouch') && body.onGround && Math.hypot(body.vel.x, body.vel.z) >= FLOW.slide.minSpeed;
    const pin: PlayerInput = {
      moveX: still ? 0 : inp.moveX,
      moveY: still ? 0 : inp.moveY,
      camYaw: this.rig.yaw,
      jump: !this.boarded && inp.wasPressed('jump'),
      // the touch stick sprints when pushed to its rim (only when it's the stick moving you)
      sprint: inp.isHeld('sprint') || (inp.lastDevice === 'touch' && Math.hypot(inp.moveX, inp.moveY) > 0.95),
      crouch: this.crouchToggle(slide),
      // PRECISION: V is the DODGE (no SHOVE); REACH: neither
      shove: !prec && !reach && inp.wasPressed('shove'),
      slide,
    };
    if (prec && free && inp.wasPressed('shove')) this.dodgePress(inp.moveX, inp.moveY);
    // REACH: the WEAPON and the HAND (before you move: a stab's step in moves you this frame)
    // (WINDOW: RMB / LT / its button; HAND: E / MMB / F / RB / X / its button; WEAPON: LMB / RT / its button)
    if (reach) {
      const handKeys = ['strike3', 'close', 'action', 'shove'] as const;
      this.reach!.update(dt, realDt, {
        fire: free && inp.isHeld('portal'),
        firePress: free && inp.wasPressed('portal'),
        window: free && inp.isHeld('strike1'),
        hand: free && handKeys.some((k) => inp.isHeld(k)),
        handPress: free && handKeys.some((k) => inp.wasPressed(k)),
        wheel: this.reachWheel,
      });
    }
    this.touch?.setReach(reach ? this.reach!.touchState() : null);
    const wasAir = p.airborne;
    p.update(dt, pin, this.level.world, this.physics, this.physEv, this.playerEvents(), this.time);
    this.updateDodge(dt);
    if (!reach) this.updateBlade(dt);
    else this.hero.setBlade(0);
    this.updateAirtime(wasAir);
    if (flow && free) this.meter.update(dt, { speed: Math.hypot(body.vel.x, body.vel.z), grounded: body.onGround, sliding: p.slideT > 0 });
    if (this.playerFling && !p.airborne && p.body.charge <= 0) this.playerFling = false;
    this.keepPlayerOutOfEnemies();
    this.updateShove(dt);
    this.updateCarry();

    // ----- world simulation -----
    this.physics.step(dt, this.physEv, this.time);
    this.telegraphs.length = 0;
    const ectx: EnemyContext = {
      time: this.time,
      player: {
        pos: body.pos,
        chest: p.chest(_v3.clone()),
        vel: body.vel,
        alive: this.hp > 0,
        airborne: p.airborne,
        crouched: p.crouched,
        noise: this.noise,
        safe: this.time < this.dodgeSafeUntil || this.time < this.guardUntil || this.respawnT >= 0,
      },
      world: this.level.world,
      rifts: this.rifts,
      physics: this.physics,
      activeZones: this.zones.active,
    };
    this.enemies.update(dt, ectx);
    this.noise.length = 0;
    this.rifts.update(dt, realDt, this.time);
    this.updateParried();
    this.projectiles.update(dt, this.time);
    this.detonateCaughtGrenades();
    this.hazards.update(dt, this.time, this.zones.active, { pos: body.pos, vel: body.vel, radius: FEEL.playerRadius, height: p.height, alive: this.hp > 0 && this.respawnT < 0 }, this.enemies.list, this.hazardHooks);
    this.props.update(dt);
    this.updatePropFuses(dt);
    this.updateCatchWindow();

    // ----- the lab's waves -----
    if (this.lab && this.victoryT < 0) this.lab.update(realDt);

    // ----- zones, encounters, lifts -----
    const zu = this.zones.update(body.pos);
    if (zu.entered) this.onZoneEntered(zu.entered.id);
    for (const e of zu.triggered) this.triggerEncounter(e);
    for (const e of zu.engaged) this.engageEncounter(e);
    this.updateLifts(dt);
    this.updateGates(dt);
    if (this.bossDead && this.victoryT < 0 && body.pos.y < (this.level.bossArena?.y ?? 90) - 30) this.victory();
    const me = this.level.missionEnd;
    if (me && this.meReady && !this.boarded && this.victoryT < 0 && this.respawnT < 0 && me.box.containsPoint(body.pos)) this.board();
    if (this.victoryT >= 0) {
      this.victoryT -= realDt;
      if (this.victoryT < 0) this.finishRun();
    }

    // ----- context action -----
    const act = this.contextAction();
    this.hud.setPrompt(act ? act.label : null);
    this.touch?.setAction(act ? act.label : null);
    if (act && inp.wasPressed('action')) act.run();

    // ----- meta -----
    if (inp.wasPressed('vision')) {
      this.visionOn = !this.visionOn;
      this.hud.setVision(this.visionOn);
    }
    const banked = this.style.update(realDt, p.airborne);
    const late = this.style.drainLate();
    if (late.length) this.handleAwards(late, null);
    if (banked && banked.banked > 0) {
      this.hud.comboBanked(banked.banked, this.style.state.rank);
      this.audio.comboBank(banked.banked);
      this.stats.bestCombo = Math.max(this.stats.bestCombo, banked.banked);
      this.stats.styleTotal = this.style.state.total;
      const rankIdx = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'].indexOf(this.style.state.rank);
      if ((banked.banked >= 1500 || rankIdx >= 3) && this.exporterOk()) {
        this.clipOfferT = 6;
        this.clipFrames = this.recorder.aroundCombo(this.style.lastChainSpan);
        this.hud.offerClip(true);
        this.touch?.offerClip(true);
      }
    }
    if (this.clipOfferT > 0) {
      this.clipOfferT -= realDt;
      if (this.clipOfferT <= 0) {
        this.hud.offerClip(false);
        this.touch?.offerClip(false);
      }
    }
    if (inp.wasPressed('clip')) this.startReplay();
    if (inp.wasPressed('photo')) this.enterPhoto();
    if (inp.wasPressed('pause')) this.pause();

    // ----- health -----
    // (PRECISION: no regen while they're on to you; a cleared wave heals you instead)
    if (this.hp > 0 && this.time - this.lastHurtT > LAW.player.regenDelay && !(prec && this.lab && this.underFire())) this.hp = Math.min(LAW.player.hp, this.hp + LAW.player.regenRate * dt);
    this.updatePrecisionHud(prec, realDt);
    this.updateFlowHud(flow, realDt);
    this.hud.setHealth(this.hp, LAW.player.hp);
    const boss = this.enemies.boss();
    this.hud.setBoss(boss && boss.fighting ? boss : null);
    this.hud.setStyle(this.style.state);
    (this.hud as any).setPlayerCharged?.(body.charge > 0);

    // ----- camera, fx, audio -----
    const speed = body.vel.length();
    // (FLOW: plain running fast widens the view too, a slide drops it low)
    const hs = Math.hypot(body.vel.x, body.vel.z);
    const rush = flowBody ? THREE.MathUtils.clamp((hs - FEEL.sprintSpeed) / 9, 0, 1) * 0.7 : 0;
    this.rig.speed = THREE.MathUtils.damp(this.rig.speed, Math.max(rush, body.charge > 0 ? THREE.MathUtils.clamp((speed - 8) / 22, 0, 1) : 0), 6, realDt);
    this.rig.wide = THREE.MathUtils.damp(this.rig.wide, flow && this.power.phase !== 'idle' ? 1 : 0, this.power.phase === 'held' ? 7 : 3, realDt);
    if (flow && this.power.phase === 'chain') this.rig.yaw = dampAngle(this.rig.yaw, this.powerYaw, 9, realDt);
    this.rig.update(realDt, body.pos, p.slideT > 0 ? 1.35 : p.crouched ? 1 : 0, aiming, this.level.world);
    if (flowBody && hs > FLOW_SPRINT * 0.9) this.fx.streak(_v.copy(body.pos).setY(body.pos.y + 1), body.vel, COL_CHARGED);
    if (body.charge > 0 && speed > 8) this.fx.streak(_v.copy(body.pos).setY(body.pos.y + 1), body.vel, COL_CHARGED);
    for (const b of this.physics.bodies) if (b.kind !== 'player' && b.enabled && b.charge > 0 && b.vel.lengthSq() > 64) this.fx.streak(_v.copy(b.pos).setY(b.pos.y + b.height * 0.5), b.vel, COL_ENTRANCE);
    this.fx.setHome(body.pos);
    this.fx.update(dt);
    this.drawTelegraphs();
    this.updateMarkers();
    this.updateObjective(false);
    this.hud.update(realDt);
    this.audio.updateListener(this.camera);
    // a fight drives the music; enemies searching for you (or suspicious) only keep it tense
    let fight = 0, tense = 0;
    for (const e of this.enemies.list) {
      if (!e.alive || !this.zones.active.has(e.def.zone)) continue;
      if (e.state === 'combat' && !e.searching) fight = 1;
      else if (e.aware) tense = 1;
    }
    this.audio.setIntensity(fight ? 0.8 : tense ? 0.6 : 0.2, fight, realDt);
    this.audio.setAltitude(body.pos.y);
    this.audio.wind(body.charge > 0 ? speed : speed * 0.3);
    if (body.charge > 0 && body.loops >= 2) this.audio.loopWhoosh(speed);
    this.updateAmbient(dt);
    if (this.recorder.wants(this.time)) this.recorder.record(this.capture());
  }

  private noise: { at: V3; radius: number }[] = [];

  private crouchState = false;
  private crouchToggle(slide = false) {
    if (this.input.wasPressed('crouch') && !slide) this.crouchState = !this.crouchState;
    if (this.input.wasPressed('jump') || this.input.isHeld('sprint')) this.crouchState = false;
    this.touch?.setCrouched(this.crouchState);
    return this.crouchState;
  }

  /** The player's event handlers: built once (they read the game's state when they run). */
  private playerEv?: PlayerEvents;
  private playerEvents(): PlayerEvents {
    return (this.playerEv ??= {
      footstep: (pos, loud, radius) => {
        this.audio.footstep(pos, loud, this.player.body.groundCollider?.tag === 'steel');
        if (radius > 2) this.noise.push({ at: pos.clone(), radius });
      },
      jumped: (pos) => this.audio.jump(pos),
      landed: (pos, speed, charged) => this.onPlayerLanded(pos, speed, charged),
      fallDamage: (amount) => this.hurtPlayer(amount, this.player.body.pos),
      shoved: (_from, dir) => {
        this.shoveT = 0.3;
        this.shoveDir.copy(dir);
        this.shoved.clear();
        this.audio.shove(this.player.body.pos);
      },
      crossed: (_from, _to, yawDelta) => {
        if (flowOn()) this.meter.add(FLOW.meter.portal);
        this.lastCrossT = this.time;
        // through a rift mid-lunge: the lunge is over (the rift's momentum carries you on)
        this.blade.cancel();
        this.rig.rotateBy(yawDelta);
        this.rig.kick = Math.max(this.rig.kick, 0.8);
        this.renderer.grade.uniforms.uFlash.value = 1;
      },
      // FLOW: a kick off a wall (a whoosh, dust off it), the double jump (a ring under you), a slide
      airJump: (pos, wall) => {
        this.meter.add(wall ? FLOW.meter.wallJump : FLOW.meter.airJump);
        if (wall) {
          this.audio.shove(pos);
          this.fx.dust(_v.copy(pos).setY(pos.y + 0.9), 0.5);
          this.rig.kick = Math.max(this.rig.kick, 0.45);
        } else {
          this.audio.jump(pos);
          this.fx.ring(_v.copy(pos).setY(pos.y + 0.05), 1.1, 0.25, COL_EXIT);
          this.rig.kick = Math.max(this.rig.kick, 0.25);
        }
      },
      slid: (pos) => {
        this.audio.dodge(pos, false);
        this.fx.dust(pos, 0.7);
        this.rig.kick = Math.max(this.rig.kick, 0.35);
      },
    });
  }

  private onPlayerLanded(pos: V3, speed: number, charged: boolean) {
    this.audio.land(pos, speed);
    // FLOW: a landing you feel (a thud in the camera, dust)
    if (flowOn() && speed > 6) {
      this.rig.shake = Math.max(this.rig.shake, Math.min(0.4, (speed - 6) / 25));
      this.fx.dust(pos, Math.min(1.4, speed / 14));
    }
    if (speed > 9) this.fx.dust(pos, Math.min(2, speed / 12));
    if (charged && speed >= LAW.cometSpeed) {
      // COMET: shockwave knocks everyone nearby down
      this.fx.ring(pos, LAW.cometRadius * 2.2, 0.55, COL_CHARGED);
      this.rig.shake = Math.max(this.rig.shake, 0.9);
      this.hitstop = Math.max(this.hitstop, 0.1);
      for (const e of this.enemies.list) {
        if (!e.alive || e.pos.distanceTo(pos) > LAW.cometRadius) continue;
        const info: HitInfo = { source: 'impact', amount: 20, charged: true, speed: LAW.knockSpeed, from: pos.clone(), dir: _v.subVectors(e.pos, pos).normalize().clone(), team: 'player', instigator: 'player' };
        const res = this.withKill({ byPlayer: true, playerFling: this.playerFling, comet: speed }, () => this.enemies.hit(e, info));
        if (res === 'hurt' || res === 'blocked') this.enemies.stagger(e, 2.2, _v2.subVectors(e.pos, pos).setY(0).normalize().multiplyScalar(3));
      }
    }
    // a charged landing this fast is a rift slide: the fling goes on along the ground
    const v = this.player.body.vel;
    if (!(charged && Math.hypot(v.x, v.z) >= LAW.knockSpeed)) this.playerFling = false;
  }

  private updateAirtime(wasAir: boolean) {
    const air = this.player.airborne;
    if (air && !wasAir) {
      this.airStartT = this.time;
      this.airCrossings = 0;
      this.push({ type: 'air', t: this.time, phase: 'start', seconds: 0, crossings: 0 });
    } else if (!air && wasAir && this.airStartT >= 0) {
      const secs = this.time - this.airStartT;
      this.push({ type: 'air', t: this.time, phase: 'end', seconds: secs, crossings: this.airCrossings });
      (this.hud as any).setAirtime?.(null);
      this.airStartT = -1;
    }
    if (air && this.airStartT >= 0 && this.airCrossings > 0) (this.hud as any).setAirtime?.(this.time - this.airStartT);
  }

  private readonly hazardHooks: HazardHooks = {
    hurtPlayer: (amount, at, push) => {
      this.hurtPlayer(amount, at);
      this.player.body.vel.add(push);
      this.player.body.onGround = false;
      this.fx.sparks(at, _v2.copy(push).normalize(), COL_SPARK, 14);
    },
    hitEnemy: (e, amount, at, viaRift) => {
      const info: HitInfo = { source: 'hazard', amount, charged: true, from: at.clone(), dir: _v.subVectors(e.pos, at).setY(0).normalize().clone(), team: 'player', instigator: 'player' };
      this.fx.sparks(at, UP, COL_SPARK, 18);
      this.withKill({ laser: viaRift }, () => this.enemies.hit(e, info));
    },
  };

  /** A caught (charged) grenade goes off when it reaches a Kessler body: special delivery. */
  private detonateCaughtGrenades() {
    for (const pr of this.projectiles.list) {
      if (pr.kind !== 'grenade' || !pr.alive || !pr.charged || pr.age >= pr.life) continue;
      for (const e of this.enemies.list) {
        if (!e.alive || !this.zones.active.has(e.def.zone)) continue;
        if (pr.pos.y < e.pos.y - 0.3 || pr.pos.y > e.pos.y + e.height + 0.3) continue;
        if (Math.hypot(pr.pos.x - e.pos.x, pr.pos.z - e.pos.z) > e.radius + 0.55) continue;
        pr.age = pr.life; // explodes on the next projectile step
        break;
      }
    }
  }

  private keepPlayerOutOfEnemies() {
    const b = this.player.body;
    // a charged player rams through: physics' touch event resolves it (knock / kill)
    if (b.charge > 0 && b.vel.lengthSq() >= LAW.knockSpeed * LAW.knockSpeed) return;
    for (const e of this.enemies.list) {
      if (!e.alive || e.state === 'launched' || Math.abs(e.pos.y - b.pos.y) > 1.5) continue;
      const dx = b.pos.x - e.pos.x, dz = b.pos.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      const min = e.radius + FEEL.playerRadius;
      if (d < min && d > 1e-4) {
        b.pos.x = e.pos.x + (dx / d) * min;
        b.pos.z = e.pos.z + (dz / d) * min;
      }
    }
  }

  /** SHOVE: the dash staggers whatever it touches (0 damage, sets up rift kills). */
  private updateShove(dt: number) {
    if (this.shoveT <= 0) return;
    this.shoveT -= dt;
    const b = this.player.body;
    for (const e of this.enemies.list) {
      if (!e.alive || this.shoved.has(e.id)) continue;
      if (e.pos.distanceTo(b.pos) > e.radius + 1.0 || Math.abs(e.pos.y - b.pos.y) > 1.4) continue;
      this.shoved.add(e.id);
      this.enemies.stagger(e, LAW.shove.stagger, _v.copy(this.shoveDir).setY(0).normalize().multiplyScalar(4));
      this.fx.dust(e.pos, 0.5);
      this.audio.impact(e.pos, 6);
    }
    for (const pr of this.props.items) {
      if (!pr.alive || !pr.active || pr.hanging || pr.body.userData.manual) continue;
      if (pr.body.pos.distanceTo(b.pos) > pr.body.radius + 1.0) continue;
      pr.body.vel.addScaledVector(_v.copy(this.shoveDir).setY(0.2).normalize(), 7);
      pr.body.onGround = false;
      pr.touched = true;
    }
  }

  // ------------------------------------------------------------------
  // Rift verbs
  // ------------------------------------------------------------------

  private handPos() {
    const b = this.player.body;
    const f = this.player.forward(_v2);
    return _v.set(b.pos.x + f.x * 0.35 - f.z * 0.25, b.pos.y + 1.35, b.pos.z + f.z * 0.35 + f.x * 0.25).clone();
  }

  private trapTargets(): TrapTarget[] {
    // REACH: the PORTAL is for travel only (no hatch over a man, no load)
    if (this.lab && reachOn()) return [];
    const out = this.enemies.trapTargets().filter((tt) => {
      const e = this.enemies.byKey(tt.key);
      return !e || this.zones.active.has(e.def.zone);
    });
    return this.props.trapTargets(out);
  }

  private entranceCtx(targets: TrapTarget[]): EntranceContext {
    const ray = this.rig.aimRay();
    return {
      playerFeet: this.player.body.pos,
      playerVel: this.player.body.vel,
      playerYaw: this.rig.yaw,
      airborne: this.player.airborne,
      camPos: ray.origin,
      camDir: ray.dir,
      targets,
    };
  }

  private hangingUnderCrosshair(): Prop | null {
    const ray = this.rig.aimRay();
    let best: Prop | null = null, bd = 2.2;
    for (const pr of this.props.items) {
      if (!pr.alive || !pr.active || !pr.hanging) continue;
      const c = _v.copy(pr.body.pos).setY(pr.body.pos.y + pr.body.height * 0.5);
      const toC = _v2.subVectors(c, ray.origin);
      const along = toC.dot(ray.dir);
      if (along < 0 || along > LAW.trapdoorRange + 10) continue;
      const d = toC.addScaledVector(ray.dir, -along).length();
      if (d < bd) {
        bd = d;
        best = pr;
      }
    }
    return best;
  }

  private closeRifts() {
    if (!this.rifts.hasEntrance() && !this.rifts.hasExit()) return;
    const straddlers: { key: string; center: V3; radius: number }[] = [];
    for (const e of this.enemies.list) {
      if (!e.alive) continue;
      straddlers.push({ key: e.id !== undefined ? `enemy:${e.id}` : '', center: e.chest(new THREE.Vector3()), radius: e.radius });
    }
    for (const pr of this.props.items) {
      if (!pr.alive) continue;
      straddlers.push({ key: pr.key, center: pr.body.pos.clone().setY(pr.body.pos.y + pr.body.height * 0.5), radius: pr.body.radius });
    }
    const victims = this.rifts.close(straddlers);
    this.audio.ui('click');
    for (const v of victims) {
      this.fx.seam(v.at, _v.subVectors(this.camera.position, v.at).normalize(), 1.6);
      this.audio.shear(v.at);
      this.push({ type: 'shear', t: this.time, at: v.at.clone() });
      const e = this.enemies.byKey(v.key);
      if (e && e.alive) {
        const info: HitInfo = { source: 'shear', amount: e.kind === 'boss' ? 150 : 9999, charged: true, team: 'player', instigator: 'player', from: v.at.clone() };
        this.withKill({ byPlayer: true }, () => this.enemies.hit(e, info));
        continue;
      }
      const pr = this.props.byKey(v.key);
      if (pr) {
        if (pr.def.explosive) this.explodeProp(pr, { byPlayer: true });
        else if (pr.hanging) this.props.release(pr);
        else this.props.remove(pr);
      }
    }
    if (victims.length) {
      this.hitstop = Math.max(this.hitstop, 0.12);
      this.rig.shake = Math.max(this.rig.shake, 0.6);
    }
  }

  private updateCatchWindow() {
    if (this.catchWindow.t >= 0 && this.time - this.catchWindow.t > 0.6) {
      if (this.catchWindow.count > 0) this.push({ type: 'catch', t: this.time, count: this.catchWindow.count });
      this.catchWindow = { t: -1, count: 0 };
    }
  }

  // ------------------------------------------------------------------
  // Context action: hidden blade / hijack / lift / grab / throw
  // ------------------------------------------------------------------

  private contextAction(): { label: string; run: () => void } | null {
    const p = this.player;
    const b = p.body;
    if (this.respawnT >= 0) return null;
    // REACH: no blade, no grabs by hand: the WEAPON and the HAND do it all
    if (this.lab && reachOn()) return null;
    if (this.carried) return { label: t('prompt.throw'), run: () => this.throwCarried() };
    const f = p.forward(_v2);
    // HIDDEN BLADE: anyone in reach, or a lunge away ahead of you (the label stays through its cooldown)
    if (!p.isMantling()) {
      const bt = this.blade.pick(b.pos, f, _v3.set(Math.sin(this.rig.yaw), 0, Math.cos(this.rig.yaw)));
      if (bt) return { label: t('prompt.blade'), run: () => this.stab(bt.enemy) };
    }
    // HIJACK a Kessler gate
    for (const g of this.level.gates) {
      if (g.panel.distanceTo(b.pos) > 2.2 || this.rifts.isHijacked(g.id)) continue;
      return {
        label: t('prompt.hijack'),
        run: () => {
          if (!this.rifts.hasExit()) {
            this.hud.toast(t('gate.noExit'), 'warn');
            this.audio.ui('deny');
            return;
          }
          this.rifts.hijackGate(g.id); // events.hijacked announces it
        },
      };
    }
    // LIFT
    const lift = this.zones.liftAt(b.pos);
    if (lift && !lift.moving && lift.t < 0.5 && this.zones.liftReady(lift)) return { label: t('prompt.lift'), run: () => this.startLift(lift) };
    // GRAB a body or a light prop
    let best: DynBody | null = null, bd = 1.9;
    for (const q of this.physics.bodies) {
      if (!q.enabled || q.userData.manual) continue;
      const light = q.kind === 'corpse' || (q.kind === 'prop' && (() => {
        const pr = this.props.byBody(q);
        return !!pr && !pr.hanging && (pr.def.kind === 'barrel' || pr.def.kind === 'crate');
      })());
      if (!light) continue;
      const d = _v.subVectors(q.pos, b.pos);
      if (Math.abs(d.y) > 1.2) continue;
      d.y = 0;
      const dist = d.length();
      if (dist > bd || (dist > 0.6 && d.normalize().dot(f) < 0.2)) continue;
      bd = dist;
      best = q;
    }
    if (best) {
      const q = best;
      return { label: t('prompt.grab'), run: () => this.grab(q) };
    }
    return null;
  }

  /** The hidden blade springs out: strike now if he's right there, else lunge in (updateBlade strikes). */
  private stab(e: EnemyView) {
    if (!this.blade.ready) return;
    const p = this.player;
    _v.set(e.pos.x - p.body.pos.x, 0, e.pos.z - p.body.pos.z);
    if (_v.lengthSq() > 1e-6) p.yaw = Math.atan2(_v.x, _v.z);
    p.char.play('strike', { fade: 0.05, speed: 1.6 });
    if (this.blade.start(e, p.body.pos)) this.bladeHit(e);
    else p.lunge(_v, BLADE.lungeSpeed, this.blade.lunging!.t);
  }

  /** Per frame, after the player moved: steer a lunge onto him, strike when he's reached. */
  private updateBlade(dt: number) {
    const p = this.player;
    // dead (shot, fallen out): a lunge under way stops, and strikes no one
    if (this.respawnT >= 0 && this.blade.lunging) {
      this.blade.cancel();
      p.endLunge();
    }
    const L = this.blade.lunging;
    const r = this.blade.update(dt, p.body.pos, _v);
    if (r === 'go') p.lunge(_v, BLADE.lungeSpeed, L!.t);
    else if (r) {
      p.endLunge();
      if (r === 'strike') this.bladeHit(L!.enemy);
    }
    this.hero.setBlade(this.blade.extension());
  }

  /** The blade goes in (enemies.ts decides what it does to him): hitstop, a slow beat on a kill, sparks. */
  private bladeHit(e: EnemyView) {
    const p = this.player;
    p.yaw = Math.atan2(e.pos.x - p.body.pos.x, e.pos.z - p.body.pos.z);
    // PRECISION: the blade finishes the exposed (behind him, reeling, down, unaware, parried);
    // a man on his guard, facing you, turns it aside
    const finisher = precisionOn() && e.alive && e.kind !== 'boss';
    if (finisher && !this.isExposed(e)) {
      this.bladeGuarded(e);
      return;
    }
    const info: HitInfo = { source: 'blade', amount: 9999, charged: false, team: 'player', instigator: 'player', from: p.body.pos.clone() };
    const res = this.withKill({ byPlayer: true }, () => this.enemies.hit(e, info));
    this.audio.bladeFinish(e.pos);
    this.fx.sparks(e.chest(_v), null, COL_SPARK, 18);
    this.hitstop = Math.max(this.hitstop, 0.1);
    this.rig.kick = 1;
    if (res === 'killed' && this.slowT < 0.3) {
      this.slowT = 0.3;
      this.slowScale = 0.45;
    }
    if (finisher && res === 'killed') {
      // the FINISHER beat: a harder stop, a longer slow, a flare
      const B = PRECISION.blade;
      this.hitstop = Math.max(this.hitstop, B.hitstop);
      this.slowT = Math.max(this.slowT, B.slowT);
      this.slowScale = B.slowScale;
      this.rig.shake = Math.max(this.rig.shake, 0.35);
      const c = e.chest(_v);
      this.fx.flash(c, 5, 0.3, 0xffb050);
      this.fx.sparks(c, null, COL_SPARK, 30);
      this.fx.ring(c, 1.6, 0.3, COL_SPARK);
      this.renderer.grade.uniforms.uFlash.value = Math.max(this.renderer.grade.uniforms.uFlash.value, 0.45);
      this.hud.callout(t('prec.call.finisher'), 'finisher');
      this.exposedUntil.delete(e.id);
    }
  }

  // ------------------------------------------------------------------
  // PRECISION: parry, dodge, the blade's finisher (see precision.ts)
  // ------------------------------------------------------------------

  private resetPrecision() {
    this.meter.reset();
    this.power.reset();
    this.powerDwell.id = -1;
    this.powerAim = null;
    if (this.rig) this.rig.wide = 0;
    this.parry.reset();
    this.dodgeRun = null;
    this.dodgeCd = 0;
    this.dodgeSafeUntil = -1;
    this.exposedUntil.clear();
    if (this.player) this.player.char.root.visible = true;
  }

  /** Where you look, level (unit). */
  private lookFlat(out: THREE.Vector3) {
    return out.set(Math.sin(this.rig.yaw), 0, Math.cos(this.rig.yaw));
  }

  /** The PARRY rift's centre: at your chest, in front of you. */
  private parryPoint(out: THREE.Vector3) {
    const b = this.player.body;
    const f = this.lookFlat(_v3);
    return out.set(b.pos.x + f.x * 0.85, b.pos.y + this.player.height * 0.62, b.pos.z + f.z * 0.85);
  }

  /** Someone is fighting you (aware, in a live zone): no regen in PRECISION. */
  private underFire() {
    for (const e of this.enemies.list) if (e.alive && e.aware && this.zones.active.has(e.def.zone)) return true;
    return false;
  }

  /** The blade finishes him: he can't see it coming, or a dodge / a perfect parry opened him up. */
  private isExposed(e: EnemyView) {
    if (this.enemies.isHeld(e)) return true;
    if ((this.exposedUntil.get(e.id) ?? -1) >= this.time) return true;
    return exposedTo(e, this.player.body.pos);
  }

  /** RMB in PRECISION: the parry rift opens for its window (or it's still locked out). */
  private parryPress() {
    if (!this.parry.press()) return;
    const at = this.parryPoint(_v);
    this.audio.parryOpen(at);
    this.player.char.play('push', { fade: 0.04, speed: 2.2 });
    // the parry is a stance: whatever the blade was doing stops
    if (this.blade.lunging) {
      this.blade.cancel();
      this.player.endLunge();
    }
  }

  /**
   * A PARRY caught `p`: it goes back to whoever fired it, charged (a round or
   * a beam as a fast charged round, a grenade lobbed onto him). PERFECT: he
   * reels, and the blade finishes him while he does.
   */
  private parryCatch(p: Projectile) {
    const P = PRECISION.parry;
    const perfect = this.parry.perfect;
    const first = this.parry.caught === 0;
    this.parry.catch();
    const at = this.parryPoint(new THREE.Vector3());
    const look = this.lookFlat(new THREE.Vector3());
    const shooter = typeof p.owner === 'number' ? (this.enemies.get(p.owner) as Enemy | null) : null;
    const live = !!shooter && shooter.alive;
    const aim = live ? shooter!.chest(new THREE.Vector3()) : null;
    if (p.kind === 'grenade' && p.body) {
      // lobbed back onto him (or back the way it came), fused to go off on arrival
      const b = p.body;
      b.pos.set(at.x, at.y - b.radius, at.z);
      const tgt = aim ?? new THREE.Vector3().copy(at).addScaledVector(look, 12);
      const dx = tgt.x - at.x, dz = tgt.z - at.z;
      const d = Math.max(0.5, Math.hypot(dx, dz));
      const hs = THREE.MathUtils.clamp(d / 0.9, 10, 24);
      const tt = d / hs;
      const dy = tgt.y - at.y;
      b.vel.set((dx / d) * hs, (dy + 0.5 * LAW.gravity * tt * tt) / tt, (dz / d) * hs);
      b.onGround = false;
      p.charged = true;
      p.crossings++;
      p.life = p.age + tt + 0.5;
      this.reflected.add(p);
      this.parried.add(p);
    } else {
      const dir = aim ? aim.clone().sub(at).normalize() : new THREE.Vector3().copy(p.vel).normalize().negate();
      const nb = this.projectiles.fireBolt(at, dir, 'kessler', p.owner, { speed: P.speed, damage: P.damage });
      nb.charged = true;
      nb.crossings = 1;
      this.reflected.add(nb);
      this.parried.add(nb);
    }
    if (perfect && live) {
      this.enemies.stagger(shooter!, P.stagger);
      this.exposedUntil.set(shooter!.id, this.time + P.stagger);
    }
    // the feel: a hard stop, a flare, a ring, the sound, the word
    this.hitstop = Math.max(this.hitstop, first ? P.hitstop : P.hitstop * 0.5);
    this.parryView.flare();
    this.fx.flash(at, perfect ? 4 : 2.5, 0.2, 0x9ff8ff);
    this.fx.ring(at, perfect ? 1.8 : 1.2, 0.25, COL_CHARGED);
    this.fx.sparks(at, look, COL_CHARGED, perfect ? 26 : 16);
    this.renderer.grade.uniforms.uFlash.value = Math.max(this.renderer.grade.uniforms.uFlash.value, perfect ? 0.35 : 0.2);
    this.rig.kick = Math.max(this.rig.kick, perfect ? 0.9 : 0.6);
    this.audio.parry(at, perfect);
    if (first || perfect) this.hud.callout(t(perfect ? 'prec.call.perfect' : 'prec.call.parry'), perfect ? 'perfect' : 'parry');
    navigator.vibrate?.(perfect ? 35 : 20);
  }

  /** Per frame: a parried round stays on its shooter (sent back to him, not near him); grenades meet an open parry here. */
  private updateParried() {
    const open = this.parry.open && precisionOn() && this.hp > 0;
    const chest = open ? this.player.chest(new THREE.Vector3()) : null;
    const look = this.lookFlat(_v4);
    for (const p of this.projectiles.list) {
      if (!p.alive) continue;
      if (p.kind === 'bolt' && this.parried.has(p) && typeof p.owner === 'number') {
        const e = this.enemies.get(p.owner);
        if (!e || !e.alive) continue;
        const sp = p.vel.length();
        const c = e.chest(_v);
        if (sp > 1e-3 && c.distanceToSquared(p.pos) > 0.04) p.vel.copy(c).sub(p.pos).setLength(sp);
        continue;
      }
      if (chest && p.kind === 'grenade' && !p.charged && p.team === 'kessler') {
        const d = _v.subVectors(p.pos, chest);
        if (d.length() > PRECISION.parry.grenadeReach) continue;
        if (d.x * look.x + d.z * look.z < -0.3) continue;
        this.parryCatch(p);
      }
    }
  }

  /** V in PRECISION: down through a floor rift, up again `dodge.dist` m the way you move (else back). */
  private dodgePress(mx: number, my: number) {
    const p = this.player;
    const b = p.body;
    if (this.dodgeRun || this.dodgeCd > 0) return;
    if (p.airborne || p.isMantling() || this.carried) {
      this.audio.ui('deny');
      return;
    }
    const yaw = this.rig.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const dir = new THREE.Vector3(fx * my - fz * mx, 0, fz * my + fx * mx);
    if (dir.lengthSq() < 0.01) dir.set(-fx, 0, -fz);
    dir.normalize();
    const to = dodgeSpot(this.level.world, this.level, b.pos, dir, p.height);
    if (!to) {
      this.dodgeCd = 0.25;
      this.audio.ui('deny');
      this.hud.toast(t('prec.noDodge'), 'warn');
      return;
    }
    const D = PRECISION.dodge;
    this.dodgeRun = { from: b.pos.clone(), to, t: 0, up: false };
    this.dodgeCd = D.cooldown;
    this.dodgeSafeUntil = this.time + D.invuln;
    if (this.blade.lunging) {
      this.blade.cancel();
      p.endLunge();
    }
    // the floor opens under you, the other end opens where you'll come up
    const from = this.dodgeRun.from;
    this.fx.ring(_v.copy(from).setY(from.y + 0.04), 1.3, 0.3, COL_EXIT);
    this.fx.riftBurst(_v.copy(from).setY(from.y + 0.1), UP, COL_EXIT);
    this.fx.flash(_v.copy(from).setY(from.y + 0.5), 3, 0.18, 0x7ff4ff);
    this.fx.ring(_v.copy(to).setY(to.y + 0.04), 0.9, 0.22, COL_EXIT);
    this.audio.dodge(from, false);
    p.char.root.visible = false;
  }

  /** The DODGE under way (after the player moved): the body rides it; at the end you come up. */
  private updateDodge(dt: number) {
    const r = this.dodgeRun;
    if (!r) return;
    const b = this.player.body;
    if (this.respawnT >= 0) {
      this.dodgeRun = null;
      this.player.char.root.visible = true;
      return;
    }
    r.t += dt;
    const at = dodgeAt(r, _v);
    if (at) {
      b.pos.copy(at);
      b.vel.set(0, 0, 0);
      b.onGround = true;
      this.player.char.root.visible = false;
      return;
    }
    const D = PRECISION.dodge;
    this.dodgeRun = null;
    b.pos.copy(r.to);
    b.vel.set(0, D.pop, 0);
    b.onGround = false;
    this.player.char.root.visible = true;
    this.fx.ring(_v.copy(r.to).setY(r.to.y + 0.05), 1.5, 0.3, COL_EXIT);
    this.fx.riftBurst(_v.copy(r.to).setY(r.to.y + 0.1), UP, COL_EXIT);
    this.fx.dust(r.to, 0.6);
    this.audio.dodge(r.to, true);
    this.rig.kick = Math.max(this.rig.kick, 0.5);
    // came up behind a man: he's caught out
    for (const e of this.enemies.list) {
      if (!e.alive || !this.zones.active.has(e.def.zone) || e.kind === 'turret' || e.kind === 'boss') continue;
      if (Math.hypot(e.pos.x - r.to.x, e.pos.z - r.to.z) > D.behindRange + e.radius || Math.abs(e.pos.y - r.to.y) > 1.5) continue;
      if (!behind(e, r.to)) continue;
      this.enemies.stagger(e, D.behindStagger, _v2.set(e.pos.x - r.to.x, 0, e.pos.z - r.to.z).normalize().multiplyScalar(1.5));
      this.exposedUntil.set(e.id, this.time + D.exposed);
      this.fx.sparks(e.chest(_v2), null, COL_EXIT, 10);
      this.audio.impact(e.pos, 5);
    }
  }

  // ------------------------------------------------------------------
  // FLOW + POWER (see flow.ts)
  // ------------------------------------------------------------------

  /**
   * POWER: full, hold its key and time all but stops (the camera pulls out,
   * every man is lit); the crosshair marks (a click, or a thumb resting on a
   * man); let go and the chain runs, one rift-dash and a lethal strike per
   * mark. Nothing marked: time just runs again.
   */
  private updatePower(realDt: number, alive: boolean) {
    const inp = this.input;
    const P = this.power;
    const b = this.player.body;
    if (!alive && P.phase !== 'idle') {
      P.reset();
      return;
    }
    if (alive && inp.wasPressed('power')) {
      if (P.canBegin(this.meter.ready) && !this.portal.holding && !this.dodgeRun && this.respawnT < 0) {
        P.begin();
        this.powerDwell.id = -1;
        const c = this.player.chest(_v);
        this.audio.riftOpen(c, 'exit');
        this.audio.parryOpen(c);
        this.fx.ring(_v2.copy(b.pos).setY(b.pos.y + 0.05), 3.2, 0.5, COL_EXIT);
        this.renderer.grade.uniforms.uFlash.value = Math.max(this.renderer.grade.uniforms.uFlash.value, 0.6);
        this.rig.kick = Math.max(this.rig.kick, 0.8);
        navigator.vibrate?.(25);
      } else if (!this.meter.ready) this.audio.ui('deny');
    }
    this.powerAim = null;
    const taps = inp.consumeTaps();
    if (P.phase === 'held') {
      // untouchable while time is stopped (and through the chain)
      this.dodgeSafeUntil = Math.max(this.dodgeSafeUntil, this.time + FLOW.power.safe);
      // every lit man is markable; the crosshair snaps to the nearest one (no line of sight: rifts take you there)
      const cands = this.powerCandidates();
      const w = this.renderer.width, h = this.renderer.height;
      const aimId = pickMark(cands, w / 2, h / 2, FLOW.power.assist * h, P.marks);
      const e = aimId !== null ? this.enemies.get(aimId) : null;
      this.powerAim = e;
      const want: number[] = [];
      if (e && inp.wasPressed('portal')) want.push(e.id);
      // a thumb: resting the crosshair on him marks him
      if (e && inp.lastDevice === 'touch') {
        if (this.powerDwell.id !== e.id) this.powerDwell = { id: e.id, t: 0 };
        this.powerDwell.t += realDt;
        if (this.powerDwell.t >= FLOW.power.dwell) want.push(e.id);
      } else this.powerDwell.id = -1;
      // a finger: tapping a man marks him
      for (const tp of taps) {
        const id = pickMark(cands, tp.x, tp.y, FLOW.power.tapRadius, [...P.marks, ...want]);
        if (id !== null) want.push(id);
      }
      for (const id of want) {
        const m = this.enemies.get(id);
        if (!m || !P.mark(id)) continue;
        this.audio.laserLock(m.chest(_v));
        this.fx.ring(_v.copy(m.pos).setY(m.pos.y + 0.05), 1.4, 0.3, COL_ENTRANCE);
        this.hud.callout(t('flow.call.mark', { n: P.marks.length, max: FLOW.power.maxMarks }), 'parry');
        navigator.vibrate?.(12);
      }
    }
    const held = P.phase === 'held' && inp.isHeld('power');
    const r = P.update(realDt);
    if (P.phase === 'held' && (!held || r.expired)) {
      if (P.release()) {
        this.meter.spend();
        this.audio.riftPass(b.pos, 20);
        this.hud.callout(t('flow.call.power'), 'finisher');
      } else this.audio.riftClose(b.pos);
    }
    if (P.phase === 'chain') this.dodgeSafeUntil = Math.max(this.dodgeSafeUntil, this.time + FLOW.power.safe);
    if (r.strike !== null) this.powerStrike(r.strike, P.step);
    if (r.done) {
      // the chain is over: a slow beat, then you're running again
      this.slowT = Math.max(this.slowT, FLOW.power.afterT);
      this.slowScale = FLOW.power.afterScale;
      this.dodgeSafeUntil = Math.max(this.dodgeSafeUntil, this.time + FLOW.power.safe);
    }
  }

  /** The men POWER lights (alive, in play, in range), and where each is on screen (CSS px); behind the camera: none. */
  private powerCandidates(): PowerCandidate[] {
    const out: PowerCandidate[] = [];
    const me = this.player.body.pos;
    const w = this.renderer.width, h = this.renderer.height;
    for (const e of this.enemies.list) {
      if (!e.alive || !this.zones.active.has(e.def.zone) || e.pos.distanceTo(me) > FLOW.power.range) continue;
      const v = _v.copy(e.pos).setY(e.pos.y + e.height * 0.6).project(this.camera);
      if (v.z > 1 || v.z < -1) continue;
      out.push({ id: e.id, x: (v.x * 0.5 + 0.5) * w, y: (1 - (v.y * 0.5 + 0.5)) * h });
    }
    return out;
  }

  /** One link of the chain: through a rift to just past him, and he's done. */
  private powerStrike(id: number, n: number) {
    const e = this.enemies.get(id);
    if (!e || !e.alive) return;
    const P = FLOW.power;
    const p = this.player;
    const b = p.body;
    const from = b.pos.clone();
    const dir = new THREE.Vector3(e.pos.x - from.x, 0, e.pos.z - from.z);
    if (dir.lengthSq() < 1e-4) this.lookFlat(dir);
    dir.normalize();
    // where you come out: past him (room to stand), else this side of him, else on him
    const world = this.level.world;
    const reach = e.radius + P.past;
    const to = new THREE.Vector3();
    let found = false;
    // (room to stand, and a floor under it: never over the void or the pool)
    const floored = (x: number, z: number, y: number) => world.groundAt(x, z, FEEL.playerRadius * 0.6, y + 0.6) >= y - 0.6;
    for (const d of [reach, -reach]) {
      to.set(e.pos.x + dir.x * d, e.pos.y, e.pos.z + dir.z * d);
      if (!world.overlapsCylinder(to.x, to.z, FEEL.playerRadius, to.y + 0.15, to.y + FEEL.playerHeight) && floored(to.x, to.z, to.y)) {
        found = true;
        break;
      }
    }
    if (!found) to.copy(e.pos);
    // the rift you go in by, and the one you come out of
    this.fx.riftBurst(_v.copy(from).setY(from.y + 1), dir, COL_EXIT);
    this.fx.ring(_v.copy(from).setY(from.y + 0.05), 1.6, 0.3, COL_EXIT);
    this.audio.riftOpen(_v.copy(from).setY(from.y + 1), 'entrance');
    const yaw = Math.atan2(dir.x, dir.z);
    p.endLunge();
    p.teleport(to, yaw);
    // out of the dash at speed, unless the floor ends ahead (then you stop on it)
    const ahead = P.exitSpeed * 0.45;
    const go = floored(to.x + dir.x * ahead, to.z + dir.z * ahead, to.y) ? P.exitSpeed : 0;
    b.vel.set(dir.x * go, 2.5, dir.z * go);
    this.playerFling = false;
    this.powerYaw = yaw;
    this.fx.riftBurst(_v.copy(to).setY(to.y + 1), dir, COL_ENTRANCE);
    // the strike
    const c = e.chest(new THREE.Vector3());
    const info: HitInfo = { source: 'blade', amount: e.kind === 'boss' ? P.bossDamage : 9999, charged: false, team: 'player', instigator: 'player', from: from.clone(), dir: dir.clone() };
    this.withKill({ byPlayer: true }, () => this.enemies.hit(e, info));
    this.audio.riftPass(to, 22);
    this.audio.bladeFinish(c);
    this.audio.impact(c, 14);
    this.fx.sparks(c, dir, COL_SPARK, 34);
    this.fx.flash(c, 6, 0.3, 0x7ff4ff);
    this.fx.ring(c, 2.4, 0.35, COL_EXIT);
    this.hitstop = Math.max(this.hitstop, P.hitstop);
    this.rig.shake = Math.max(this.rig.shake, P.shake);
    this.rig.kick = 1;
    this.renderer.grade.uniforms.uFlash.value = Math.max(this.renderer.grade.uniforms.uFlash.value, 0.85);
    this.hud.callout(t('flow.call.strike', { n }), 'finisher');
    navigator.vibrate?.([30, 20, 45]);
  }

  /** FLOW's HUD: the POWER bar, the speed lines, the lit men while POWER is held. */
  private updateFlowHud(flow: boolean, realDt: number) {
    void realDt;
    const hud = this.lab?.hud;
    if (!hud || !flow) {
      hud?.setFlow(null);
      this.touch?.setFlow(null);
      return;
    }
    const b = this.player.body;
    const hs = Math.hypot(b.vel.x, b.vel.z);
    hud.setFlow({
      // (through the chain the bar shows the strikes still to come)
      meter: this.power.phase === 'chain' ? 1 - this.power.step / Math.max(1, this.power.marks.length) : this.meter.value,
      phase: this.power.phase,
      marks: this.power.marks.length,
      speed: THREE.MathUtils.clamp((hs - FLOW_SPRINT * 0.85) / 8, 0, 1),
    });
    if (this.power.phase === 'held') this.hud.setCrossHot(!!this.powerAim);
    this.touch?.setFlow({ fill: this.meter.value, ready: this.meter.ready && this.power.canBegin(true), held: this.power.phase === 'held', slide: b.onGround && hs >= FLOW.slide.minSpeed && this.player.slideT <= 0 });
  }

  /** The blade turned aside by a man on his guard: a clang, he reels a moment, you're pushed off. */
  private bladeGuarded(e: EnemyView) {
    const B = PRECISION.blade;
    const b = this.player.body;
    const c = e.chest(new THREE.Vector3());
    const away = _v.set(b.pos.x - e.pos.x, 0, b.pos.z - e.pos.z);
    if (away.lengthSq() < 1e-6) this.lookFlat(away).negate();
    away.normalize();
    this.audio.shieldClang(c);
    this.fx.sparks(c, away, COL_SPARK, 22);
    this.hitstop = Math.max(this.hitstop, 0.05);
    this.rig.shake = Math.max(this.rig.shake, 0.3);
    if (!e.armored) this.enemies.stagger(e, B.guardStagger, _v2.copy(away).multiplyScalar(-2.5));
    b.vel.x = away.x * B.guardPush;
    b.vel.z = away.z * B.guardPush;
    this.hud.callout(t('prec.call.guard'), 'guard');
  }

  /** PRECISION's HUD: the red crosshair on a man, the dodge pip, the parry rift, the relabelled keys. */
  private updatePrecisionHud(prec: boolean, realDt: number) {
    const v = activeVariant();
    if (v !== this.hudVariant) {
      this.hudVariant = v;
      this.strikeBar.setOverride('reflect', prec ? 'strike.parry' : null);
      this.touch?.setDodge(prec);
    }
    let hot = false;
    if (prec && this.respawnT < 0) {
      const H = this.portal.hold;
      if (H) hot = H.mode === 'grab' && !!H.launch && H.launch.aimAt >= 0;
      else hot = !!this.strikes.target() || this.hud.gateMode() === 'grab';
    }
    this.hud.setCrossHot(hot);
    this.hud.setDodge(prec ? this.dodgeCd / PRECISION.dodge.cooldown : null);
    this.parryView.update(prec ? this.parry.t : -1, this.parryPoint(_v), this.lookFlat(_v2), realDt, this.parry.until);
  }

  private grab(q: DynBody) {
    q.userData.manual = true;
    q.userData.carried = true;
    q.enabled = false;
    q.simulate = true;
    q.vel.set(0, 0, 0);
    this.carried = { body: q, prop: this.props.byBody(q) };
    this.player.carrying = q;
    this.player.char.play('pickUp', { fade: 0.1, speed: 1.6 });
    this.audio.ui('pickup');
  }

  private updateCarry() {
    const c = this.carried;
    if (!c) return;
    if (!c.body.userData.carried || (c.prop && !c.prop.alive)) {
      this.carried = null;
      this.player.carrying = null;
      return;
    }
    const b = this.player.body;
    const f = this.player.forward(_v);
    c.body.pos.set(b.pos.x + f.x * 0.75, b.pos.y + 0.55, b.pos.z + f.z * 0.75);
    c.body.vel.copy(b.vel);
    c.body.quat.setFromAxisAngle(UP, this.player.yaw);
  }

  private throwCarried() {
    const c = this.carried;
    if (!c) return;
    const b = this.player.body;
    const q = c.body;
    q.userData.manual = false;
    q.userData.carried = false;
    q.enabled = true;
    q.simulate = true;
    q.onGround = false;
    const f = this.player.forward(_v);
    const dir = _v2.copy(f).setY(0.3).normalize();
    // an open entrance right in front: throw straight into it
    const ends = this.rifts.playerEnds();
    if (ends.entrance && ends.entrance.isOpen) {
      const to = _v3.subVectors(ends.entrance.position, q.pos);
      if (to.length() < 5 && to.clone().setY(0).normalize().dot(f) > 0.4) dir.copy(to.normalize());
    }
    q.vel.copy(dir).multiplyScalar(10).add(_v.copy(b.vel).multiplyScalar(0.5));
    q.spin.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6);
    this.carried = null;
    this.player.carrying = null;
    this.player.char.play('push', { fade: 0.05, speed: 1.4 });
    this.audio.shove(b.pos);
  }

  private updatePropFuses(dt: number) {
    for (const pr of this.props.items) {
      if (!pr.alive || pr.fuse < 0) continue;
      pr.fuse -= dt;
      if (pr.fuse <= 0) {
        pr.fuse = -1;
        this.explodeProp(pr, { byBarrel: true });
      }
    }
  }

  // ------------------------------------------------------------------
  // Zones, encounters, lifts, gates
  // ------------------------------------------------------------------

  private onZoneEntered(id: ZoneId) {
    const z = this.zones.zone(id);
    for (const zz of this.zones.active) this.props.spawnZone(zz);
    this.props.setActive(this.zones.active);
    this.showZoneTitle(z);
    this.audio.sting(id === 'crown' ? 'boss' : 'zone');
    this.push({ type: 'zone', t: this.time, zone: id });
    this.saveProgress();
    this.updateObjective(true);
  }

  private triggerEncounter(e: EncounterState) {
    for (const def of e.def.spawns) {
      const v = this.enemies.spawn(def);
      // not expecting you yet: a fight you haven't reached doesn't wake from the one next door
      if (!e.engaged) v.sightScale = FEEL.unengagedSight;
      e.enemyIds.push(v.id);
    }
    if (e.def.lesson === 'hijack') for (const g of this.level.gates) if (g.zone === e.zone) this.rifts.setGateOpen(g.id, true);
  }

  private engageEncounter(e: EncounterState) {
    for (const id of e.enemyIds) {
      const v = this.enemies.get(id);
      if (v) v.sightScale = 1;
    }
    const key = this.zones.lessonHint(e);
    if (key) this.hint(key, t(key), 9);
  }

  private gateWaveT = new Map<string, { wave: number; t: number }>();

  /** A gate fight isn't over while its gates still have waves to send. */
  private wavesPending(enc: EncounterState) {
    if (enc.def.lesson !== 'hijack') return false;
    if (this.gateQueue.some((q) => q.enc === enc)) return true;
    return this.level.gates.some((g) => g.zone === enc.zone && (this.gateWaveT.get(g.id)?.wave ?? 0) < g.waves.length);
  }
  private updateGates(dt: number) {
    for (const g of this.level.gates) {
      if (!this.zones.active.has(g.zone)) continue;
      const enc = this.zones.encounters.find((x) => x.zone === g.zone && x.def.lesson === 'hijack');
      if (!enc || !enc.engaged || enc.cleared) continue;
      let s = this.gateWaveT.get(g.id);
      if (!s) {
        s = { wave: 0, t: 4 };
        this.gateWaveT.set(g.id, s);
      }
      if (s.wave >= g.waves.length) continue;
      s.t -= dt;
      if (s.t > 0) continue;
      // reinforcements step through the gate one by one (or through your exit if you hijacked it)
      if (!this.rifts.gateEnds(g.id).in) continue;
      const wave = g.waves[s.wave++];
      s.t = 9;
      wave.forEach((def, i) => this.gateQueue.push({ gate: g.id, def, enc, t: i * GATE_SPACING, wait: 0 }));
    }
    for (let i = this.gateQueue.length - 1; i >= 0; i--) {
      const q = this.gateQueue[i];
      q.t -= dt;
      if (q.t > 0) continue;
      const ends = this.rifts.gateEnds(q.gate);
      // hijacked but you have no exit right now: the gate has nowhere to send them, so they
      // step out of its arena end on foot (never stranded in the staging room)
      const stranded = this.rifts.isHijacked(q.gate) && !this.rifts.hasExit();
      // the next one comes through once the last is clear of where he comes out (a few
      // seconds at most): else he lands on him and is shoved back through the wall behind
      const out = stranded ? ends.out : ends.in?.linked;
      if (ends.in && !q.enc.cleared && out && q.wait < GATE_MOUTH_WAIT && this.mouthBusy(out)) {
        q.wait += dt;
        continue;
      }
      this.gateQueue.splice(i, 1);
      if (!ends.in || q.enc.cleared) continue;
      // (one at a time: the rest of his wave keep their spacing behind him)
      for (const o of this.gateQueue) if (o.gate === q.gate) o.t = Math.max(o.t, GATE_SPACING);
      const end = stranded && ends.out ? ends.out : ends.in;
      const off = stranded ? 0.9 : 0.55;
      const spawnPos = end.position.clone().addScaledVector(end.normal, off).setY(end.position.y - end.height / 2 + 0.02);
      const v = this.enemies.spawn({ ...q.def, pos: spawnPos, state: 'combat' });
      q.enc.enemyIds.push(v.id);
      // just in front of the in-end, hopping into it
      if (!stranded) this.enemies.launch(v, end.normal.clone().multiplyScalar(-4.5).setY(2.2));
    }
  }

  private gateQueue: { gate: string; def: SpawnDef; enc: EncounterState; t: number; wait: number }[] = [];

  /** Someone is standing (or lying) where a gate's arrivals come out of `end`. */
  private mouthBusy(end: RiftEnd) {
    const p = end.position;
    return this.enemies.list.some((o) => o.alive && Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < GATE_MOUTH && Math.abs(o.pos.y + 1 - p.y) < 2.5);
  }

  private liftCarry: { lift: LiftState; last: THREE.Vector3 } | null = null;
  private startLift(l: LiftState) {
    l.moving = true;
    l.dir = 1;
    this.audio.lift(l.def.mesh.position, true);
  }

  private updateLifts(dt: number) {
    for (const l of this.zones.lifts) {
      if (!l.moving) continue;
      const len = l.def.from.distanceTo(l.def.to);
      const onIt = this.zones.liftAt(this.player.body.pos) === l;
      l.t = THREE.MathUtils.clamp(l.t + (l.dir * dt * 3.2) / Math.max(1, len), 0, 1);
      const delta = this.syncLift(l);
      if (onIt) {
        this.player.body.pos.add(delta);
        this.player.body.vel.y = Math.max(0, this.player.body.vel.y);
      }
      if (l.dir > 0 && l.t >= 1) {
        l.moving = false;
        this.audio.lift(l.def.mesh.position, false);
        // it went up without you: it comes back down for you
        if (!onIt) {
          l.dir = -1;
          l.moving = true;
        }
      } else if (l.dir < 0 && l.t <= 0) {
        l.moving = false;
        l.dir = 1;
        this.audio.lift(l.def.mesh.position, false);
      }
    }
  }

  /** Puts a lift's cage and collider where its `t` says; returns how far it moved. */
  private syncLift(l: LiftState) {
    const k = l.t * l.t * (3 - 2 * l.t);
    const target = _v.copy(l.base).add(_v2.subVectors(l.def.to, l.def.from).multiplyScalar(k));
    const delta = _v3.subVectors(target, l.def.mesh.position);
    l.def.mesh.position.copy(target);
    if (delta.lengthSq() > 0) (this.level.world as any).moveCollider?.(l.def.collider, delta.x, delta.y, delta.z);
    return delta;
  }

  // ------------------------------------------------------------------
  // HUD helpers
  // ------------------------------------------------------------------

  private lastObjKey = '';
  private updateObjective(force: boolean) {
    // (the lab's panel says what's going on)
    if (this.lab) {
      this.lastObjKey = '';
      this.hud.setObjective('');
      return;
    }
    const o = this.zones.objective();
    const key = this.bossDead ? 'obj.escape' : o.key;
    if (!force && key === this.lastObjKey) return;
    this.lastObjKey = key;
    this.hud.setObjective(t(key), t(this.zones.current.nameKey));
  }

  private markerList: ScreenMarker[] = [];
  private updateMarkers() {
    const list = this.markerList;
    list.length = 0;
    const w = this.renderer.width, h = this.renderer.height;
    const project = (p: V3, kind: ScreenMarker['kind'], label?: string) => {
      const v = _v.copy(p).project(this.camera);
      const behind = v.z > 1;
      let x = (v.x * 0.5 + 0.5) * w, y = (1 - (v.y * 0.5 + 0.5)) * h;
      if (behind) {
        x = w - x;
        y = h - y;
      }
      const on = !behind && x > 30 && x < w - 30 && y > 30 && y < h - 30;
      const angle = Math.atan2(y - h / 2, x - w / 2);
      list.push({ x: THREE.MathUtils.clamp(x, 40, w - 40), y: THREE.MathUtils.clamp(y, 60, h - 60), onScreen: on, angle, kind, label });
    };
    for (const th of this.telegraphs) if (th.kind !== 'arc') project(th.from, 'threat');
    if (this.visionOn) {
      for (const e of this.enemies.list) if (e.alive && this.zones.active.has(e.def.zone)) project(_v2.copy(e.pos).setY(e.pos.y + e.height + 0.3), 'target', t(`state.${e.searching ? 'suspicious' : e.state}`));
      for (const g of this.level.gates) if (this.zones.active.has(g.zone)) project(g.panel, 'gate');
    }
    // FLOW's POWER held: every man in reach is lit; the marked ones are numbered
    if (this.lab && this.power.phase !== 'idle') {
      const me = this.player.body.pos;
      for (const e of this.enemies.list) {
        if (!e.alive || !this.zones.active.has(e.def.zone) || e.pos.distanceTo(me) > FLOW.power.range) continue;
        const i = this.power.marks.indexOf(e.id);
        project(_v2.copy(e.pos).setY(e.pos.y + e.height * 0.6), i >= 0 ? 'marked' : 'power', i >= 0 ? String(i + 1) : undefined);
      }
      this.hud.setMarkers(list);
      return;
    }
    // the lab: the last two of a wave are marked where they are
    if (this.lab) {
      const st = this.lab.standing();
      if (st.length && st.length <= 2 && this.lab.director.left === st.length)
        for (const e of st) project(_v2.copy(e.pos).setY(e.pos.y + e.height + 0.4), 'objective', `${Math.round(e.pos.distanceTo(this.player.body.pos))}m`);
      this.hud.setMarkers(list);
      return;
    }
    // (the last one or two of your fight are marked where they are, wherever they ended up)
    const o = this.zones.objective((id) => {
      const e = this.enemies.get(id);
      return e && e.alive ? e.pos : null;
    }, this.player.body.pos);
    if (o.target && !this.bossDead) project(o.target, 'objective', `${Math.round(o.target.distanceTo(this.player.body.pos))}m`);
    this.hud.setMarkers(list);
  }

  private telegraphN = 0;
  private meleeN = 0;

  /**
   * ONSLAUGHT's tells, solid (not added to what's behind: on a pale floor an
   * additive line washes out) and wide. RED melee: a wind-up's line, a rush's
   * lane (its centre and two edges a body apart), a slam's ring on the ground.
   * ORANGE gunfire: a lock's laser, a beam. Brighter as it comes. Returns the
   * next free segment.
   */
  private drawMelee(th: Game['telegraphs'][number], m: number) {
    const pos = this.meleeLines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = this.meleeLines.geometry.getAttribute('color') as THREE.BufferAttribute;
    const gun = th.kind === 'laser' || th.kind === 'beam';
    const k = (0.55 + 0.45 * th.t) * (th.kind === 'laser' ? 0.8 + 0.2 * Math.sin(this.time * 40) : 1);
    const cr = k * 1.6, cg = gun ? k * 0.75 : 0.06, cb = gun ? 0.02 : 0.04;
    const seg = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, fade = 1) => {
      if (m >= MELEE_SEGS) return;
      pos.setXYZ(m * 2, ax, ay, az);
      pos.setXYZ(m * 2 + 1, bx, by, bz);
      col.setXYZ(m * 2, cr, cg, cb);
      col.setXYZ(m * 2 + 1, cr * fade, cg * fade, cb * fade);
      m++;
    };
    const f = th.from, to = th.to;
    if (th.kind === 'slam') {
      // the reach, and an inner ring that closes out onto it as the blow comes
      const r = f.distanceTo(to);
      const segs = 24;
      for (const rr of [r, r * (0.35 + 0.65 * th.t)]) {
        for (let i = 0; i < segs; i++) {
          const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
          seg(f.x + Math.sin(a0) * rr, f.y, f.z + Math.cos(a0) * rr, f.x + Math.sin(a1) * rr, f.y, f.z + Math.cos(a1) * rr);
        }
      }
      return m;
    }
    const dx = to.x - f.x, dz = to.z - f.z, len = Math.hypot(dx, dz);
    if (!gun && len > 3.5) {
      const ox = (-dz / len) * 0.55, oz = (dx / len) * 0.55;
      for (const sg of [-1, 1]) seg(f.x + ox * sg, f.y, f.z + oz * sg, to.x + ox * sg, to.y, to.z + oz * sg, 0.35);
      // rungs across it, filling in toward him as the wind-up runs
      const rungs = 6;
      for (let i = 0; i < rungs; i++) {
        const u = (i + 1) / (rungs + 1);
        if (u > th.t + 0.05) break;
        const x = f.x + dx * u, z = f.z + dz * u, y = f.y + (to.y - f.y) * u;
        seg(x - ox, y, z - oz, x + ox, y, z + oz);
      }
    }
    seg(f.x, f.y, f.z, to.x, to.y, to.z);
    return m;
  }

  private drawTelegraphs() {
    const pos = this.telegraphLines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = this.telegraphLines.geometry.getAttribute('color') as THREE.BufferAttribute;
    let n = 0;
    let m = 0;
    let arc: (typeof this.telegraphs)[number] | null = null;
    // ONSLAUGHT keeps its colours apart: ORANGE gunfire (parry it), RED melee (dodge it)
    const ons = onslaughtOn();
    for (const th of this.telegraphs) {
      if (th.kind === 'arc') {
        arc = th;
        continue;
      }
      if (th.kind === 'slam' || th.kind === 'melee' || (ons && (th.kind === 'laser' || th.kind === 'beam'))) {
        m = this.drawMelee(th, m);
        continue;
      }
      if (n >= TELEGRAPH_SEGS) break;
      const k = th.kind === 'beam' ? 1 + th.t * 3 : 2.5;
      pos.setXYZ(n * 2, th.from.x, th.from.y, th.from.z);
      pos.setXYZ(n * 2 + 1, th.to.x, th.to.y, th.to.z);
      const pulse = th.kind === 'laser' ? 0.6 + 0.4 * Math.sin(this.time * 40) : 1;
      const r = k * pulse;
      // (ONSLAUGHT's gunfire in orange; everywhere else the lasers stay as they were)
      const gun = ons && (th.kind === 'laser' || th.kind === 'beam');
      col.setXYZ(n * 2, r, gun ? r * 0.42 : 0.12, gun ? 0.03 : 0.08);
      col.setXYZ(n * 2 + 1, r, gun ? r * 0.42 : 0.12, gun ? 0.03 : 0.08);
      n++;
    }
    this.telegraphLines.geometry.setDrawRange(0, n * 2);
    this.meleeLines.geometry.setDrawRange(0, m * 2);
    if (m > 0 || this.meleeN > 0) {
      this.meleeLines.geometry.getAttribute('position').needsUpdate = true;
      this.meleeLines.geometry.getAttribute('color').needsUpdate = true;
    }
    this.meleeN = m;
    // (no telegraphs now and none last frame: nothing to upload)
    if (n > 0 || this.telegraphN > 0) {
      pos.needsUpdate = true;
      col.needsUpdate = true;
    }
    this.telegraphN = n;
    // grenade arc preview
    if (arc) {
      const ap = this.arcLine.geometry.getAttribute('position') as THREE.BufferAttribute;
      const from = arc.from, to = arc.to;
      const T = 1.0;
      const vx = (to.x - from.x) / T, vz = (to.z - from.z) / T, vy = (to.y - from.y + 0.5 * LAW.gravity * T * T) / T;
      for (let i = 0; i < 64; i++) {
        const s = (i / 63) * T;
        ap.setXYZ(i, from.x + vx * s, from.y + vy * s - 0.5 * LAW.gravity * s * s, from.z + vz * s);
      }
      ap.needsUpdate = true;
      this.arcLine.computeLineDistances();
      this.arcLine.visible = true;
    } else this.arcLine.visible = false;
  }

  // ------------------------------------------------------------------
  // Replay, clips, photo
  // ------------------------------------------------------------------

  private exporterOk() {
    return this.recorder.frames().length > 30;
  }

  /** Snapshot of everything visible (for the replay ring buffer). */
  private capture(): Snapshot {
    const b = this.player.body;
    const cam = this.camera;
    const actors: ActorSnap[] = [{ key: 'player', pos: [b.pos.x, b.pos.y, b.pos.z], yaw: this.player.yaw, pose: this.player.char.getPose(), visible: this.player.char.root.visible, blade: this.blade.extension() }];
    for (const a of this.enemies.snapshot()) actors.push(a);
    const projs: ProjSnap[] = [];
    for (const pr of this.projectiles.list) {
      if (!pr.alive) continue;
      const s: ProjSnap = { kind: pr.kind, pos: [pr.pos.x, pr.pos.y, pr.pos.z], charged: pr.charged };
      if (pr.kind === 'beam') s.to = pr.segments.map((sg) => [sg.to.x, sg.to.y, sg.to.z] as [number, number, number]);
      projs.push(s);
    }
    return {
      t: this.time,
      cam: { pos: [cam.position.x, cam.position.y, cam.position.z], quat: [cam.quaternion.x, cam.quaternion.y, cam.quaternion.z, cam.quaternion.w], fov: cam.fov },
      actors,
      rifts: this.rifts.snapshot(),
      projs,
      props: this.props.snapshot(),
      tricks: [],
      timeScale: this.timeScale,
      focus: [b.pos.x, b.pos.y, b.pos.z],
    };
  }

  private applySnap(s: Snapshot) {
    const cam = this.camera;
    cam.position.set(s.cam.pos[0], s.cam.pos[1], s.cam.pos[2]);
    cam.quaternion.set(s.cam.quat[0], s.cam.quat[1], s.cam.quat[2], s.cam.quat[3]);
    if (Math.abs(cam.fov - s.cam.fov) > 0.01) {
      cam.fov = s.cam.fov;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
    const enemySnaps: ActorSnap[] = [];
    for (const a of s.actors) {
      if (a.key === 'player') {
        const root = this.player.char.root;
        root.position.set(a.pos[0], a.pos[1], a.pos[2]);
        root.rotation.y = a.yaw;
        root.visible = a.visible;
        this.player.char.setPose(a.pose);
        this.hero.setBlade(a.blade ?? 0);
      } else enemySnaps.push(a);
    }
    this.enemies.applySnapshot(enemySnaps);
    this.rifts.applySnapshot(s.rifts);
    this.props.applySnapshot(s.props);
    // projectiles
    const m = new THREE.Matrix4();
    let n = 0;
    const bp = this.replayBeams.geometry.getAttribute('position') as THREE.BufferAttribute;
    let bn = 0;
    for (const p of s.projs) {
      if (p.kind === 'beam' && p.to) {
        let prev = p.pos;
        for (const q of p.to) {
          if (bn >= 16) break;
          bp.setXYZ(bn * 2, prev[0], prev[1], prev[2]);
          bp.setXYZ(bn * 2 + 1, q[0], q[1], q[2]);
          prev = q;
          bn++;
        }
        continue;
      }
      if (n >= 64) continue;
      m.makeTranslation(p.pos[0], p.pos[1], p.pos[2]);
      this.replayProj.setMatrixAt(n, m);
      this.replayProj.setColorAt(n, p.charged ? COL_CHARGED : COL_SPARK);
      n++;
    }
    this.replayProj.count = n;
    this.replayProj.instanceMatrix.needsUpdate = true;
    if (this.replayProj.instanceColor) this.replayProj.instanceColor.needsUpdate = true;
    this.replayBeams.geometry.setDrawRange(0, bn * 2);
    bp.needsUpdate = true;
  }

  private replayHost(): ReplayHost {
    return {
      camera: this.camera,
      canvas: this.renderer.renderer.domElement,
      apply: (s) => this.applySnap(s),
      render: () => this.render(0),
      beginReplay: () => {
        this.liveSnap = this.capture();
        // live-only overlays (lock lasers, grenade arcs, the aim preview) would hang frozen in the clip
        this.telegraphLines.visible = false;
        this.meleeLines.visible = false;
        this.arcWasVisible = this.arcLine.visible;
        this.arcLine.visible = false;
        // (a throw's arc, or a tap's preview on the man under the crosshair: the next live frame redraws it)
        this.arcView.points.visible = false;
        this.rifts.updatePreview(null, this.handPos(), this.camera);
        this.projectiles.group.visible = false;
        this.replayProj.visible = true;
        this.replayBeams.visible = true;
        this.hud.show(false);
        this.touch?.show(false);
      },
      endReplay: () => {
        if (this.liveSnap) this.applySnap(this.liveSnap);
        this.liveSnap = null;
        this.telegraphLines.visible = true;
        this.meleeLines.visible = true;
        this.arcLine.visible = this.arcWasVisible;
        this.projectiles.group.visible = true;
        this.replayProj.visible = false;
        this.replayBeams.visible = false;
      },
      lineOfSight: (a, b) => this.level.world.lineOfSight(a, b),
    };
  }

  startReplay() {
    if (this.mode !== 'playing') return;
    const now = this.time;
    const frames = this.clipOfferT > 0 && this.clipFrames?.length ? this.clipFrames : this.recorder.frames(now - 10, now);
    if (frames.length < 10) return;
    this.hud.offerClip(false);
    this.touch?.offerClip(false);
    this.clipOfferT = 0;
    this.mode = 'replay';
    this.audio.ui('clip');
    const record = this.exporter.supported();
    this.replay.translate = (k: string) => t(k);
    this.replay.play(frames, { cinematic: true, overlay: record });
    if (record && !this.exporter.begin(this.renderer.renderer.domElement, this.replay.overlayCanvas)) this.exporter.cancel();
  }

  private updateReplay(realDt: number) {
    this.updateAmbient(realDt);
    this.fx.update(realDt);
    const still = this.replay.update(realDt);
    if (this.exporter.recording) this.exporter.frame();
    if (still && !this.input.wasPressed('pause')) return;
    const skipped = still;
    this.replay.stop();
    if (skipped || !this.exporter.recording) {
      // skipped, or nothing was recorded (no MediaRecorder): straight back to play
      if (this.exporter.recording) this.exporter.cancel();
      this.mode = 'playing';
      this.hud.show(true);
      this.touch?.show(true);
      this.input.consumeLook();
      return;
    }
    this.mode = 'paused';
    // the clip panel needs the pointer back (desktop)
    this.input.active = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.input.releaseAll();
    const done = (blob: Blob | null) => {
      this.onClip(
        blob,
        () => {
          if (blob)
            void this.exporter.share(blob, 'threshold-clip').then((r) => {
              if (r === 'failed' && this.exporter.shareCancelled) return;
              this.hud.toast(t(r === 'failed' ? 'toast.clipFailed' : 'toast.clipSaved'), r === 'failed' ? 'warn' : 'good');
            });
        },
        () => {
          this.hud.show(true);
          this.resume();
        },
      );
    };
    if (this.exporter.recording) void this.exporter.end().then(done);
    else done(null);
  }

  /** Pause menu → photo mode. */
  photoFromPause() {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.enterPhoto();
  }

  private enterPhoto() {
    if (this.mode !== 'playing') return;
    this.mode = 'photo';
    this.hud.show(false);
    this.touch?.show(false);
    this.photoUi.show(true);
    this.input.active = true;
    this.photo.enter(this.camera, this.player.body.pos.clone().setY(this.player.body.pos.y + 1));
    this.audio.ui('click');
  }

  private updatePhoto(realDt: number) {
    const look = this.input.consumeLook();
    const wheel = this.input.consumeWheel();
    // (a wheel notch is ~15% closer; the photo camera reads zoom as a rate)
    this.photo.update(realDt, { lookX: look.x, lookY: -look.y, moveX: this.input.moveX, moveY: this.input.moveY, zoom: (wheel + this.photoUi.consumePinch()) * 6 + this.photoUi.zoom * 1.2 });
    this.updateAmbient(0);
    this.render(realDt);
    if (this.photoUi.consumeSnap() || this.input.wasPressed('portal') || this.input.wasPressed('action')) {
      this.photoUi.flash();
      this.audio.ui('shutter');
      void this.photo.capture(this.renderer.renderer.domElement, () => this.renderFull()).then((blob) => {
        if (blob)
          void this.exporter.share(blob, 'threshold-photo').then((r) => {
            if (r === 'failed') {
              if (!this.exporter.shareCancelled) this.hud.toast(t('toast.clipFailed'), 'warn');
            } else this.hud.toast(t('toast.photoSaved'), 'good');
          });
      });
    }
    if (this.photoUi.consumeExit() || this.input.wasPressed('photo') || this.input.wasPressed('pause')) {
      this.photo.exit();
      this.photoUi.show(false);
      this.input.consumeLook();
      this.mode = 'playing';
      this.hud.show(true);
      this.touch?.show(true);
    }
  }

  // ------------------------------------------------------------------
  // End
  // ------------------------------------------------------------------

  private victory() {
    if (this.victoryT >= 0) return;
    // (the crown's challenge is for the leap after Voss: a world that ends on a train doesn't award it)
    if (this.bossDead) this.challenges.complete('crown.3');
    this.victoryT = 2.2;
    this.slowT = 2.2;
    this.slowScale = 0.3;
    this.audio.sting('victory');
  }

  private finishRun() {
    this.mode = 'ended';
    this.hud.show(false);
    this.touch?.show(false);
    this.input.active = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.style.state.bestCombo);
    this.stats.styleTotal = this.style.state.total;
    if (this.lab && this.labStats) this.onLabEnd(this.labStats);
    else this.onEnd(true, this.stats, this.style.state.rank);
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  /** One render at full resolution whatever the dynamic scale (a photo). */
  private fullRes = false;
  private renderFull() {
    this.fullRes = true;
    try {
      this.render(0);
    } finally {
      this.fullRes = false;
    }
  }

  /** Point sprites are sized in render pixels: kept at their intended size at any pixel ratio / dynamic scale. */
  private pixelScale = -1;
  private syncPixelScale(force = false) {
    const R = this.renderer;
    const dpr = R.renderer.getPixelRatio();
    const k = dpr * R.renderScale;
    if (!force && k === this.pixelScale) return;
    this.pixelScale = k;
    this.fx.setPixelRatio(k);
    // (rift sparks: phones at 2x keep their size; desktops as they always were)
    SPARK_PX.value = (IS_TOUCH ? dpr : 1) * R.renderScale;
    // (desktops keep their GL lines: they look as they always did)
    for (const l of this.wideLines) l.enabled = IS_TOUCH && dpr > 1.25;
  }

  private render(realDt: number) {
    const r = this.renderer.renderer;
    beginRenderFrame();
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    this.effectLights?.update();
    const R = this.renderer;
    // dynamic resolution adapts in play only (menus, pause and replays keep the scale they have);
    // a clip being recorded is full resolution
    R.dynres.active = this.mode === 'playing';
    R.forceFull = this.exporter.recording || this.fullRes;
    this.syncPixelScale();
    // (after a resize or a quality change: the windows' targets before a rift needs them)
    if (this.mode !== 'menu') this.rifts.preallocate(R.width, R.height, R.renderer.getPixelRatio());
    const sw = R.sceneWidth, sh = R.sceneHeight;
    for (const l of this.wideLines) l.sync(sw, sh, R.renderer.getPixelRatio() * R.renderScale);
    this.meleeWide?.sync(sw, sh, R.renderer.getPixelRatio() * R.renderScale);
    // every transform of the frame is set: world matrices once, for the rift views and the main view alike
    this.scene.updateMatrixWorld();
    if (this.mode !== 'menu') this.rifts.renderViews(this.camera, R.width, R.height, this.helpers, sw, sh);
    // (FLOW's POWER moment: the same cold, drained grade, harder while time is stopped)
    const ph = this.power?.phase;
    const pw = ph === 'held' ? 1.45 : ph === 'chain' ? 1 : 0;
    this.renderer.grade.uniforms.uFocus.value = Math.max(this.rifts.aiming ? 1 : 0, pw);
    this.renderer.grade.uniforms.uFlash.value = Math.max(0, this.renderer.grade.uniforms.uFlash.value - realDt * 3);
    this.renderer.grade.uniforms.uDamage.value = this.mode === 'playing' ? THREE.MathUtils.clamp(1 - this.hp / 45, 0, 1) * 0.6 : 0;
    this.renderer.render(realDt);
  }
}

export type { Team };
