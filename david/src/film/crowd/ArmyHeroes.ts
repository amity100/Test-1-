/*
 * ArmyHeroes — full FilmActor soldiers standing in for the crowd figures nearest the lens (docs/intro-script-v2.md
 * G1-G4; director-notes-v4: "the soldiers near the lens read as mannequins"; visual-bible 3.4 MUST: rams' horns in the
 * front rank). Every shot, each hero takes the formation slot nearest the camera that is in view (the horn blowers
 * get the front rank in G1), the crowd figure of that slot is hidden (GilgalArmy.setActorSlots), and the hero plays
 * that soldier's part with real motion capture on the full human (his own march take, the halt, his roar take with
 * the mouth open, the freeze, the head turned to the road, the step aside) — so the near men are alive in close-up.
 *
 * The rams' horns (שׁוֹפָר, Josh 6; Judg 3:27; 1 Sam 13:3 "וְשָׁאוּל תָּקַע בַּשּׁוֹפָר"): in G1 at the beat `horns` two or
 * three men lift the horn to the lips — the horn is placed each frame between the hand (carried) and the blowing
 * position at the mouth (the mouthpiece at the lips, the bell raised forward), the hands follow it by arm IK; the
 * head goes back, the cheeks fill, the chest heaves.
 */
import * as THREE from 'three';
import type { FilmActor, Quality } from '../cast/FilmActor';
import { BEATS, MARCH_SPEED, type GilgalShotName } from '../gilgal/gilgalBlocking';
import { TAKE_OFFSET } from '../FilmCams';
import type { CrowdTier } from './Crowd';
import type { CrowdDust } from './CrowdDust';
import { FootLock, Swing } from './actorMotion';

export interface HeroRole {
  kit: 'horn' | 'spear';
  seed: number;
  /** index among the heroes of this kit (G1: the horn blowers lift their horns one after another) */
  index?: number;
}

