import * as THREE from 'three';
import { FEEL, IS_TOUCH, QualityName } from '../config';
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
  type Team,
  type Threat,
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
import { createSky, createSkyEnvMap, createSkyline, LampSystem } from '../render/fx';
import { buildTower, type TowerBuild } from '../world/tower';
import { CameraRig } from './camera';
import { Character, type AnimLibrary, type CharacterAsset, type Look } from './characters';
import { Player, type PlayerEvents, type PlayerInput } from './player';
import { RiftSystem } from './portals';
import { orientFrame } from './portalMath';
import { Physics } from '../sim/physics';
import { Projectiles } from '../sim/projectiles';
import { EnemySystem, type Enemy } from '../actors/enemies';
import { PropSystem, type Prop } from './props';
import { ZoneManager, type EncounterState, type LiftState } from './zones';
import { FxKit } from './fxkit';
import { HUD } from '../ui/hud';
import { addStrings, setDevice, t } from '../ui/i18n';
import type { RunStats } from '../ui/menu';
import { StyleSystem } from '../meta/style';
import { ReplayPlayer, ReplayRecorder } from '../meta/replay';
import { ClipExporter } from '../meta/clip';
import { PhotoMode } from '../meta/photo';
import { ChallengeSystem } from '../meta/challenges';
import { META_STRINGS } from '../meta/strings';
import { LEAD_STRINGS } from './strings';

export interface Settings {
  quality: QualityName;
  sensitivity: number;
  invertY: boolean;
  slowmo: boolean;
}

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
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const COL_EXIT = new THREE.Color(0.25, 1.6, 2.2);
const COL_ENTRANCE = new THREE.Color(2.4, 1.2, 0.3);
const COL_CHARGED = new THREE.Color(0.3, 1.6, 2.4);
const COL_SPARK = new THREE.Color(2.6, 1.6, 0.7);

