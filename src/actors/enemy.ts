import * as THREE from 'three';
import type { CharacterAPI, DynBody, EnemyKind, EnemyState, EnemyView, LocomotionInput, SpawnDef, V3 } from '../core/contracts';
import type { NavGrid } from '../world/nav';
import { KIND, ONS, type KindTune } from './tuning';
import { REACH } from '../game/reach';

/** What he believes (states like stagger/launched are only bodily). */
export type Mode = 'calm' | 'suspicious' | 'combat';

/**
 * Attack sub-phase:
 * aim   laser / beam / arc telegraph (holds an attack token for guns)
 * fire  burst in progress (token)
 * windup melee / throw wind-up
 * roar  brute charge telegraph, run: brute charging
 * recover after a melee swing
 */
export type AttackPhase = 'none' | 'aim' | 'fire' | 'windup' | 'roar' | 'run' | 'recover';
export type AttackKind = 'burst' | 'fan' | 'return' | 'beam' | 'lob' | 'bash' | 'punch' | 'charge' | 'strike' | 'rush' | 'slam' | 'suppress';

/** ONSLAUGHT: what a man of its squad is up to beyond his attack (actors/onslaught.ts). */
export class OnsState {
  /** The zig-zag's phase (rad). */
  zig = 0;
  /** Which way he circles you while he waits for a blow (+1 / -1). */
  side = 1;
  /** Sent round your side: where to (flankT s left). */
  readonly flank = new THREE.Vector3();
  flankT = 0;
  /** Suppressive fire on where you were last known, this long more (s). */
  suppressT = 0;
  /** A melee rush / blow under way: how far it has run, its line. */
  runDist = 0;
  readonly runDir = new THREE.Vector3();
  readonly runLast = new THREE.Vector3();
  lowMove = 0;
  /** It met you. */
  landed = false;
  /** A stormer springing back out of reach after a blow, this long more (s). */
  backT = 0;
  /** A stormer has closed on you once (his size-up is spent). */
  engaged = false;
  /** Slam cooldown (the brute's charge keeps its own). */
  slamCd = 0;
  /** A gun: how long he hasn't had you in sight (s). */
  blindT = 0;
  /** Stuck watch: where he was when the clock last started, and for how long. */
  readonly stuckAt = new THREE.Vector3();
  stuckT = 0;
  unstuck = 0;
}

/** One Kessler actor. All fields are public for the system and tests; the game sees it as an EnemyView. */
export class Enemy implements EnemyView {
  readonly key: string;
  readonly tune: KindTune;
  readonly kind: EnemyKind;
  state: EnemyState;
  mode: Mode = 'calm';
  yaw: number;
  hp: number;
  readonly maxHp: number;
  readonly radius: number;
  readonly height: number;
  body: DynBody | null;
  readonly char: CharacterAPI;
  /** Fallback position once the body is gone (dead turret, void). */
  readonly home = new THREE.Vector3();
  readonly loco: LocomotionInput = { speed: 0, grounded: true, vy: 0, crouch: 0, aim: 0, weaponUp: 0, downed: false };

  // --- lifecycle
  age = 0;
  active = false;
  activeT = 0;
  thinking = true;
  stateT = 0;
  /** Physical state timer (stagger / downed / stunned). */
  holdT = 0;
  noGroundT = 0;
  groundT = 0;
  sinkT = 0;
  corpseTumble = false;
  /** Hidden for good (void, sunk). */
  gone = false;
  /** Squared distance to the player (thinking budget ranking). */
  rankD = 0;

  // --- perception
  sus = 0;
  senseT: number;
  senseAcc = 0;
  seesPlayer = false;
  seeDist = Infinity;
  lastSeenT = -1e9;
  /** When his current unbroken view of the player began (a steadier aim the longer it lasts). */
  viewT = 0;
  /** Where he believes the player is: only what he saw, heard or was told. */
  readonly lastKnown = new THREE.Vector3();
  hasLastKnown = false;
  /** When that belief was fresh (a sighting, a noise, a mate's shout). */
  contactT = -1e9;
  /** In combat but lost track: hunting around lastKnown until searchT runs out. */
  searching = false;
  searchT = 0;
  /** Stood down lately: quicker to notice again. */
  alertT = 0;
  calloutT = 0;
  readonly investigate = new THREE.Vector3();
  lostBarked = false;
  /** Looking at where a rift hit came from. */
  readonly lookAt = new THREE.Vector3();
  lookT = 0;
  /** Warden: shield turned toward this for shieldT seconds. */
  readonly shieldFrom = new THREE.Vector3();
  shieldT = 0;
  recoverToCombat = false;
  barkT = 0;

  // --- navigation
  grid: NavGrid | null = null;
  gridY = NaN;
  stranded = false;
  readonly path: THREE.Vector3[] = [];
  pathLen = 0;
  pathIdx = 0;
  pathPending = false;
  pathFailed = false;
  readonly goal = new THREE.Vector3();
  hasGoal = false;
  repathT = 0;
  /** Last time a walk stepped him along his path (a walk under way, not a path left lying after a halt). */
  walkT = -1e9;
  readonly moveVel = new THREE.Vector3();
  readonly pushVel = new THREE.Vector3();
  readonly progressAt = new THREE.Vector3();
  progressT = 0;
  readonly spot = new THREE.Vector3();
  hasSpot = false;
  spotT = 0;
  routeIdx = 0;
  waitT = 0;
  lookBase = 0;