/** what the crowd soldier of a slot does now (filled by GilgalArmy.setBeat) */
export interface HeroCue {
  file: number;
  rank: number;
  pos: THREE.Vector3;
  yaw: number;
  headYaw: number;
  state: string;
  walk: string;
  idle: string;
  cheer: string;
  mirror: boolean;
  phase: number;
  pace: number;
  /** the soldier's roar start (shot seconds), -1 = none */
  roarT: number;
  /** (wave 6) his ground speed now (m/s of action time): the walk take is time-warped to it */
  speed: number;
}

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * heroes per tier: [horn blowers, near soldiers] and their content quality.
 * (host1, wave 6: more of the men near the lens are full actors, at the quality their distance needs — 'medium' on
 *  desktop-high (~120 k triangles, ~2 s to build) instead of 'high' (~205 k, ~3.3 s): 3 + 4 builds in the time 3 + 2 took
 *  (the Gilgal set's build time must not grow); phones unchanged)
 */
export const HERO_COUNT: Record<CrowdTier, [number, number]> = {
  'desktop-high': [3, 4],
  'desktop-medium': [3, 2],
  'mobile-high': [2, 0],
  'mobile-low': [2, 0],
};
const HERO_Q: Record<CrowdTier, Quality> = { 'desktop-high': 'medium', 'desktop-medium': 'low', 'mobile-high': 'low', 'mobile-low': 'low' };

/** the roar takes a hero chains through (the crowd's Rocketbox cheers) */
const HERO_CHEERS = ['cheer_1', 'cheer_2', 'cheer_3', 'cheer_4', 'cheer_5'];

type Pose = { ua: [number, number, number]; fa: [number, number, number]; hd: [number, number, number] };
/**
 * (host1, wave 6 — as P6's vanguard) the spear carried at the side: the fist out at the right hip, the elbow bent, so the
 * upright shaft rises beside the shoulder and never across the face (before: the fist at the belt, the shaft in front)
 */
const CARRY: Pose = { ua: [-0.08, -0.08, -0.24], fa: [-1.1, 0, 0], hd: [0.08, 0, 0.05] };
/** the shield arm: the forearm forward and down, the fist at the hip (the shield is placed at it every frame) */
const SHIELD_ARM: Pose = { ua: [-0.06, 0.05, 0.13], fa: [-0.82, 0.12, 0], hd: [0, 0.3, 0.05] };
/** the spear slides up through the fist (m): gripped near its balance point the butt rides ~0.2 m over the road */
const SPEAR_RAISE = 0.22;

const _gp = new THREE.Vector3(), _gv = new THREE.Vector3(), _ga = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3();
const _n = new THREE.Vector3(), _sx = new THREE.Vector3(), _sy = new THREE.Vector3(), _sm = new THREE.Matrix4(), _smi = new THREE.Matrix4();

const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _s = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _c1 = new THREE.Vector3();
const _c2 = new THREE.Vector3();

class Hero {
  cue: HeroCue | null = null;
  private clip = '';
  private lastState = '';
  private roaring = false;
  readonly look = new THREE.Vector3();
  readonly hornTarget = new THREE.Vector3();
  readonly hornL = new THREE.Vector3();
  /** the horn (not parented: placed each frame between the hand and the mouth) */
  horn: THREE.Object3D | null = null;
  hornGrip: THREE.Object3D | null = null;
  hornMid: THREE.Vector3 | null = null;
  blow = 0;
  /** CUT v3 (G3): cheer takes chained in this roar (the roar is held 3.3 s to the cut) */
  private chain = 0;
  // ---- (wave 6) the vanguard's machinery: the spear's lag on the grip, the shield's swing, the planted feet, the dust
  private readonly spear = new Swing(70, 4.2);
  private readonly spear0: [number, number];
  private readonly gripPrev = new THREE.Vector3();
  private readonly gripVel = new THREE.Vector3();
  private hasGrip = false;
  private readonly shield = new Swing(55, 5.5);
  private shieldObj: THREE.Object3D | null = null;
  private readonly shieldTurn: number;
  private readonly locks = [new FootLock(1, 2), new FootLock(4, 8)];
  dust: CrowdDust | null = null;
  private steps = 0;
  private carrying = false;
  constructor(readonly actor: FilmActor, readonly role: HeroRole) {
    const a = actor;
    a.mocap.rootMotion = 'inplace';
    a.cancelHeading = true;
    a.headingRate = 2.2;
    const h = (k: number) => {
      const x = Math.sin(role.seed * 12.9898 + k * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    // each man's own carry: tipped forward 2-11°, out to his right 1-7°
    this.spear0 = [0.04 + 0.15 * h(2), 0.02 + 0.1 * h(3)];
    this.shieldTurn = 0.45 + 0.3 * h(9);
    if (role.kit === 'spear' && a.props.main) {
      a.holdProp('main', 'R');
      a.upright.R.prop = 'main';
      a.upright.R.weight = 1;
      // gripped nearer its balance point (dressSoldier grips 1.0 m from the butt: carried upright at the side it dragged
      // through the ground)
      a.props.main.translateY(SPEAR_RAISE);
    }
    if (role.kit === 'horn' && a.props.main) {
      const o = a.props.main;
      const prop = o.userData.prop as { grip: THREE.Object3D; butt: THREE.Object3D; tip: THREE.Object3D } | undefined;
      if (prop) {
        this.horn = o;
        this.hornGrip = prop.grip;
        // a point half-way along the horn for the supporting left hand
        this.hornMid = prop.grip.position.clone().lerp(prop.tip.position, 0.45);
      }
      a.human.rig.setFingers('R', 'grip');
    }
    // the shield by its central grip in the left fist, placed every frame in the man's own frame (its face out to his left
    // and a little forward) with its own swing — before: glued to the hand, it flipped with every arm swing
    const sh = a.props.shield;
    if (sh && role.kit === 'spear') {
      a.root.add(sh);
      sh.matrixAutoUpdate = false;
      this.shieldObj = sh;
      a.human.rig.setFingers('L', 'grip');
    }
    // footfalls: the heel strike jolts the shaft and the shield; a puff of dust where the foot came down
    a.mocap.onFootstep = (side) => this.footfall(side);
  }

  /** the cut into a beat: the springs at rest, the locks free */
  reset() {
    this.spear.reset(this.spear0[0], this.spear0[1]);
    this.shield.reset(0, 0);
    this.hasGrip = false;
    for (const l of this.locks) l.reset();
  }

  private footfall(side: 'L' | 'R') {
    this.steps++;
    this.spear.vx += 0.3 + 0.03 * (this.steps % 5);
    this.shield.vy += (side === 'L' ? 1 : -1) * 0.25;
    const a = this.actor;
    if (!this.dust || !a.root.visible) return;
    const foot = (a.human.bones as Record<string, THREE.Object3D>)[`foot.${side}`];
    if (!foot) return;
    foot.getWorldPosition(_gp);
    this.dust.emit(_gp.x, a.root.position.y, _gp.z, Math.sin(a.yaw), Math.cos(a.yaw), 0.8);
  }

  /** the spear: a damped pendulum on the grip, driven by the fist's acceleration (it lags the hand) */
  private swingSpear(dt: number, yaw: number) {
    const a = this.actor;
    a.human.sockets.handGripR.getWorldPosition(_gp);
    _f.set(Math.sin(yaw), 0, Math.cos(yaw));
    _r.set(-_f.z, 0, _f.x);
    let af = 0, ar = 0;
    if (this.hasGrip && dt > 1e-4) {
      _gv.copy(_gp).sub(this.gripPrev).divideScalar(dt);
      _ga.copy(_gv).sub(this.gripVel).divideScalar(dt);
      this.gripVel.copy(_gv);
      af = THREE.MathUtils.clamp(_ga.dot(_f), -6, 6);
      ar = THREE.MathUtils.clamp(_ga.dot(_r), -6, 6);
    } else this.gripVel.set(0, 0, 0);
    this.gripPrev.copy(_gp);
    this.hasGrip = true;
    if (dt > 0) {
      this.spear.step(dt, this.spear0[0], this.spear0[1], -af * 0.7, -ar * 0.7);
      this.shield.step(dt, 0, 0, -af * 0.5, -ar * 0.9);
    }
    const sx = THREE.MathUtils.clamp(this.spear.x, -0.2, 0.45), sy = THREE.MathUtils.clamp(this.spear.y, -0.25, 0.25);
    a.upright.R.axis.set(0, Math.cos(sx) * Math.cos(sy), 0).addScaledVector(_f, Math.sin(sx)).addScaledVector(_r, Math.sin(sy)).normalize();
  }

  /** the shield at the left fist: face out to his left, turned toward his front, swinging on the grip */
  private placeShield(yaw: number) {
    const a = this.actor, sh = this.shieldObj!;
    const turn = this.shieldTurn + THREE.MathUtils.clamp(this.shield.y, -0.35, 0.35);
    const tilt = THREE.MathUtils.clamp(this.shield.x, -0.3, 0.3) * 0.6 + 0.06;
    _f.set(Math.sin(yaw), 0, Math.cos(yaw));
    _r.set(-_f.z, 0, _f.x);
    _n.copy(_r).multiplyScalar(-Math.cos(turn)).addScaledVector(_f, Math.sin(turn)).normalize();
    _sy.set(0, 1, 0).addScaledVector(_n, -Math.sin(tilt)).normalize();
    _sx.crossVectors(_sy, _n).normalize();
    _sy.crossVectors(_n, _sx);
    _sm.makeBasis(_sx, _sy, _n);
    a.human.sockets.handGripL.getWorldPosition(_gp);
    _gp.addScaledVector(_n, 0.03);
    _sm.setPosition(_gp);
    a.root.updateWorldMatrix(true, false);
    _smi.copy(a.root.matrixWorld).invert();
    sh.matrix.multiplyMatrices(_smi, _sm);
    sh.matrixWorldNeedsUpdate = true;
  }

  play(name: string, o: { fade?: number; time?: number; mirror?: boolean; speed?: number } = {}) {
    this.clip = name;
    this.actor.mocap.play(name, { fade: o.fade ?? 0.3, time: o.time ?? 0, mirror: o.mirror, speed: o.speed });
  }

  /** place the horn: carried in the hand (w = 0) .. blown at the mouth (w = 1) */
  placeHorn(w: number) {
    const a = this.actor;
    if (!this.horn || !this.hornGrip) return;
    const parent = a.root.parent;
    if (!parent) return;
    if (this.horn.parent !== parent) parent.add(this.horn);
    // carried: the grip frame on the hand's grip socket (as attachProp does)
    const sock = a.human.sockets.handGripR;
    sock.updateWorldMatrix(true, false);
    _m.compose(this.hornGrip.position, this.hornGrip.quaternion, _s.set(1, 1, 1)).invert();
    _m2.multiplyMatrices(sock.matrixWorld, _m);
    const carryP = _p.setFromMatrixPosition(_m2);
    const carryQ = _q.setFromRotationMatrix(_m2);
    // blown: the mouthpiece (the prop's origin = its butt) at the lips, the first stretch of the horn along the face's
    // forward (a little down and to his right), the curl (+X of the prop) turning up so the bell rises
    const head = a.human.bones.head;
    head.updateWorldMatrix(true, false);
    a.eyesWorld(_p2);
    head.getWorldPosition(_x);
    const fwd = _z.copy(_p2).sub(_x).setY(0);
    if (fwd.lengthSq() < 1e-8) fwd.set(Math.sin(a.yaw), 0, Math.cos(a.yaw));
    fwd.normalize();
    const up = _y.set(0, 1, 0);
    const right = _x.crossVectors(fwd, up).normalize();
    const mouth = _p2.addScaledVector(up, -0.082).addScaledVector(fwd, 0.055).addScaledVector(right, 0.018);
    // the first stretch forward, down and out to his right (the horn clear of the face), so the curl lifts the bell
    // forward-up (not straight up)
    const along = _s.copy(fwd).multiplyScalar(0.85).addScaledVector(up, -0.42).addScaledVector(right, 0.45).normalize();
    // prop axes: +Y along the first stretch, +X the curl (up), +Z = X x Y
    const curl = _c1.copy(up).addScaledVector(along, -up.dot(along)).normalize();
    const zAx = _c2.crossVectors(curl, along).normalize();
    _m2.makeBasis(curl, along, zAx);
    const blowQ = _q2.setFromRotationMatrix(_m2);
    this.horn.position.copy(carryP).lerp(mouth, w);
    this.horn.quaternion.copy(carryQ).slerp(blowQ, w);
    this.horn.updateMatrixWorld(true);
    // the hands on the horn: the right at its grip, the left under its middle
    this.hornTarget.copy(this.hornGrip.position).applyMatrix4(this.horn.matrixWorld);
    if (this.hornMid) this.hornL.copy(this.hornMid).applyMatrix4(this.horn.matrixWorld);
  }

  update(shot: GilgalShotName, t: number, dt: number, camera: THREE.Camera | undefined, viewportH: number | undefined, wind: THREE.Vector3, samuelEyes: THREE.Vector3) {
    const a = this.actor;
    const c = this.cue;
    if (!c) {
      a.setVisible(false);
      return;
    }
    a.setVisible(true);
    a.place(c.pos, c.yaw);
    const st = c.state;
    const changed = st !== this.lastState;
    this.lastState = st;
    const mp = a.mocap;
    // ---- the clip of the soldier's state
    if (st === 'march') {
      if (changed || this.clip !== c.walk) this.play(c.walk, { fade: 0, time: c.phase, mirror: c.mirror });
      // (wave 6) time-warped to his ground speed now (the halt of G3 slows him onto his mark: the step shortens with it)
      mp.matchSpeed(c.walk, Math.max(0.25, c.speed > 0 ? c.speed : MARCH_SPEED));
    } else if (st === 'roar') {
      if (changed) {
        this.chain = 0;
        this.play(c.cheer, { fade: 0.16, time: 0.1, mirror: c.mirror && this.role.kit !== 'spear' });
      } else if (mp.remaining() < 0.35) {
        // the take runs out before the cut: on into his next cheer (never a held last frame)
        this.chain++;
        const next = HERO_CHEERS[(HERO_CHEERS.indexOf(this.clip) + 1 + ((c.file + this.chain) % 3)) % HERO_CHEERS.length];
        this.play(next, { fade: 0.35, time: 0.25, mirror: (c.mirror !== (this.chain % 2 === 1)) && this.role.kit !== 'spear' });
      }
    } else if (st === 'freeze') {
      if (changed && !this.roaring) this.play(c.cheer, { fade: 0, time: 1.2, mirror: c.mirror && this.role.kit !== 'spear' });
      // (wave 6) the shout breaks off on the cut: the take slows into the drop of the arms (never a frozen pose)
      mp.setSpeed(this.clip, 0.35);
    } else if (st === 'look') {
      if (changed) this.play(Math.sin(c.yaw * 7 + c.file) > 0 ? 'look_around_R' : 'look_around_L', { fade: 0.7, time: 0.35 });
    } else if (st === 'step') {
      if (changed) this.play('walk_n1', { fade: 0.3, time: c.phase });
      mp.matchSpeed('walk_n1', Math.max(0.25, c.speed > 0 ? c.speed : Math.hypot(a.velocity.x, a.velocity.z)));
    } else if (changed || this.clip === '') this.play(c.idle, { fade: st === 'lower' ? 0.7 : 0.45, time: c.phase * 1.7 });
    this.roaring = st === 'roar' || (st === 'freeze' && this.roaring);
    // ---- the spear carried at the side (upright, lagging the fist) except in the roar; the shield arm at the hip
    if (this.role.kit === 'spear') {
      const carry = st === 'march' || st === 'halt' || st === 'idle' || st === 'lower' || st === 'step' || st === 'look';
      a.armPose.R.pose = carry ? CARRY : null;
      a.armPose.R.weight = carry ? 0.75 : 0;
      a.upright.R.weight = carry ? 1 : 0.4;
      if (carry) this.swingSpear(dt, c.yaw);
      else {
        a.upright.R.axis.set(0, 1, 0);
        this.hasGrip = false;
      }
      this.carrying = carry;
      if (this.shieldObj) {
        a.armPose.L.pose = carry ? SHIELD_ARM : null;
        a.armPose.L.weight = carry ? 0.6 : 0;
      }
    }
    // ---- the rams' horns (G1): lifted to the lips at the beat and blown
    let blow = 0;
    if (this.role.kit === 'horn') {
      if (shot === 'dustWall') {
        // CUT v3 (G1 5.5 s): lifted to the lips on `horns` one after another, each a long blast (2.0-2.4 s), then
        // lowered before the cut
        // (CUT v5: the contract's G1 beats are shot seconds from the shofar; the blocking runs on the old clock, so the
        //  horns come up at the same blocking second as in CUT v4: beats.horns + TAKE_OFFSET 1.5 = 2.1)
        const k = this.role.index ?? 0;
        const h = BEATS.dustWall.horns + (TAKE_OFFSET.dustWall ?? 0) + 0.15 * k;
        const end = h + 2.0 + 0.2 * k;
        blow = ss(h - 0.3, h + 0.08, t) * (1 - ss(end, end + 0.5, t));
      } else if (st === 'roar' || st === 'freeze') blow = 0;
      this.blow = blow;
      this.placeHorn(blow);
      a.reach.R.target = this.hornTarget;
      a.reach.R.weight = blow;
      a.reach.L.target = this.hornL;
      a.reach.L.weight = blow * 0.9;
      a.human.rig.setFingers('L', blow > 0.3 ? 'grip' : 'relaxed');
      a.human.rig.faceUnits.CheeksPump = 0.75 * ss(0.4, 0.9, blow);
      // straining into the blast: leaning back, the chest heaving, a small sway
      a.body.lean = -0.07 * blow + 0.02 * Math.sin(t * 2.6 + (this.role.index ?? 0)) * blow;
      a.breath.amp = 0.3 + 0.9 * blow;
      a.breath.rate = 0.5;
    }
    // ---- the head: along the soldier's head turn (the road, a neighbour), Samuel in the silence, up while blowing
    const yaw = c.yaw + c.headYaw;
    a.headWorld(this.look);
    this.look.x += Math.sin(yaw) * 12;
    this.look.z += Math.cos(yaw) * 12;
    this.look.y += 0.2 + 3.5 * blow;
    if (shot === 'silence' && Math.abs(c.headYaw) > 0.05) this.look.lerp(samuelEyes, 0.8);
    mp.lookAt = this.look;
    a.lookRate = 4;
    // ---- the shout
    const r = a.human.rig;
    if (st === 'roar') {
      // shouts with breaths between them (each man his own rhythm), never one held open mouth
      const ph = Math.max(0, t - Math.max(0, c.roarT)) / (1.3 + 0.15 * (c.file % 3)) + 0.17 * c.rank + 0.11 * c.file;
      const f = ph - Math.floor(ph);
      const pulse = ss(0, 0.08, f) * (1 - ss(0.68, 0.8, f));
      r.jawOpen = 0.1 + 0.45 * pulse + 0.05 * Math.sin(t * 11 + c.file) * pulse;
      r.setExpressionWeight('anger', 0.35 + 0.25 * pulse);
      r.setExpressionWeight('effort', 0.25 + 0.2 * pulse);
      a.breath.amp = 0.5 + 0.6 * (1 - pulse);
    } else {
      r.jawOpen = st === 'freeze' ? 0.18 : 0.02;
      r.setExpressionWeight('anger', 0);
      r.setExpressionWeight('effort', 0.15 * blow);
      r.setExpressionWeight('determined', 0.3);
    }
    a.update(dt, camera, viewportH, wind);
    // ---- (wave 6) the feet planted while they bear weight (the capture's contacts; after the rig and the foot IK)
    if (dt > 0) {
      const b = a.human.bones as Record<string, THREE.Object3D>;
      const cc = mp.pose.contacts;
      for (let i = 0; i < 2; i++) {
        const sd = i === 0 ? 'L' : 'R';
        this.locks[i].apply(cc, b[`upperleg01.${sd}`], b[`lowerleg01.${sd}`], b[`foot.${sd}`], b[`toe3-1.${sd}`], dt);
      }
    }
    if (this.shieldObj) this.placeShield(c.yaw);
    void this.carrying;
  }
}

export class ArmyHeroes {
  readonly heroes: Hero[];
  private readonly samEyes = new THREE.Vector3();
  private constructor(heroes: Hero[]) {
    this.heroes = heroes;
  }

  get actors() {
    return this.heroes.map((h) => h.actor);
  }

  /** create the heroes (FilmActor soldiers): `horns` rams'-horn blowers + `near` spear-men */
  static async create(o: { tier: CrowdTier; ground: (x: number, z: number) => number; horns?: number; near?: number }): Promise<ArmyHeroes> {
    const [hn, nn] = HERO_COUNT[o.tier];
    const horns = o.horns ?? hn, near = o.near ?? nn;
    const { FilmActor } = await import('../cast/FilmActor');
    const q: Quality = HERO_Q[o.tier];
    const roles: HeroRole[] = [];
    for (let i = 0; i < horns; i++) roles.push({ kit: 'horn', seed: 31 + i * 7, index: i });
    for (let i = 0; i < near; i++) roles.push({ kit: 'spear', seed: 61 + i * 5, index: i });
    const heroes: Hero[] = [];
    for (const r of roles) {
      const a = await FilmActor.create({ role: 'soldier', quality: q, seed: r.seed, lod: 'near', kit: r.kit, ground: o.ground });
      // short soldier's hair: the exact groom, no strand simulation (the heroes' largest CPU cost)
      a.groom?.setSimulation(false);
      // (wave 6) the feet on the set's ground (with the foot lock on the capture's contacts in Hero.update)
      a.mocap.footIK = { enabled: true, ground: o.ground, maxAdjust: 0.2, align: 0.6 };
      heroes.push(new Hero(a, r));
    }
    return new ArmyHeroes(heroes);
  }

  /** the mocap clips the heroes may play (preload behind the loading screen) */
  static clips(walks: string[], idles: string[], cheers: string[]) {
    return [...new Set([...walks, ...idles, ...cheers, 'look_around_L', 'look_around_R', 'walk_b'])];
  }

  addTo(parent: THREE.Object3D) {
    for (const h of this.heroes) h.actor.addTo(parent);
  }

  /** per frame: the cues (GilgalArmy fills them), then the actors' clocks (action dt) */
  update(shot: GilgalShotName, t: number, dt: number, camera: THREE.Camera | undefined, viewportH: number | undefined, wind: THREE.Vector3, samuel: THREE.Vector3) {
    this.samEyes.copy(samuel);
    for (const h of this.heroes) h.update(shot, t, dt, camera, viewportH, wind, this.samEyes);
  }

  dispose() {
    for (const h of this.heroes) {
      h.horn?.removeFromParent();
      h.actor.dispose();
    }
  }
}
