/**
 * Shared contracts for THRESHOLD: The Tower.
 *
 * Every workstream implements against these types. Read docs/DESIGN.md for
 * the why. Changing a type here is a cross-team change: do it only in the
 * lead integration pass.
 */
import type * as THREE from 'three';
import type { Collider, CollisionWorld, RayHit } from '../world/collision';
import type { RiftFrame } from '../game/portalMath';

export type V3 = THREE.Vector3;
export type Tuple3 = [number, number, number];
export type Tuple4 = [number, number, number, number];

// ---------------------------------------------------------------------------
// The laws
// ---------------------------------------------------------------------------

export const LAW = {
  gravity: 22,
  /** Speed cap for anything (m/s), loops included. */
  maxSpeed: 40,
  /** Rift-charged impact / landing speed that knocks a normal enemy down. */
  knockSpeed: 8,
  /** ...that kills a normal enemy. */
  killSpeed: 12,
  /** ...that kills armour (brute, warden hit from the front). */
  armorSpeed: 18,
  /** Seconds a body stays rift-charged after crossing (players also lose it on first ground contact). */
  chargeTime: 1.5,
  /** Air ends can't be higher than the player's feet + this. */
  airAboveFeetMax: 0,
  /** No rift end may open within this distance of a living steady enemy. */
  enemyClearance: 1.2,
  seaY: -1.2,
  riftRange: 60,
  trapdoorRange: 40,
  floorEndSize: 1.7,
  bolt: { speed: 26, damageToPlayer: 15, damageCharged: 60, radius: 0.12, life: 3 },
  grenade: { fuse: 2.2, radius: 4.5, damage: 45, bounce: 0.35, bodyRadius: 0.14 },
  beam: { telegraph: 1.2, duration: 0.35, damage: 45, maxHops: 2, range: 120 },
  barrel: { radius: 4.2, damage: 80, playerScale: 0.5 },
  player: { hp: 100, regenDelay: 4, regenRate: 25, killHeal: 15, uncharged: { hurtFrom: 14, perMs: 9 } },
  shove: { distance: 4, stagger: 1.4, cooldown: 1.2 },
  finishRange: 2,
  cometSpeed: 18,
  cometRadius: 3,
} as const;

// ---------------------------------------------------------------------------
// Teams, damage
// ---------------------------------------------------------------------------

export type Team = 'player' | 'kessler' | 'neutral';

export type DamageSource =
  | 'bolt' | 'grenade' | 'beam' | 'impact' | 'fall' | 'water' | 'void'
  | 'shear' | 'blade' | 'explosion' | 'crush' | 'shove' | 'melee' | 'hazard';

export interface HitInfo {
  source: DamageSource;
  amount: number;
  /** Passed through a rift (IFF lifted). */
  charged: boolean;
  /** Impact / landing speed (m/s) when relevant. */
  speed?: number;
  /** Direction of travel of whatever hit. */
  dir?: V3;
  /** Where it came from (for shield facing checks). */
  from?: V3;
  team: Team;
  /** Enemy id that originally fired / owned it, 'player', or null. */
  instigator: number | 'player' | null;
  /** How many rifts it crossed. */
  crossings?: number;
  /** Loop count of the thing that hit. */
  loops?: number;
  /** Fall height after the last rift exit (landings). */
  fallHeight?: number;
  /** The rift end it came out of last, if any. */
  exitEndId?: number | null;
}

export type HitResult = 'ignored' | 'blocked' | 'hurt' | 'knocked' | 'killed';

// ---------------------------------------------------------------------------
// Rifts
// ---------------------------------------------------------------------------

export type RiftEndKind = 'stand' | 'wall' | 'ceiling' | 'floor' | 'air';
export type RiftOwner = 'player' | 'gate' | 'boss';
export type RiftRole = 'entrance' | 'exit' | 'gate-in' | 'gate-out' | 'boss';

/** One open rift surface. Local frame: +Z is the front normal, things exit along it. */
export interface RiftEnd extends RiftFrame {
  readonly id: number;
  normal: V3;
  kind: RiftEndKind;
  host: Collider | null;
  linked: RiftEnd;
  /** Fully open and its partner too. */
  readonly isOpen: boolean;
  owner: RiftOwner;
  role: RiftRole;
}