  // --- the ground he holds (roles, DESIGN §5)
  /** How he holds ground now (his spawn's role; a holder thrown off his perch fights on as an anchor). None: the old free behaviour. */
  role: SpawnDef['role'];
  /** Centre of the ground he holds: his spawn, then his fallback, or where he landed off his floor. */
  readonly post = new THREE.Vector3();
  /** How far from his post he goes in a fight (m; Infinity: no role, no limit). */
  leash = Infinity;
  /** His one fallback is spent (taken, or he was thrown off his ground). */
  fellBack = false;
  /** On his way to his fallback post. */
  retreating = false;
  /** Pushed off his ground on his own floor: walking back to his post. */
  returning = false;
  /** Walks back to his post that found no way there, in a row. */
  postFails = 0;
  /** No spot in his band: the next look for one inside his ground (a line-of-sight ray per try) waits until then. */
  groundTryT = -1e9;
  /** A holder has called "He's up here!" (once). */
  upHereBarked = false;

  // --- attacks
  atk: AttackPhase = 'none';
  atkKind: AttackKind = 'burst';
  atkT = 0;
  atkDur = 0;
  shotsLeft = 0;
  shotT = 0;
  shotGap = 0.12;
  lobFlight = 1;
  token = false;
  /** Waiting for a turn to fire since queuedT (asked last at askedT). */
  queuedT = 0;
  askedT = -1e9;
  reloadT = 0;
  lobT = 0;
  /** When a clear throwing arc was last found (while he waits his turn to throw). */
  arcT = -1e9;
  meleeCd = 0;
  bursts = 0;
  /** Unaware sight multiplier: the game keeps it low until the player reaches his fight. */
  sightScale = 1;
  readonly muzzle = new THREE.Vector3();
  readonly aimPt = new THREE.Vector3();
  readonly lobVel = new THREE.Vector3();
  readonly chargeDir = new THREE.Vector3(0, 0, 1);
  readonly runLast = new THREE.Vector3();
  runDist = 0;
  runFrames = 0;
  lowMove = 0;
  chargeCd = 0;
  chargeHit = false;
  pitch = 0;

  // --- launch chain (reset when he is back on his feet)
  launchChain = false;
  launchUnaware = false;
  crossings = 0;
  loops = 0;
  viaTrapdoor = false;
  matador = false;
  /** In the PORTAL's grip: sunk into the floor end under him, doing nothing. */
  held = false;
  /** How deep his model is drawn into the floor (m, visual only). */
  sink = 0;

  // --- boss
  phase: 1 | 2 | 3 = 1;
  blink: 'none' | 'warn' | 'pass' = 'none';
  blinkT = 0;
  blinkNext = 0;
  readonly blinkFrom = new THREE.Vector3();
  readonly blinkTo = new THREE.Vector3();
  summonT = 0;
  returnT = -1;
  greeted = false;

  // --- ONSLAUGHT (only for a man spawned with `def.onslaught`)
  readonly arch: 'stormer' | 'suppressor' | null;
  readonly ons: OnsState | null;

  // --- REACH (only for a man spawned with `def.reach`)
  readonly reach: boolean;
  readonly reachRole: 'rusher' | 'gunner' | 'flanker' | null;
  /** How far up his rifle is (the game's REACH brain sets it: 0 empty-handed / a knife). */
  reachPose = 0;

  constructor(readonly id: number, readonly def: SpawnDef, char: CharacterAPI, body: DynBody | null, senseOffset: number) {
    this.key = `enemy:${id}`;
    this.kind = def.kind;
    this.tune = KIND[def.kind];
    this.arch = def.onslaught ? def.archetype ?? null : null;
    this.ons = def.onslaught ? new OnsState() : null;
    this.reach = !!def.reach;
    this.reachRole = def.reachRole ?? null;
    this.hp = this.maxHp = this.arch ? ONS[this.arch].hp : this.reach ? REACH.enemy.hp : this.tune.hp;
    this.radius = this.tune.radius;
    this.height = this.tune.height;
    this.char = char;
    this.body = body;
    this.yaw = def.yaw;
    this.lookBase = def.yaw;
    this.home.copy(def.pos);
    this.role = def.role;
    this.senseT = senseOffset;
    this.state = 'idle';
  }

  get pos(): V3 {
    return this.body ? this.body.pos : this.home;
  }

  get alive() {
    return this.state !== 'dead';
  }

  get aware() {
    return this.alive && this.mode !== 'calm';
  }

  get armored() {
    return this.tune.armored;
  }

  get perched() {
    return !!this.def.perch || this.kind === 'sniper' || this.kind === 'turret';
  }

  /** Can be trapdoored right now (DESIGN §3). */
  get offBalance() {
    const s = this.state;
    if (s === 'dead' || this.kind === 'turret') return false;
    if (this.kind === 'boss') return s === 'stunned' || s === 'launched' || s === 'downed';
    return s !== 'combat';
  }

  /** Steady combat enemy: trapdoors are refused, rift ends keep clear of him. */
  get steady() {
    if (!this.alive) return false;
    if (this.kind === 'turret') return true;
    return !this.offBalance;
  }

  get blinking() {
    return this.blink === 'pass';
  }

  chest(out = new THREE.Vector3()): V3 {
    const p = this.pos;
    return out.set(p.x, p.y + this.height * 0.72, p.z);
  }

  eye(out = new THREE.Vector3()): V3 {
    const p = this.pos;
    return out.set(p.x, p.y + this.height * 0.92, p.z);
  }

  forward(out = new THREE.Vector3()): V3 {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }
}