const LOOKS: Record<EnemyKind, Look> = {
  rifleman: 'rifleman',
  grenadier: 'grenadier',
  warden: 'warden',
  brute: 'brute',
  sniper: 'sniper',
  jammer: 'jammer',
  turret: 'rifleman',
  boss: 'boss',
};

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
  zones!: ZoneManager;
  physics!: Physics;
  rifts!: RiftSystem;
  projectiles!: Projectiles;
  enemies!: EnemySystem;
  props!: PropSystem;
  fx: FxKit;
  player!: Player;
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
  private telegraphs: { kind: 'laser' | 'beam' | 'arc' | 'charge'; from: THREE.Vector3; to: THREE.Vector3; t: number }[] = [];
  private telegraphLines: THREE.LineSegments;
  private arcLine: THREE.Line;
  private killCtx: KillCtx | null = null;
  private clipOfferT = 0;
  private clipFrames: Snapshot[] | null = null;
  private visionOn = false;
  private helpers: THREE.Object3D[] = [];
  private asset!: CharacterAsset;
  private anims!: AnimLibrary;
  private hintsSeen = new Set<string>();
  private liveSnap: Snapshot | null = null;
  private replayProj: THREE.InstancedMesh;
  private replayBeams: THREE.LineSegments;
  private bossDead = false;
  private victoryT = -1;
  private tricksSeen = new Set<string>();
  private lastDevice = '';
  private menuT = 0;
  private zoneStartT = 0;

  stats: RunStats = { time: 0, kills: 0, bestCombo: 0, styleTotal: 0, tricks: 0, deaths: 0, challenges: 0 };
  onPause: () => void = () => {};
  onEnd: (win: boolean, stats: RunStats, rank: string) => void = () => {};
  /** Clip ready (blob may be null when recording isn't supported: replay only). */
  onClip: (blob: Blob | null, share: () => void, close: () => void) => void = (_b, _s, close) => close();

  constructor(private canvas: HTMLCanvasElement, private uiRoot: HTMLElement, settings: Settings) {
    this.settings = settings;
    this.renderer = new Renderer(canvas, settings.quality, this.scene, this.camera);
    this.input = new Input(canvas);
    this.input.sensitivity = settings.sensitivity;
    this.input.invertY = settings.invertY;
    this.hud = new HUD(uiRoot);
    this.hud.show(false);
    this.hud.onClip = () => this.startReplay();
    if (IS_TOUCH) {
      this.touch = new TouchControls(this.input, uiRoot);
      this.touch.show(false);
      this.input.lastDevice = 'touch';
    }
    for (const lang of ['en', 'he'] as const) {
      addStrings(lang, (META_STRINGS as any)[lang] ?? {});
      addStrings(lang, LEAD_STRINGS[lang]);
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
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 6), 3).setUsage(THREE.DynamicDrawUsage));
    lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(48 * 6), 3).setUsage(THREE.DynamicDrawUsage));
    this.telegraphLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.telegraphLines.frustumCulled = false;
    this.scene.add(this.telegraphLines);
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
  }

  // ------------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------------

  async load(asset: CharacterAsset, anims: AnimLibrary) {
    this.asset = asset;
    this.anims = anims;
    const r = this.renderer.renderer;
    const mobile = IS_TOUCH;
    // image-based light from the golden-hour sky itself
    const envMap = createSkyEnvMap(r);
    this.scene.environment = envMap;
    this.level = buildTower(envMap, mobile) as TowerBuild;
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
    const skyline = createSkyline({ mobile, sunDir: this.level.sunDir });
    this.skyline = skyline;
    this.scene.add(skyline);
    const sunU = (this.sky.material as THREE.ShaderMaterial).uniforms.uSunDir;
    if (sunU) sunU.value.copy(this.level.sunDir);
    const preset = this.renderer.preset;
    this.sun.shadow.mapSize.set(preset.shadowMap, preset.shadowMap);
    if (this.level.lamps.length) {
      this.lamps = new LampSystem(this.level.lamps, Math.min(preset.lampLights, 4), false);
      this.scene.add(this.lamps.group);
    }

    this.zones = new ZoneManager(this.level);
    const world = this.level.world;
    this.rifts = new RiftSystem(this.scene, r, world, {
      portalScale: preset.portalScale,
      lightCount: mobile ? 2 : 4,
      maxViews: preset.portalViews,
      outcomeAt: (x, z, groundY) => {
        if (groundY > -Infinity) return null;
        return this.level.isSea(_v3.set(x, 0, z)) ? 'splash' : 'void';
      },
    });
    this.physics = new Physics(world, this.rifts, {
      seaY: this.level.seaY,
      isSea: (p) => this.level.isSea(p),
      // stacked zones: a body falling off a floor lands on the one below (the yard / the sea);
      // only far outside the tower is it lost
      killYAt: () => this.level.seaY - 30,
    });
    this.projectiles = new Projectiles(world, this.rifts, this.physics, this.projectileHooks());
    this.scene.add(this.projectiles.group);
    this.enemies = new EnemySystem(this.physics, this.enemyHooks(), (kind) => new Character(asset, anims, LOOKS[kind]));
    this.scene.add(this.enemies.group);
    for (const z of this.level.zones) this.enemies.setNav(z.id, z.nav, world);
    if (this.level.bossArena) (this.enemies as any).setBossArena?.(this.level.bossArena.center, this.level.bossArena.radius, this.level.bossArena.blinkPoints);
    for (const g of this.level.gates) this.rifts.addGate(g.id, g.inFrame, g.outFrame);
    this.props = new PropSystem(this.physics, this.level);
    this.scene.add(this.props.group);

    // player
    const heroChar = new Character(asset, anims, 'hero');
    const body = this.physics.createBody('player', { pos: this.zones.current.playerStart.clone(), radius: FEEL.playerRadius, height: FEEL.playerHeight, team: 'player', simulate: true });
    body.userData.manual = true;
    this.player = new Player(heroChar, body);
    this.scene.add(heroChar.root);

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
    this.helpers.push(ghost.root, this.telegraphLines, this.arcLine);

    this.replay = new ReplayPlayer(this.replayHost());

    // pre-compile every shader variant (incl. clipped rift views) so nothing hitches mid-fight
    r.compile(this.scene, this.camera);
    const tmp = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
    r.setRenderTarget(tmp);
    r.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 10)];
    r.render(this.scene, this.camera);
    r.clippingPlanes = [];
    r.setRenderTarget(null);
    tmp.dispose();
    this.newRun();
  }

  applySettings(s: Settings) {
    const qualityChanged = s.quality !== this.settings.quality;
    this.settings = s;
    this.input.sensitivity = s.sensitivity;
    this.input.invertY = s.invertY;
    if (qualityChanged) {
      this.renderer.applyQuality(s.quality);
      this.rifts?.setPortalScale(this.renderer.preset.portalScale);
      if (this.rifts) this.rifts.maxViews = this.renderer.preset.portalViews;
      this.fx.setPixelRatio(this.renderer.renderer.getPixelRatio());
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
    this.gateWaveT.clear();
    this.gateQueue.length = 0;
    this.challenges.setZone(id);
    this.stats = { time: 0, kills: 0, bestCombo: 0, styleTotal: 0, tricks: 0, deaths: 0, challenges: 0 };
    this.tricksSeen.clear();
    for (const g of this.level.gates) this.rifts.setGateOpen(g.id, false);
    for (const z of this.zones.active) this.props.spawnZone(z);
    const cp = this.zones.checkpoint;
    this.respawnPlayer(cp.pos, cp.yaw);
    this.bossDead = false;
    this.victoryT = -1;
    this.hintsSeen.clear();
    this.zoneStartT = this.time;
    this.style.reset();
    this.clearHints();
    this.updateObjective(true);
  }

  private respawnPlayer(pos: V3, yaw: number) {
    this.player.teleport(pos.clone(), yaw);
    this.player.body.charge = 0;
    this.hp = LAW.player.hp;
    this.carried = null;
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
    this.showZoneTitle(z);
    this.audio.sting('zone');
    if (z.id === 'pier' && !this.hintsSeen.has('rules')) {
      this.hintsSeen.add('rules');
      this.hint('rules', `<b>${t('rule.1')}</b><br>${t('rule.2')}<br>${t('rule.3')}`, 9);
    }
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.touch?.show(false);
    this.input.active = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.onPause();
  }

  resume() {
    this.mode = 'playing';
    this.touch?.show(true);
    this.input.active = true;
    this.input.requestLock();
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

  refreshObjectives() {
    this.updateObjective(true);
  }

  /** Death / fell out: back to the checkpoint, uncleared fights reset. */
  private respawn(died: boolean) {
    if (died) this.stats.deaths++;
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
    const cp = this.zones.checkpoint;
    this.respawnPlayer(cp.pos, cp.yaw);
    this.respawnT = -1;
    this.timeScale = 1;
    this.push({ type: 'death', t: this.time });
  }

  private saveProgress() {
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

  private hint(key: string, html: string, dur = 7) {
    if (this.hintsSeen.has('h:' + key)) return;
    this.hintsSeen.add('h:' + key);
    this.hintQueue.push({ key, html, dur });
  }

  /** Hints take turns (each gets a few seconds) and wait for the zone title card. */
  private hintQueue: { key: string; html: string; dur: number }[] = [];
  private hintHold = 0;
  private updateHints(realDt: number) {
    this.hintHold -= realDt;
    if (this.hintHold > 0 || !this.hintQueue.length) return;
    const h = this.hintQueue.shift()!;
    this.hud.hint(h.key, h.html, h.dur);
    this.hintHold = Math.min(h.dur, 4.5);
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
    const done = this.challenges.push(e as GameEvent, awards, this.style.state);
    for (const id of done) {
      this.stats.challenges++;
      this.hud.toast(`${t('toast.challenge')}: ${t(`challenge.${id}.title`)}`, 'good');
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
      steer: (p, at, dir) => {
        const e = this.assistTarget(at, dir, p.owner);
        if (!e) return false;
        dir.set(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z).sub(at).normalize();
        return true;
      },
      onCross: (p, from, to) => {
        if (p.kind === 'bolt') this.steerReturned(p);
        else if (p.kind === 'grenade') this.steerCaughtGrenade(p);
        this.fx.riftBurst(to.position, to.normal, COL_CHARGED);
        this.push({ type: 'cross', t: this.time, who: p.kind === 'grenade' ? 'grenade' : p.kind === 'beam' ? 'beam' : 'bolt', speed: p.vel.length(), loops: p.loops, fromKind: from.kind, toKind: to.kind });
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
  private steerReturned(p: Projectile) {
    const speed = p.vel.length();
    if (speed < 1e-3) return;
    const dir = _v.copy(p.vel).divideScalar(speed);
    const best = this.assistTarget(p.pos, dir, p.owner);
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
  private steerCaughtGrenade(p: Projectile) {
    const body = p.body;
    if (!body) return;
    const v = body.vel;
    const hs = Math.hypot(v.x, v.z);
    if (hs < 4) return;
    const G = LAW.gravity;
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    for (const e of this.enemies.list) {
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

  private projectileHitTest(a: V3, b: V3, radius: number, p: Projectile): ActorHit | null {
    let best = 2;
    let key = '';
    const base = _v2;
    // the player: only uncharged Kessler fire can hurt you (you're attuned to your own rift)
    if (!p.charged && p.team === 'kessler' && this.hp > 0) {
      const tt = segCylinder(a, b, this.player.body.pos, FEEL.playerRadius + radius, this.player.body.height);
      if (tt >= 0 && tt < best) {
        best = tt;
        key = 'player';
      }
    }
    // Kessler actors: IFF-locked rounds pass through them until they cross a rift
    if (p.charged) {
      for (const e of this.enemies.list) {
        if (!e.alive) continue;
        if (!this.zones.active.has(e.def.zone)) continue;
        base.copy(e.pos);
        const tt = segCylinder(a, b, base, e.radius + radius, e.height);
        if (tt >= 0 && tt < best) {
          best = tt;
          key = `enemy:${e.id}`;
        }
      }
    }
    for (const pr of this.props.items) {
      if (!pr.alive || pr.body.userData.manual) continue;
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
        amount: p.kind === 'beam' ? LAW.beam.damage * 2 : LAW.bolt.damageCharged,
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
      if (pr.def.explosive && (p.charged || p.kind === 'beam')) this.explodeProp(pr, { projectile: p });
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
        if (this.telegraphs.length < 24) this.telegraphs.push({ kind, from: from.clone(), to: to.clone(), t: t01 });
        if (kind === 'laser' && t01 < 0.05) this.audio.laserLock(from);
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
        this.push({ type: 'knock', t: this.time, enemyId: e.id, cause: info.source, impactorId: this.killCtx?.impactor ? this.enemies.enemyOfBody(this.killCtx.impactor)?.id ?? null : null, at: e.pos.clone() });
        this.fx.dust(e.pos, 0.6);
      },
      melee: (_e, dmg, push) => {
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
      summon: (_e, defs) => {
        for (const d of defs) {
          const v = this.enemies.spawn(d);
          const enc = this.zones.encounters.find((x) => x.zone === d.zone && x.def.lesson === 'boss');
          enc?.enemyIds.push(v.id);
        }
      },
    };
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
    const ev: KillEvent = {
      type: 'kill',
      t: this.time,
      enemyId: e.id,
      enemyKind: e.kind,
      cause: ctx.cause,
      charged: ctx.info.charged,
      speed: ctx.info.speed ?? 0,
      fallHeight: ctx.fallHeight,
      killerCrossings: p ? p.crossings : imp ? imp.crossings : ctx.info.crossings ?? 0,
      killerLoops: p ? p.loops : imp ? imp.loops : ctx.info.loops ?? 0,
      victimCrossings: ctx.crossings,
      ownShot: !!p && p.owner === e.id,
      shotBy: p && typeof p.owner === 'number' && p.owner !== e.id ? p.owner : null,
      projectileKind: p ? p.kind : null,
      turretShot: shooter?.kind === 'turret',
      shotAge: p ? this.time - p.firedAt : 0,
      unaware: ctx.unaware,
      witnessed: ctx.witnessed,
      viaTrapdoor: ctx.viaTrapdoor,
      matador: ctx.matador,
      byBody: !!imp && (imp.kind === 'enemy' || imp.kind === 'corpse') && imp !== e.body,
      byProp: !!kc.byProp,
      byBarrel: !!kc.byBarrel,
      byPlayer: !!kc.byPlayer,
      playerFling: !!kc.playerFling,
      playerAirborne: this.player.airborne,
      impactorId: impEnemy && impEnemy.id !== e.id ? impEnemy.id : null,
      at: ctx.at.clone(),
    };
    this.stats.kills++;
    this.push(ev);
    this.fx.embers(ctx.at, 16);
    this.hp = Math.min(LAW.player.hp, this.hp + LAW.player.killHeal);
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
    this.updateObjective(true);
  }

  private onBossDown() {
    this.bossDead = true;
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
        this.push({ type: 'cross', t: this.time, who: 'player', speed, loops: b.loops, fromKind: from.kind, toKind: to.kind });
        return;
      }
      const e = this.enemies.enemyOfBody(b);
      if (e && e.alive) this.enemies.onCrossed(e, from, to, speed);
      this.push({ type: 'cross', t: this.time, who: b.kind, speed, loops: b.loops, fromKind: from.kind, toKind: to.kind });
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
      else this.fallDeath('respawn.void');
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

  private fallDeath(key: string) {
    if (this.respawnT >= 0) return;
    this.hud.toast(t(key), 'warn');
    this.hp = Math.max(1, this.hp - 30);
    this.respawnT = 0.7;
    this.stats.deaths++;
  }

  // ------------------------------------------------------------------
  // Explosions
  // ------------------------------------------------------------------

  private explodeProp(pr: Prop, kc: KillCtx) {
    if (!pr.alive || pr.fuse >= 0) return;
    pr.fuse = 0; // explode this frame (chains get a short delay)
    const at = pr.body.pos.clone().setY(pr.body.pos.y + pr.body.height * 0.5);
    this.props.remove(pr);
    this.explode(at, LAW.barrel.radius, LAW.barrel.damage, { charged: true, barrel: true, kc });
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
    if (o.charged || o.barrel) {
      for (const e of this.enemies.list) {
        if (!e.alive || !this.zones.active.has(e.def.zone)) continue;
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
          loops: o.projectile?.loops ?? 0,
        };
        const kc: KillCtx = o.projectile ? { projectile: o.projectile } : { ...(o.kc ?? {}), byBarrel: o.barrel };
        const res = this.withKill(kc, () => this.enemies.hit(e, info));
        if (res === 'hurt' && k > 0.35) this.enemies.stagger(e, 1.4, _v2.subVectors(e.pos, at).setY(0).normalize().multiplyScalar(4 * k));
      }
    }
    // push loose things, chain barrels
    for (const pr of this.props.items) {
      if (!pr.alive) continue;
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
    }
    this.input.endFrame();
  }

  private updateAmbient(dt: number) {
    this.time += dt;
    for (const f of this.level.animated) f(this.time);
    (this.sky.material as THREE.ShaderMaterial).uniforms.uTime && ((this.sky.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time);
    this.sky.position.copy(this.camera.position);
    if (this.skyline) this.skyline.position.set(this.camera.position.x * 0.9, 0, this.camera.position.z * 0.9);
    const focus = this.mode === 'menu' ? _v.set(0, 20, 30) : this.player.body.pos;
    this.sun.position.copy(focus).addScaledVector(this.level.sunDir, 140);
    this.sun.target.position.copy(focus);
    this.lamps?.update(this.time, focus);
  }

  private updateMenu(dt: number) {
    this.menuT += dt;
    const a = this.menuT * 0.05;
    const c = _v.set(0, 0, 40);
    this.camera.position.set(c.x + Math.sin(a) * 95, 30 + Math.sin(this.menuT * 0.09) * 12, c.z + Math.cos(a) * 95);
    this.camera.lookAt(c.x, 45, c.z);
    this.camera.fov = 50;
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
    const aiming = inp.isHeld('aim') && this.respawnT < 0;
    if (aiming && this.settings.slowmo) ts = FEEL.focusTimeScale;
    if (this.slowT > 0) {
      this.slowT -= realDt;
      ts = Math.min(ts, this.slowScale);
    }
    if (this.respawnT >= 0) ts = Math.min(ts, 0.35);
    this.timeScale = THREE.MathUtils.damp(this.timeScale, ts, 12, realDt);
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

    // ----- rifts: aim / place / gate / close -----
    this.rifts.aiming = aiming;
    p.aim = THREE.MathUtils.damp(p.aim, aiming ? 1 : 0, 12, realDt);
    let aim: ExitAim | null = null;
    const targets = this.trapTargets();
    if (aiming) {
      const wheel = inp.consumeWheel();
      if (wheel) this.rifts.airDistance = THREE.MathUtils.clamp((this.rifts.airDistance ?? 12) + wheel * 1.5, 3, LAW.riftRange);
      if (inp.wasPressed('flip')) {
        this.rifts.orientation = this.rifts.orientation === 'auto' ? 'hatch' : this.rifts.orientation === 'hatch' ? 'door' : 'auto';
        this.audio.ui('click');
      }
      const ray = this.rig.aimRay();
      aim = this.rifts.aimExit(ray.origin, ray.dir, p.eye(_v), body.pos, IS_TOUCH, targets);
      this.lastAim = aim;
      if (inp.wasPressed('place')) {
        if (aim.valid && this.rifts.placeExit(aim)) {
          this.audio.ui('confirm');
          navigator.vibrate?.(15);
          this.hint('gate', t('hint.gateAfterExit'), 6);
        } else {
          this.audio.ui('deny');
          if (aim.reason) this.hud.toast(t(aim.reason), 'warn');
        }
      }
    } else {
      inp.consumeWheel();
      this.rifts.airDistance = null;
      this.lastAim = null;
      if (inp.wasPressed('gate')) this.openGate(targets);
    }
    if (inp.wasPressed('close')) this.closeRifts();
    this.hud.setAim(
      aim
        ? { valid: aim.valid, reason: aim.reason, kind: aim.kind, distance: aim.distance, outcome: aim.outcome, dropBelow: aim.dropBelow, orientation: this.rifts.orientation }
        : null,
    );
    this.rifts.updatePreview(aim && aim.valid !== undefined ? aim : null, this.handPos(), this.camera);
    if (!aiming) this.hud.setGateHint(this.gatePreview(targets));
    else this.hud.setGateHint(null);
    this.hud.setRiftState({ exit: this.rifts.hasExit(), entrance: this.rifts.hasEntrance(), aiming, orientation: this.rifts.orientation });
    this.touch?.setAiming(aiming);

    // ----- player -----
    const pin: PlayerInput = {
      moveX: this.respawnT >= 0 ? 0 : inp.moveX,
      moveY: this.respawnT >= 0 ? 0 : inp.moveY,
      camYaw: this.rig.yaw,
      jump: inp.wasPressed('jump'),
      sprint: inp.isHeld('sprint') || (IS_TOUCH && Math.hypot(inp.moveX, inp.moveY) > 0.95),
      crouch: this.crouchToggle(),
      shove: inp.wasPressed('shove'),
    };
    const wasAir = p.airborne;
    p.update(dt, pin, this.level.world, this.physics, this.physEv, this.playerEvents(), this.time);
    this.updateAirtime(wasAir);
    if (this.playerFling && !p.airborne && p.body.charge <= 0) this.playerFling = false;
    this.keepPlayerOutOfEnemies();
    this.updateShove(dt);
    this.updateCarry();

    // ----- world simulation -----
    this.physics.step(dt, this.physEv, this.time);
    this.telegraphs.length = 0;
    const ectx: EnemyContext = {
      time: this.time,
      player: { pos: body.pos, chest: p.chest(_v3.clone()), vel: body.vel, alive: this.hp > 0, airborne: p.airborne, crouched: p.crouched, noise: this.noise },
      world: this.level.world,
      rifts: this.rifts,
      physics: this.physics,
      activeZones: this.zones.active,
    };
    this.enemies.update(dt, ectx);
    this.noise.length = 0;
    this.rifts.setBlockers(this.enemies.blockers());
    this.rifts.update(dt, realDt, this.time);
    this.projectiles.update(dt, this.time);
    this.detonateCaughtGrenades();
    this.props.update(dt);
    this.updatePropFuses(dt);
    this.updateCatchWindow();

    // ----- zones, encounters, lifts -----
    const zu = this.zones.update(body.pos);
    if (zu.entered) this.onZoneEntered(zu.entered.id);
    for (const e of zu.triggered) this.triggerEncounter(e);
    for (const e of zu.engaged) this.engageEncounter(e);
    this.updateLifts(dt);
    this.updateGates(dt);
    if (this.bossDead && this.victoryT < 0 && body.pos.y < (this.level.bossArena?.y ?? 90) - 30) this.victory();
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
    if (this.hp > 0 && this.time - this.lastHurtT > LAW.player.regenDelay) this.hp = Math.min(LAW.player.hp, this.hp + LAW.player.regenRate * dt);
    this.hud.setHealth(this.hp, LAW.player.hp);
    this.hud.setStyle(this.style.state);
    (this.hud as any).setPlayerCharged?.(body.charge > 0);

    // ----- camera, fx, audio -----
    const speed = body.vel.length();
    this.rig.speed = THREE.MathUtils.damp(this.rig.speed, body.charge > 0 ? THREE.MathUtils.clamp((speed - 8) / 22, 0, 1) : 0, 6, realDt);
    this.rig.update(realDt, body.pos, p.crouched ? 1 : 0, aiming, this.level.world);
    if (body.charge > 0 && speed > 8) this.fx.streak(_v.copy(body.pos).setY(body.pos.y + 1), body.vel, COL_CHARGED);
    for (const b of this.physics.bodies) if (b.kind !== 'player' && b.enabled && b.charge > 0 && b.vel.lengthSq() > 64) this.fx.streak(_v.copy(b.pos).setY(b.pos.y + b.height * 0.5), b.vel, COL_ENTRANCE);
    this.fx.setHome(body.pos);
    this.fx.update(dt);
    this.drawTelegraphs();
    this.updateMarkers();
    this.updateObjective(false);
    this.hud.update(realDt);
    this.audio.updateListener(this.camera);
    const combat = this.enemies.list.some((e) => e.alive && e.state === 'combat' && this.zones.active.has(e.def.zone)) ? 1 : 0;
    this.audio.setIntensity(combat ? 0.8 : 0.2, combat, realDt);
    this.audio.setAltitude(body.pos.y);
    this.audio.wind(body.charge > 0 ? speed : speed * 0.3);
    if (body.charge > 0 && body.loops >= 2) this.audio.loopWhoosh(speed);
    this.updateAmbient(0);
    if (this.recorder.wants(this.time)) this.recorder.record(this.capture());
  }

  private noise: { at: V3; radius: number }[] = [];

  private crouchState = false;
  private crouchToggle() {
    if (this.input.wasPressed('crouch')) this.crouchState = !this.crouchState;
    if (this.input.wasPressed('jump') || this.input.isHeld('sprint')) this.crouchState = false;
    this.touch?.setCrouched(this.crouchState);
    return this.crouchState;
  }

  private playerEvents(): PlayerEvents {
    return {
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
        this.rig.rotateBy(yawDelta);
        this.rig.kick = Math.max(this.rig.kick, 0.8);
        this.renderer.grade.uniforms.uFlash.value = 1;
      },
    };
  }

  private onPlayerLanded(pos: V3, speed: number, charged: boolean) {
    this.audio.land(pos, speed);
    if (speed > 9) this.fx.dust(pos, Math.min(2, speed / 12));
    if (charged && speed >= LAW.cometSpeed) {
      // COMET: shockwave knocks everyone nearby down
      this.fx.ring(pos, LAW.cometRadius * 2.2, 0.55, COL_CHARGED);
      this.rig.shake = Math.max(this.rig.shake, 0.9);
      this.hitstop = Math.max(this.hitstop, 0.1);
      for (const e of this.enemies.list) {
        if (!e.alive || e.pos.distanceTo(pos) > LAW.cometRadius) continue;
        const info: HitInfo = { source: 'impact', amount: 20, charged: true, speed: LAW.knockSpeed, from: pos.clone(), dir: _v.subVectors(e.pos, pos).normalize().clone(), team: 'player', instigator: 'player' };
        const res = this.withKill({ byPlayer: true, playerFling: this.playerFling }, () => this.enemies.hit(e, info));
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
      if (!pr.alive || pr.hanging || pr.body.userData.manual) continue;
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
    const out = this.enemies.trapTargets().filter((tt) => {
      const e = this.enemies.byKey(tt.key);
      return !e || this.zones.active.has(e.def.zone);
    });
    return this.props.trapTargets(out);
  }

  private threats(): Threat[] {
    const out = this.enemies.threats().slice();
    const pp = this.player.body.pos;
    for (const pr of this.projectiles.list) {
      if (pr.kind !== 'grenade' || !pr.alive || pr.charged) continue;
      if (pr.pos.distanceTo(pp) < 6) out.push({ kind: 'grenade', from: pr.pos.clone(), eta: Math.max(0, LAW.grenade.fuse - pr.age) });
    }
    return out;
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
      threats: this.threats(),
      targets,
    };
  }

  private openGate(targets: TrapTarget[]) {
    // hanging cargo: a hole opens right under it and the cable snaps
    const hang = this.hangingUnderCrosshair();
    if (hang && this.rifts.hasExit()) {
      // on the ground under it when that's a real drop (it arrives fast: CARGO), else just below it
      const hp = hang.body.pos;
      const w = this.level.world;
      const gy = w.groundAt(hp.x, hp.z, 0.3, hp.y - 0.1);
      const host = w.lastGround;
      const steadyNear = this.enemies.list.some((e) => e.alive && !e.offBalance && Math.hypot(e.pos.x - hp.x, e.pos.z - hp.z) < LAW.enemyClearance + e.radius && Math.abs(e.pos.y - gy) < 1);
      const onGround = gy > -Infinity && hp.y - gy > 3 && !!host && !host.noPortal && !steadyNear;
      const ok = this.rifts.openEntranceAt(
        { position: hp.clone().setY(onGround ? gy + 0.01 : hp.y - 1.2), quaternion: orientFrame(UP, new THREE.Vector3(0, 0, 1)), width: LAW.floorEndSize, height: LAW.floorEndSize },
        onGround ? 'floor' : 'air',
      );
      if (ok !== false) {
        this.props.release(hang);
        this.audio.ui('confirm');
        return;
      }
    }
    const res = this.rifts.openEntrance(this.entranceCtx(targets));
    if (!res.ok) {
      this.audio.ui('deny');
      if (res.reason) this.hud.toast(t(res.reason), 'warn');
      return;
    }
    navigator.vibrate?.(12);
    if (res.mode === 'trapdoor' && res.targetKey) {
      const e = this.enemies.byKey(res.targetKey);
      if (e) this.enemies.launch(e);
      const pr = this.props.byKey(res.targetKey);
      if (pr) {
        pr.touched = true;
        if (pr.hanging) this.props.release(pr);
        pr.body.onGround = false;
      }
    }
    if (res.mode === 'catch' && this.threats().some((q) => q.kind === 'laser')) this.hint('catch', t('hint.returnToSender'), 6);
  }

  private hangingUnderCrosshair(): Prop | null {
    const ray = this.rig.aimRay();
    let best: Prop | null = null, bd = 2.2;
    for (const pr of this.props.items) {
      if (!pr.alive || !pr.hanging) continue;
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

  /** What GATE would do right now (HUD hint). */
  private gatePreview(targets: TrapTarget[]) {
    if (!this.rifts.hasExit()) return { mode: null, reason: 'gate.noExit', targetKey: null };
    if (this.hangingUnderCrosshair()) return { mode: 'trapdoor' as const, reason: null, targetKey: null };
    const pe = (this.rifts as any).previewEntrance?.(this.entranceCtx(targets));
    if (pe) return { mode: pe.mode ?? null, reason: pe.ok ? null : pe.reason ?? null, targetKey: pe.targetKey ?? null };
    const b = this.player.body;
    if (this.player.airborne && b.vel.y < -3) return { mode: 'air' as const, reason: null, targetKey: null };
    if (this.threats().length) return { mode: 'catch' as const, reason: null, targetKey: null };
    if (this.hangingUnderCrosshair()) return { mode: 'trapdoor' as const, reason: null, targetKey: null };
    const ray = this.rig.aimRay();
    let best: TrapTarget | null = null, bd = 1.8;
    for (const tt of targets) {
      const toT = _v.subVectors(tt.pos, ray.origin);
      const along = toT.dot(ray.dir);
      if (along < 0 || along > LAW.trapdoorRange) continue;
      const d = toT.addScaledVector(ray.dir, -along).length();
      if (d < bd) {
        bd = d;
        best = tt;
      }
    }
    if (best) return best.canFall ? { mode: 'trapdoor' as const, reason: null, targetKey: best.key } : { mode: 'trapdoor' as const, reason: 'gate.steady', targetKey: best.key };
    return { mode: 'door' as const, reason: null, targetKey: null };
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
  // Context action: finish / hijack / lift / grab / throw
  // ------------------------------------------------------------------

  private contextAction(): { label: string; run: () => void } | null {
    const p = this.player;
    const b = p.body;
    if (this.respawnT >= 0) return null;
    if (this.carried) return { label: t('prompt.throw'), run: () => this.throwCarried() };
    const f = p.forward(_v2);
    // FINISH: the blade only ends what a rift broke
    for (const e of this.enemies.list) {
      if (!e.alive || (e.state !== 'downed' && e.state !== 'stunned')) continue;
      const d = e.pos.distanceTo(b.pos);
      if (d > LAW.finishRange + e.radius || Math.abs(e.pos.y - b.pos.y) > 1.2) continue;
      return { label: t('prompt.finish'), run: () => this.finish(e) };
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

  private finish(e: EnemyView) {
    this.player.char.play('strike', { fade: 0.05, speed: 1.3 });
    this.player.yaw = Math.atan2(e.pos.x - this.player.body.pos.x, e.pos.z - this.player.body.pos.z);
    this.hitstop = 0.14;
    this.rig.kick = 1;
    this.audio.bladeFinish(e.pos);
    const info: HitInfo = { source: 'blade', amount: 9999, charged: false, team: 'player', instigator: 'player', from: this.player.body.pos.clone() };
    this.withKill({ byPlayer: true }, () => this.enemies.hit(e, info));
    this.fx.sparks(e.chest(_v), null, COL_SPARK, 18);
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
    this.props.spawnZone(id);
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
    if (e.def.spawns.length === 0) {
      // lessons without enemies clear on sight
      e.cleared = true;
    }
  }

  private engageEncounter(e: EncounterState) {
    for (const id of e.enemyIds) {
      const v = this.enemies.get(id);
      if (v) v.sightScale = 1;
    }
    if (e.def.lesson && !e.cleared) {
      const key = `hint.${e.def.lesson}`;
      this.hint(key, t(key), 9);
    }
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
      wave.forEach((def, i) => this.gateQueue.push({ gate: g.id, def, enc, t: i * 0.45 }));
    }
    for (let i = this.gateQueue.length - 1; i >= 0; i--) {
      const q = this.gateQueue[i];
      q.t -= dt;
      if (q.t > 0) continue;
      this.gateQueue.splice(i, 1);
      const inEnd = this.rifts.gateEnds(q.gate).in;
      if (!inEnd || q.enc.cleared) continue;
      // just in front of the in-end, hopping into it
      const spawnPos = inEnd.position.clone().addScaledVector(inEnd.normal, 0.55).setY(inEnd.position.y - inEnd.height / 2 + 0.02);
      const v = this.enemies.spawn({ ...q.def, pos: spawnPos, state: 'combat' });
      q.enc.enemyIds.push(v.id);
      this.enemies.launch(v, inEnd.normal.clone().multiplyScalar(-4.5).setY(2.2));
    }
  }

  private gateQueue: { gate: string; def: SpawnDef; enc: EncounterState; t: number }[] = [];

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
      l.t = Math.min(1, l.t + (dt * 3.2) / Math.max(1, len));
      const k = l.t * l.t * (3 - 2 * l.t);
      const target = _v.copy(l.base).add(_v2.subVectors(l.def.to, l.def.from).multiplyScalar(k));
      const delta = _v3.subVectors(target, l.def.mesh.position);
      const onIt = this.zones.liftAt(this.player.body.pos) === l;
      l.def.mesh.position.copy(target);
      (this.level.world as any).moveCollider?.(l.def.collider, delta.x, delta.y, delta.z);
      if (onIt) {
        this.player.body.pos.add(delta);
        this.player.body.vel.y = Math.max(0, this.player.body.vel.y);
      }
      if (l.t >= 1) {
        l.moving = false;
        this.audio.lift(l.def.mesh.position, false);
      }
    }
  }

  // ------------------------------------------------------------------
  // HUD helpers
  // ------------------------------------------------------------------

  private lastObjKey = '';
  private updateObjective(force: boolean) {
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
    for (const th of this.telegraphs) if (th.kind === 'laser' || th.kind === 'beam' || th.kind === 'charge') project(th.from, 'threat');
    if (this.visionOn) {
      for (const e of this.enemies.list) if (e.alive && this.zones.active.has(e.def.zone)) project(_v2.copy(e.pos).setY(e.pos.y + e.height + 0.3), 'target', e.state);
      for (const g of this.level.gates) if (this.zones.active.has(g.zone)) project(g.panel, 'gate');
    }
    const o = this.zones.objective();
    if (o.target && !this.bossDead) project(o.target, 'objective', `${Math.round(o.target.distanceTo(this.player.body.pos))}m`);
    this.hud.setMarkers(list);
  }

  private drawTelegraphs() {
    const pos = this.telegraphLines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = this.telegraphLines.geometry.getAttribute('color') as THREE.BufferAttribute;
    let n = 0;
    let arc: (typeof this.telegraphs)[number] | null = null;
    for (const th of this.telegraphs) {
      if (th.kind === 'arc') {
        arc = th;
        continue;
      }
      if (n >= 48) break;
      const k = th.kind === 'beam' ? 1 + th.t * 3 : 2.5;
      pos.setXYZ(n * 2, th.from.x, th.from.y, th.from.z);
      pos.setXYZ(n * 2 + 1, th.to.x, th.to.y, th.to.z);
      const pulse = th.kind === 'laser' ? 0.6 + 0.4 * Math.sin(this.time * 40) : 1;
      col.setXYZ(n * 2, k * pulse, 0.12, 0.08);
      col.setXYZ(n * 2 + 1, k * pulse, 0.12, 0.08);
      n++;
    }
    this.telegraphLines.geometry.setDrawRange(0, n * 2);
    pos.needsUpdate = true;
    col.needsUpdate = true;
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
    const actors: ActorSnap[] = [{ key: 'player', pos: [b.pos.x, b.pos.y, b.pos.z], yaw: this.player.yaw, pose: this.player.char.getPose(), visible: this.player.char.root.visible }];
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
        this.projectiles.group.visible = false;
        this.replayProj.visible = true;
        this.replayBeams.visible = true;
        this.hud.show(false);
        this.touch?.show(false);
      },
      endReplay: () => {
        if (this.liveSnap) this.applySnap(this.liveSnap);
        this.liveSnap = null;
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
    if (skipped && this.exporter.recording) {
      this.exporter.cancel();
      this.mode = 'playing';
      this.hud.show(true);
      this.touch?.show(true);
      return;
    }
    this.mode = 'paused';
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

  private enterPhoto() {
    if (this.mode !== 'playing') return;
    this.mode = 'photo';
    this.hud.show(false);
    this.touch?.show(false);
    this.photo.enter(this.camera, this.player.body.pos.clone().setY(this.player.body.pos.y + 1));
    this.audio.ui('click');
  }

  private updatePhoto(realDt: number) {
    const look = this.input.consumeLook();
    const wheel = this.input.consumeWheel();
    this.photo.update(realDt, { lookX: look.x, lookY: -look.y, moveX: this.input.moveX, moveY: this.input.moveY, zoom: wheel });
    this.updateAmbient(0);
    this.render(realDt);
    if (this.input.wasPressed('place') || this.input.wasPressed('gate') || this.input.wasPressed('action')) {
      this.audio.ui('shutter');
      void this.photo.capture(this.renderer.renderer.domElement, () => this.render(0)).then((blob) => {
        if (blob) void this.exporter.share(blob, 'threshold-photo').then(() => this.hud.toast(t('toast.photoSaved'), 'good'));
      });
    }
    if (this.input.wasPressed('photo') || this.input.wasPressed('pause')) {
      this.photo.exit();
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
    this.challenges.complete('crown.3');
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
    this.onEnd(true, this.stats, this.style.state.rank);
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  private render(realDt: number) {
    const r = this.renderer.renderer;
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    if (this.mode !== 'menu') this.rifts.renderViews(this.camera, this.renderer.width, this.renderer.height, this.helpers);
    this.renderer.grade.uniforms.uFocus.value = this.rifts.aiming ? 1 : 0;
    this.renderer.grade.uniforms.uFlash.value = Math.max(0, this.renderer.grade.uniforms.uFlash.value - realDt * 3);
    this.renderer.grade.uniforms.uDamage.value = this.mode === 'playing' ? THREE.MathUtils.clamp(1 - this.hp / 45, 0, 1) * 0.6 : 0;
    this.renderer.render(realDt);
  }
}

export type { Team };