export interface RaySegment {
  from: V3;
  to: V3;
  /** World hit that ended this segment (null if it ended in a rift or at max range). */
  hit: RayHit | null;
  /** The rift end this segment ENTERED at its `to` point (null if none). */
  viaEnd: RiftEnd | null;
  /** True for segments after the first rift crossing. */
  charged: boolean;
}

/** Read-only view of the rift world, used by physics, projectiles, enemies. */
export interface RiftQuery {
  openEnds(): RiftEnd[];
  /** First open end whose front plane the segment prev→cur crosses (front → back), within the rectangle (+margin). */
  findCrossing(prev: V3, cur: V3, margin?: number): RiftEnd | null;
  transformPoint(from: RiftEnd, p: V3, out?: V3): V3;
  transformDir(from: RiftEnd, d: V3, out?: V3): V3;
  /** Open floor-kind end whose rectangle contains (x,z) and whose plane is within `tol` of y: the ground there is a hole. */
  holeAt(x: number, z: number, y: number, r?: number, tol?: number): RiftEnd | null;
  /** A mover near an open end on collider `c` may pass through that collider. */
  hostPassable(c: Collider, pos: V3, radius: number): boolean;
  /** Rift ends can't open here (jammer bubbles). */
  blocked(p: V3): boolean;
  notePass(end: RiftEnd, who: BodyKind | 'bolt' | 'beam'): void;
  /** Ray that continues through open rifts (beams, lasers, sight, previews). */
  raycastThrough(origin: V3, dir: V3, maxDist: number, world: CollisionWorld, maxHops?: number): RaySegment[];
}

// ---------------------------------------------------------------------------
// Physics
// ---------------------------------------------------------------------------

export type BodyKind = 'player' | 'enemy' | 'corpse' | 'prop' | 'grenade';

export interface DynBody {
  readonly id: number;
  kind: BodyKind;
  /** Feet / bottom centre. */
  pos: V3;
  vel: V3;
  radius: number;
  height: number;
  onGround: boolean;
  groundCollider: Collider | null;
  /** Seconds of rift charge left; > 0 means rift-charged. */
  charge: number;
  /** Rift crossings since last grounded. */
  crossings: number;
  /** Consecutive crossings of the same pair without landing. */
  loops: number;
  /** Highest y since the last rift exit (fall height = peakY - landing y). */
  peakY: number;
  lastEnd: RiftEnd | null;
  lastCrossT: number;
  /** Restitution (0 for characters). */
  bounce: number;
  /** Ground friction (1 = stops at once). */
  friction: number;
  enabled: boolean;
  /**
   * true: physics integrates gravity, bounce, friction.
   * false: kinematic (e.g. a walking enemy): the owner sets `vel` every frame; physics still moves it by vel*dt,
   * resolves world collisions, snaps to ground (step-up), reports onGround and detects rift crossings.
   * If a kinematic body loses its ground (walked onto a hole / edge) its owner should switch it to simulate=true.
   */
  simulate: boolean;
  /** Orientation for props/grenades/tumbling characters (physics spins it by `spin`). */
  quat: THREE.Quaternion;
  spin: V3;
  team: Team;
  userData: Record<string, unknown>;
}

export interface ImpactInfo {
  speed: number;
  normal: V3;
  surface: 'ground' | 'wall' | 'ceiling';
  collider: Collider | null;
  charged: boolean;
  point: V3;
}

export interface PhysicsEvents {
  crossed(b: DynBody, from: RiftEnd, to: RiftEnd, speed: number): void;
  impact(b: DynBody, e: ImpactInfo): void;
  /** Two bodies touched; relSpeed along their separation. */
  touch(a: DynBody, b: DynBody, relSpeed: number): void;
  splash(b: DynBody): void;
  fellOut(b: DynBody): void;
}

