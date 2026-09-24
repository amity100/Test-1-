import * as THREE from 'three';
import type { CharacterAPI, DynBody, EnemyKind, EnemyState, EnemyView, LocomotionInput, SpawnDef, V3 } from '../core/contracts';
import type { NavGrid } from '../world/nav';
import { KIND, type KindTune } from './tuning';

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
export type AttackKind = 'burst' | 'fan' | 'return' | 'beam' | 'lob' | 'bash' | 'punch' | 'charge';

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

  constructor(readonly id: number, readonly def: SpawnDef, char: CharacterAPI, body: DynBody | null, senseOffset: number) {
    this.key = `enemy:${id}`;
    this.kind = def.kind;
    this.tune = KIND[def.kind];
    this.hp = this.maxHp = this.tune.hp;
    this.radius = this.tune.radius;
    this.height = this.tune.height;
    this.char = char;
    this.body = body;
    this.yaw = def.yaw;
    this.lookBase = def.yaw;
    this.home.copy(def.pos);
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