export interface PhysicsAPI {
  readonly bodies: DynBody[];
  createBody(kind: BodyKind, opts: { pos: V3; radius: number; height: number; bounce?: number; friction?: number; team?: Team; simulate?: boolean }): DynBody;
  removeBody(b: DynBody): void;
  /**
   * Steps every enabled body except those with userData.manual === true (the player controller steps its
   * own body via stepBody). Substeps keep each move ≤ 0.25 m. Then body-body touches.
   */
  step(dt: number, ev: PhysicsEvents, time: number): void;
  /** Single body (used by the player controller each frame). */
  stepBody(b: DynBody, dt: number, ev: PhysicsEvents, time: number): void;
  /** Void kill plane per position (zones supply it). */
  killYAt: (p: V3) => number;
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------

export type ProjectileKind = 'bolt' | 'grenade' | 'beam';

export interface Projectile {
  readonly id: number;
  kind: ProjectileKind;
  team: Team;
  charged: boolean;
  pos: V3;
  vel: V3;
  /** Enemy id / 'player' / null — who fired it. */
  owner: number | 'player' | null;
  damage: number;
  age: number;
  life: number;
  crossings: number;
  loops: number;
  alive: boolean;
  /** Grenades ride a DynBody. */
  body: DynBody | null;
  /** Beams: current segments (recomputed every frame while alive). */
  segments: RaySegment[];
  /** Beams: origin + dir, and actors already damaged this beam. */
  beamDir?: V3;
  hitIds?: Set<string>;
  lastEndId: number | null;
  firedAt: number;
}

export interface ActorHit {
  /** 'player', `enemy:<id>`, `prop:<id>` */
  key: string;
  point: V3;
  normal: V3;
}

export interface ProjectileHooks {
  /** Nearest actor hit along a→b within radius (the game knows actors and IFF). */
  hitTest(a: V3, b: V3, radius: number, p: Projectile): ActorHit | null;
  onHitActor(p: Projectile, hit: ActorHit): 'stop' | 'pass';
  onHitWorld(p: Projectile, hit: RayHit): void;
  onExplode(p: Projectile, at: V3): void;
  onCross(p: Projectile, from: RiftEnd, to: RiftEnd): void;
}

export interface ProjectileAPI {
  readonly list: Projectile[];
  fireBolt(from: V3, dir: V3, team: Team, owner: number | 'player' | null, opts?: { speed?: number; damage?: number }): Projectile;
  throwGrenade(from: V3, vel: V3, team: Team, owner: number | 'player' | null, fuse?: number): Projectile;
  fireBeam(from: V3, dir: V3, team: Team, owner: number | 'player' | null, duration?: number, damage?: number): Projectile;
  update(dt: number, time: number): void;
  clear(): void;
  /** Visuals (instanced bolts, beam lines, grenade meshes). */
  readonly group: THREE.Object3D;
}

// ---------------------------------------------------------------------------
// Rift system (player-facing API; implemented by src/game/portals.ts)
// ---------------------------------------------------------------------------

export type ExitOrientation = 'auto' | 'hatch' | 'door';

export interface ExitAim {
  frame: RiftFrame;
  kind: RiftEndKind;
  host: Collider | null;
  /** Where a walking/falling thing will emerge (feet). */
  exitFeet: V3;
  exitYaw: number;
  valid: boolean;
  /** i18n key when invalid. */
  reason: string | null;
  distance: number;
  /** Vertical drop below the exit (m) to whatever is under it; Infinity over void/sea. */
  dropBelow: number;
  /** What will happen to something falling out of it. */
  outcome: 'splash' | 'void' | 'skull' | 'stars' | 'safe';
  /** Snapped over this target id (auto hatch). */
  overTarget: string | null;
}

export interface TrapTarget {
  key: string;            // enemy:<id> / prop:<id>
  pos: V3;                // feet
  radius: number;
  height: number;
  /** Would fall right now (unaware/off-balance/prop). */
  canFall: boolean;
  /** Steady combat enemy (refuse + show hint). */
  steady: boolean;
}

export interface Threat {
  kind: 'laser' | 'beam' | 'grenade' | 'charge';
  from: V3;
  /** Seconds until it arrives (grenade landing, charge contact, shot). */
  eta: number;
}

export interface EntranceContext {
  playerFeet: V3;
  playerVel: V3;
  playerYaw: number;
  airborne: boolean;
  camPos: V3;
  camDir: V3;
  threats: Threat[];
  targets: TrapTarget[];
}

export type EntranceMode = 'air' | 'catch' | 'trapdoor' | 'door';

export interface EntranceResult {
  ok: boolean;
  mode: EntranceMode | null;
  targetKey: string | null;
  reason: string | null;
}

export interface ShearVictim {
  key: string;
  at: V3;
}

export interface RiftAPI extends RiftQuery {
  readonly group: THREE.Group;
  aiming: boolean;
  orientation: ExitOrientation;
  /** Air distance override (wheel / drag), null = auto. */
  airDistance: number | null;
  /** Solve the exit placement from a camera ray. */
  aimExit(camPos: V3, dir: V3, playerEye: V3, playerFeet: V3, touch: boolean, targets: TrapTarget[]): ExitAim;
  placeExit(aim: ExitAim): boolean;
  hasExit(): boolean;
  hasEntrance(): boolean;
  openEntrance(ctx: EntranceContext): EntranceResult;
  /** Close the player pair. Returns victims that straddled a plane (the game kills them). */
  close(straddlers: { key: string; center: V3; radius: number }[]): ShearVictim[];
  /** Kessler gates: fixed pairs owned by the level. */
  addGate(id: string, inFrame: RiftFrame & { kind: RiftEndKind }, outFrame: RiftFrame & { kind: RiftEndKind }): void;
  /** Relink a gate's out end to the player's exit (true on success). */
  hijackGate(id: string): boolean;
  setGateOpen(id: string, open: boolean): void;
  /** Boss rifts. */
  setBossPair(a: (RiftFrame & { kind: RiftEndKind }) | null, b: (RiftFrame & { kind: RiftEndKind }) | null): void;
  /** Jammer bubbles. */
  setBlockers(list: { pos: V3; radius: number }[]): void;
  updatePreview(aim: ExitAim | null, handPos: V3, cam: THREE.Camera): void;
  update(dt: number, realDt: number, time: number): void;
  renderViews(camera: THREE.PerspectiveCamera, screenW: number, screenH: number, hide: THREE.Object3D[]): void;
  setPortalScale(s: number): void;
  maxViews: number;
  reset(): void;
  /** Snapshot for replay. */
  snapshot(): RiftSnap[];
  applySnapshot(s: RiftSnap[]): void;
}

// ---------------------------------------------------------------------------
// Characters / animation
// ---------------------------------------------------------------------------

export type ClipName =
  | 'idle' | 'walk' | 'run' | 'sprint' | 'crouchIdle' | 'crouchWalk'
  | 'jumpStart' | 'jumpLoop' | 'jumpLand' | 'roll'
  | 'strike' | 'punch' | 'push' | 'hitChest' | 'hitHead' | 'death'
  | 'aim' | 'shoot' | 'reload' | 'swimIdle' | 'swim' | 'interact' | 'pickUp';

export interface LocomotionInput {
  /** Horizontal speed (m/s). */
  speed: number;
  grounded: boolean;
  /** Vertical velocity (airborne pose selection). */
  vy: number;
  crouch: number;
  /** 0..1 gauntlet raised (aiming a rift). */
  aim: number;
  swimming?: boolean;
  /** Lying on the ground (downed / stunned), not dead. */
  downed?: boolean;
  /** Rifleman aim-hold pose. */
  weaponUp?: number;
}

export interface CharacterPose {
  loco: { speed: number; grounded: boolean; vy: number; crouch: number; aim: number; downed: boolean; weaponUp: number };
  /** Active one-shot overlay. */
  clip: ClipName | null;
  clipT: number;
  clipW: number;
  /** Whole-body tumble quaternion (launched) or null. */
  tumble: Tuple4 | null;
  dead: boolean;
  deathKind: DeathKind | null;
  mixerT: number;
}

export type DeathKind = 'fall' | 'shot' | 'cut' | 'drown' | 'blast';

export interface CharacterAPI {
  root: THREE.Group;
  update(dt: number, s: LocomotionInput): void;
  play(name: ClipName, opts?: { fade?: number; speed?: number; hold?: boolean }): void;
  stop(name?: ClipName): void;
  setTumble(q: THREE.Quaternion | null): void;
  die(kind: DeathKind): void;
  revive(): void;
  getPose(): CharacterPose;
  setPose(p: CharacterPose): void;
  setOpacity(o: number): void;
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

export type EnemyKind = 'rifleman' | 'grenadier' | 'warden' | 'brute' | 'sniper' | 'jammer' | 'turret' | 'boss';
export type EnemyState = 'idle' | 'patrol' | 'suspicious' | 'combat' | 'stagger' | 'charge' | 'launched' | 'downed' | 'stunned' | 'dead';

export interface SpawnDef {
  id: string;
  kind: EnemyKind;
  pos: V3;
  yaw: number;
  zone: ZoneId;
  squad: string;
  state?: 'idle' | 'patrol' | 'combat';
  route?: V3[];
  wait?: number[];
  /** Never moves (snipers, turrets, posted guards). */
  perch?: boolean;
}

export interface EnemyView {
  readonly id: number;
  readonly def: SpawnDef;
  readonly kind: EnemyKind;
  readonly state: EnemyState;
  readonly pos: V3;
  readonly yaw: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly alive: boolean;
  /** Knows about the player (combat/suspicious). */
  readonly aware: boolean;
  /** Can be trapdoored right now. */
  readonly offBalance: boolean;
  readonly armored: boolean;
  readonly radius: number;
  readonly height: number;
  readonly body: DynBody | null;
  chest(out?: V3): V3;
  forward(out?: V3): V3;
}

export interface DeathContext {
  cause: DamageSource;
  info: HitInfo;
  unaware: boolean;
  /** Seen by another living enemy. */
  witnessed: boolean;
  airborne: boolean;
  /** Crossed rifts before dying. */
  crossings: number;
  loops: number;
  fallHeight: number;
  /** Fell through a floor end (trapdoor) before dying. */
  viaTrapdoor: boolean;
  /** Was a brute sent through while charging. */
  matador: boolean;
  at: V3;
}

export interface EnemyHooks {
  fireBolt(e: EnemyView, from: V3, dir: V3): void;
  throwGrenade(e: EnemyView, from: V3, vel: V3): void;
  fireBeam(e: EnemyView, from: V3, dir: V3): void;
  /** Laser telegraph lines (drawn by the game): list replaced every frame. */
  telegraph(e: EnemyView, kind: 'laser' | 'beam' | 'arc' | 'charge', from: V3, to: V3, t01: number): void;
  bark(e: EnemyView, key: string): void;
  becameAware(e: EnemyView): void;
  died(e: EnemyView, ctx: DeathContext): void;
  knocked(e: EnemyView, info: HitInfo): void;
  melee(e: EnemyView, damage: number, push: V3): void;
  sound(kind: 'roar' | 'clang' | 'step' | 'shout' | 'thud', at: V3): void;
  /** Boss: show/hide his red rift pair between a and b (blink). */
  bossRift?(e: EnemyView, a: V3 | null, b: V3 | null): void;
  /** Boss / officers: call reinforcements (the game spawns them through a gate or nearby). */
  summon?(e: EnemyView, defs: SpawnDef[]): void;
}

export interface EnemyContext {
  time: number;
  player: { pos: V3; chest: V3; vel: V3; alive: boolean; airborne: boolean; crouched: boolean; /** noise this frame */ noise: { at: V3; radius: number }[] };
  world: CollisionWorld;
  rifts: RiftQuery;
  physics: PhysicsAPI;
  /** Only enemies in these zones think; others are frozen and hidden. */
  activeZones: Set<ZoneId>;
}

export interface EnemyAPI {
  readonly list: EnemyView[];
  readonly group: THREE.Group;
  spawn(def: SpawnDef): EnemyView;
  get(id: number): EnemyView | null;
  byKey(key: string): EnemyView | null;
  update(dt: number, ctx: EnemyContext): void;
  /** Apply damage; handles shields, armour, IFF already decided by caller (charged flag). */
  hit(e: EnemyView, info: HitInfo): HitResult;
  /** Force into physics (trapdoor fall, shove, launch). */
  launch(e: EnemyView, vel?: V3): void;
  stagger(e: EnemyView, seconds: number, push?: V3): void;
  kill(e: EnemyView, info: HitInfo): void;
  /** Zone went hot: all its enemies enter combat. */
  alertZone(zone: ZoneId): void;
  /** Threats against the player this frame (for CATCH). */
  threats(): Threat[];
  clear(): void;
  snapshot(): ActorSnap[];
  applySnapshot(s: ActorSnap[]): void;
}

// ---------------------------------------------------------------------------
// Level
// ---------------------------------------------------------------------------

export type ZoneId = 'pier' | 'yard' | 'skeleton' | 'lab' | 'crown';
export type LessonId =
  | 'door' | 'trapdoor' | 'returnToSender' | 'slingshot' | 'arena' | 'loop' | 'cargo' | 'matador'
  | 'grenade' | 'shield' | 'firingLine' | 'hijack' | 'jammer' | 'borrowedGun' | 'boss' | 'leap';

export interface LampDef {
  pos: V3;
  dir: V3;
  color: number;
  range: number;
  angle: number;
  intensity: number;
  kind: 'pole' | 'hang' | 'wall';
}

export interface NavLayer {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  floorY: number;
}

export interface EncounterDef {
  id: string;
  trigger: THREE.Box3;
  spawns: SpawnDef[];
  hintKey?: string;
  lesson?: LessonId;
  requireClear: boolean;
  /** Checkpoint used after this encounter is cleared. */
  checkpoint?: { pos: V3; yaw: number };
}

export interface LiftDef {
  id: string;
  /** Standing volume. */
  platform: THREE.Box3;
  from: V3;
  to: V3;
  /** Encounter ids that must be cleared. */
  requires: string[];
  toZone: ZoneId;
  /** The moving mesh (the game animates it). */
  mesh: THREE.Object3D;
  /** Its collider (moved with the mesh). */
  collider: Collider;
}

export interface ZoneDef {
  id: ZoneId;
  nameKey: string;
  subKey: string;
  bounds: THREE.Box3;
  nav: NavLayer[];
  playerStart: V3;
  startYaw: number;
  /** Below this, bodies die (void). Sea zones use LAW.seaY instead. */
  killY: number;
  sea: boolean;
  encounters: EncounterDef[];
  exit: LiftDef | null;
  challenges: string[];
}

export type PropKind = 'barrel' | 'crate' | 'load' | 'container' | 'beamBundle';

export interface PropDef {
  id: string;
  kind: PropKind;
  zone: ZoneId;
  pos: V3;
  size: V3;
  yaw: number;
  /** Hangs on a cable from this point (drops when a floor end opens under it or the cable is sheared). */
  hangFrom?: V3;
  explosive?: boolean;
  mass: number;
}

export interface GateDef {
  id: string;
  zone: ZoneId;
  inFrame: RiftFrame & { kind: RiftEndKind };
  outFrame: RiftFrame & { kind: RiftEndKind };
  panel: V3;
  waves: SpawnDef[][];
}

export interface HazardDef {
  id: string;
  zone: ZoneId;
  kind: 'crusher' | 'electric' | 'fan';
  box: THREE.Box3;
  period: number;
}

export interface LaserDef {
  id: string;
  zone: ZoneId;
  from: V3;
  dir: V3;
  length: number;
}

export interface TowerLevel {
  world: CollisionWorld;
  root: THREE.Group;
  zoneRoots: Record<ZoneId, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
  animated: ((t: number) => void)[];
  sunDir: V3;
  lamps: LampDef[];
  water: THREE.Mesh | null;
  seaY: number;
  zones: ZoneDef[];
  props: PropDef[];
  gates: GateDef[];
  hazards: HazardDef[];
  lasers: LaserDef[];
  /** Mesh factory for dynamic props. */
  propMesh(def: PropDef): THREE.Object3D;
  /** Crown: helicopter mesh (animated by the game at the end). */
  helicopter: THREE.Object3D | null;
  bossArena: { center: V3; radius: number; y: number; blinkPoints: V3[] } | null;
}

// ---------------------------------------------------------------------------
// Style / tricks / events
// ---------------------------------------------------------------------------

export type TrickId =
  | 'returnToSender' | 'crossfire' | 'postage' | 'firingLine' | 'borrowedGun' | 'trapdoor' | 'splashdown'
  | 'void' | 'skyfall' | 'matador' | 'bowling' | 'headsUp' | 'loop' | 'cannonball' | 'slingshot' | 'comet'
  | 'guillotine' | 'cargo' | 'boom' | 'finisher' | 'ghost' | 'airtime' | 'double' | 'triple' | 'multi'
  | 'mirror' | 'hijack' | 'juggle';

export interface KillEvent {
  type: 'kill';
  t: number;
  enemyId: number;
  enemyKind: EnemyKind;
  cause: DamageSource;
  charged: boolean;
  /** Impact/landing speed. */
  speed: number;
  fallHeight: number;
  /** Crossings / loops of the thing that killed him (projectile/prop/body/player). */
  killerCrossings: number;
  killerLoops: number;
  /** Crossings the victim made before dying. */
  victimCrossings: number;
  /** Projectile fired by the victim himself. */
  ownShot: boolean;
  /** Projectile fired by another enemy (id). */
  shotBy: number | null;
  projectileKind: ProjectileKind | null;
  /** From a turret. */
  turretShot: boolean;
  /** Seconds since that projectile was fired. */
  shotAge: number;
  unaware: boolean;
  witnessed: boolean;
  viaTrapdoor: boolean;
  matador: boolean;
  /** Killed by another launched enemy/body landing on / flying into him. */
  byBody: boolean;
  /** Killed by a prop (cargo). */
  byProp: boolean;
  /** Killed by an exploding barrel. */
  byBarrel: boolean;
  /** Player's own body was the impactor (slingshot/comet). */
  byPlayer: boolean;
  /** Player crossed floor/air → wall/air end right before the impact. */
  playerFling: boolean;
  playerAirborne: boolean;
  /** The impactor was a launched enemy/corpse id (bowling / heads up). */
  impactorId: number | null;
  at: V3;
}

export interface KnockEvent { type: 'knock'; t: number; enemyId: number; cause: DamageSource; impactorId: number | null; at: V3 }
export interface CrossEvent { type: 'cross'; t: number; who: BodyKind | 'bolt' | 'beam'; speed: number; loops: number; fromKind: RiftEndKind; toKind: RiftEndKind }
export interface CatchEvent { type: 'catch'; t: number; count: number }
export interface AirEvent { type: 'air'; t: number; phase: 'start' | 'end'; seconds: number; crossings: number }
export interface HurtEvent { type: 'hurt'; t: number; amount: number }
export interface SimpleEvent { type: 'hijack' | 'shear' | 'explode' | 'zone' | 'death' | 'checkpoint'; t: number; at?: V3; zone?: ZoneId }

export type GameEvent = KillEvent | KnockEvent | CrossEvent | CatchEvent | AirEvent | HurtEvent | SimpleEvent;

export interface TrickAward {
  id: TrickId;
  /** i18n key, e.g. 'trick.returnToSender'. */
  key: string;
  points: number;
  /** Extra label like "×5" for loops. */
  suffix?: string;
  t: number;
  at?: V3;
  halved?: boolean;
}

export type StyleRank = 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';

export interface StyleState {
  rank: StyleRank;
  /** 0..1 progress inside the rank. */
  meter: number;
  /** Points in the running chain (before variety multiplier). */
  chainPoints: number;
  /** Distinct trick ids in the chain (the multiplier). */
  variety: number;
  chain: TrickAward[];
  /** Seconds left before the chain banks. */
  chainT: number;
  total: number;
  bestCombo: number;
  lastCombo: number;
}

export interface StyleAPI {
  readonly state: StyleState;
  /** Feed an event, get tricks awarded now. */
  push(e: GameEvent): TrickAward[];
  update(dt: number, playerAirborne: boolean): { banked: number } | null;
  reset(): void;
}

// ---------------------------------------------------------------------------
// Replay / clips / photo
// ---------------------------------------------------------------------------

export interface ActorSnap {
  key: string;
  pos: Tuple3;
  yaw: number;
  pose: CharacterPose;
  visible: boolean;
}

export interface RiftSnap {
  id: number;
  pos: Tuple3;
  quat: Tuple4;
  kind: RiftEndKind;
  open: number;
  color: 'entrance' | 'exit' | 'gate' | 'boss';
  linkedId: number;
}

export interface ProjSnap { kind: ProjectileKind; pos: Tuple3; charged: boolean; to?: Tuple3[] }
export interface PropSnap { key: string; pos: Tuple3; quat: Tuple4; visible: boolean }

export interface Snapshot {
  t: number;
  cam: { pos: Tuple3; quat: Tuple4; fov: number };
  actors: ActorSnap[];
  rifts: RiftSnap[];
  projs: ProjSnap[];
  props: PropSnap[];
  tricks: TrickAward[];
  timeScale: number;
  /** Player position (for cinematic framing). */
  focus: Tuple3;
}

export interface ReplayHost {
  camera: THREE.PerspectiveCamera;
  /** WebGL canvas. */
  canvas: HTMLCanvasElement;
  apply(s: Snapshot): void;
  /** Render one frame with the current camera (no simulation). */
  render(): void;
  beginReplay(): void;
  endReplay(): void;
  /** For cinematic cameras: can a camera at `a` see `b`? */
  lineOfSight(a: V3, b: V3): boolean;
}

// ---------------------------------------------------------------------------
// HUD / input / audio surfaces (UI + AUDIO workstreams)
// ---------------------------------------------------------------------------

export type Action =
  | 'aim' | 'place' | 'gate' | 'close' | 'action' | 'jump' | 'sprint' | 'crouch' | 'shove'
  | 'flip' | 'vision' | 'clip' | 'photo' | 'pause';

export interface AimInfo {
  valid: boolean;
  reason: string | null;
  kind: RiftEndKind;
  distance: number;
  outcome: ExitAim['outcome'];
  dropBelow: number;
  orientation: ExitOrientation;
}

export interface GateHint {
  mode: EntranceMode | null;
  /** i18n key of the reason when the gate would do nothing useful / be refused. */
  reason: string | null;
  targetKey: string | null;
}

export interface ScreenMarker {
  x: number;
  y: number;
  onScreen: boolean;
  angle: number;
  kind: 'threat' | 'objective' | 'target' | 'gate';
  label?: string;
}

export interface HudAPI {
  readonly el: HTMLElement;
  show(v: boolean): void;
  setHealth(hp: number, max: number): void;
  setStyle(s: StyleState): void;
  popTrick(a: TrickAward): void;
  comboBanked(points: number, rank: StyleRank): void;
  setAim(info: AimInfo | null): void;
  setGateHint(h: GateHint | null): void;
  setRiftState(s: { exit: boolean; entrance: boolean; aiming: boolean; orientation: ExitOrientation }): void;
  setPrompt(label: string | null): void;
  setMarkers(list: ScreenMarker[]): void;
  setObjective(text: string, sub?: string): void;
  zoneTitle(name: string, sub: string): void;
  toast(text: string, kind?: 'info' | 'warn' | 'good'): void;
  hint(key: string, html: string, dur?: number): void;
  clearHint(): void;
  offerClip(v: boolean): void;
  setVision(on: boolean): void;
  damageFlash(amount: number): void;
  update(dt: number): void;
}

export interface AudioAPI {
  unlock(): void;
  updateListener(cam: THREE.Camera): void;
  setIntensity(tension: number, combat: number, dt: number): void;
  setAltitude(y: number): void;
  setSlowmo(amount: number): void;
  // rifts
  riftOpen(pos: V3, which: 'entrance' | 'exit' | 'gate'): void;
  riftClose(pos: V3): void;
  hum(pos: V3): { stop(): void; move(v: V3): void };
  riftPass(pos: V3, speed: number): void;
  riftCatch(pos: V3): void;
  loopWhoosh(speed: number): void;
  shear(pos: V3): void;
  hijack(pos: V3): void;
  // combat
  boltFire(pos: V3): void;
  boltWhizz(pos: V3): void;
  boltImpact(pos: V3, charged: boolean): void;
  laserLock(pos: V3): void;
  beamCharge(pos: V3): void;
  beamFire(pos: V3): void;
  grenadeBounce(pos: V3): void;
  explosion(pos: V3, size: number): void;
  splash(pos: V3, size: number): void;
  impact(pos: V3, speed: number): void;
  shieldClang(pos: V3): void;
  roar(pos: V3): void;
  bladeFinish(pos: V3): void;
  shove(pos: V3): void;
  // player
  footstep(pos: V3, loud: number, metal?: boolean): void;
  jump(pos: V3): void;
  land(pos: V3, speed: number): void;
  hurt(): void;
  wind(speed: number): void;
  // meta
  trick(rank: StyleRank, points: number): void;
  comboBank(points: number): void;
  ui(kind: 'click' | 'confirm' | 'deny' | 'pickup' | 'objective' | 'clip' | 'shutter'): void;
  lift(pos: V3, on: boolean): void;
  sting(kind: 'alert' | 'zone' | 'boss' | 'victory'): void;
}
