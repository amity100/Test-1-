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
import type { CrowdTier } from './Crowd';

export interface HeroRole {
  kit: 'horn' | 'spear';
  seed: number;
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
}

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** heroes per tier: [horn blowers, near soldiers] */
export const HERO_COUNT: Record<CrowdTier, [number, number]> = {
  'desktop-high': [3, 2],
  'desktop-medium': [3, 1],
  'mobile-high': [2, 0],
  'mobile-low': [2, 0],
};

const CARRY = { ua: [-0.12, -0.1, -0.16], fa: [-1.2, 0, 0], hd: [0.1, 0, 0.05] } as { ua: [number, number, number]; fa: [number, number, number]; hd: [number, number, number] };

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
  constructor(readonly actor: FilmActor, readonly role: HeroRole) {
    const a = actor;
    a.mocap.rootMotion = 'inplace';
    a.cancelHeading = true;
    if (role.kit === 'spear' && a.props.main) {
      a.holdProp('main', 'R');
      a.upright.R.prop = 'main';
      a.upright.R.weight = 1;
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
    const sh = a.props.shield;
    if (sh && role.kit === 'spear') a.human.sockets.handGripL.add(sh);
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
      mp.matchSpeed(c.walk, MARCH_SPEED * c.pace);
    } else if (st === 'roar') {
      if (changed) this.play(c.cheer, { fade: 0.16, time: 0.1, mirror: c.mirror && this.role.kit !== 'spear' });
    } else if (st === 'freeze') {
      if (changed && !this.roaring) this.play(c.cheer, { fade: 0, time: 1.2, mirror: c.mirror && this.role.kit !== 'spear' });
      mp.setSpeed(this.clip, 0.05);
    } else if (st === 'look') {
      if (changed) this.play(Math.sin(c.yaw * 7 + c.file) > 0 ? 'look_around_R' : 'look_around_L', { fade: 0.7, time: 0.35 });
    } else if (st === 'step') {
      if (changed) this.play('walk_b', { fade: 0.25, time: c.phase });
      mp.matchSpeed('walk_b', Math.max(0.3, Math.hypot(a.velocity.x, a.velocity.z)));
    } else if (changed || this.clip === '') this.play(c.idle, { fade: st === 'lower' ? 1.1 : 0.4, time: c.phase * 1.7 });
    this.roaring = st === 'roar' || (st === 'freeze' && this.roaring);
    // ---- the spear carried (upright, the arm bent) except in the roar
    if (this.role.kit === 'spear') {
      const carry = st === 'march' || st === 'halt' || st === 'idle' || st === 'lower' || st === 'step';
      a.armPose.R.pose = carry ? CARRY : null;
      a.armPose.R.weight = carry ? 0.8 : 0;
      a.upright.R.weight = carry ? 1 : 0.4;
    }
    // ---- the rams' horns (G1): lifted to the lips at the beat and blown
    let blow = 0;
    if (this.role.kit === 'horn') {
      if (shot === 'dustWall') {
        const h = BEATS.dustWall.horns;
        blow = ss(h - 0.1, h + 0.35, t) * (1 - ss(2.7, 3.2, t));
      } else if (st === 'roar' || st === 'freeze') blow = 0;
      this.blow = blow;
      this.placeHorn(blow);
      a.reach.R.target = this.hornTarget;
      a.reach.R.weight = blow;
      a.reach.L.target = this.hornL;
      a.reach.L.weight = blow * 0.9;
      a.human.rig.setFingers('L', blow > 0.3 ? 'grip' : 'relaxed');
      a.human.rig.faceUnits.CheeksPump = 0.75 * ss(0.4, 0.9, blow);
      a.body.lean = -0.07 * blow;
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
      r.jawOpen = 0.5 + 0.08 * Math.sin(t * 11 + c.file);
      r.setExpressionWeight('anger', 0.55);
      r.setExpressionWeight('effort', 0.4);
    } else {
      r.jawOpen = st === 'freeze' ? 0.18 : 0.02;
      r.setExpressionWeight('anger', 0);
      r.setExpressionWeight('effort', 0.15 * blow);
      r.setExpressionWeight('determined', 0.3);
    }
    a.update(dt, camera, viewportH, wind);
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
    const q: Quality = o.tier === 'desktop-high' ? 'high' : o.tier === 'desktop-medium' ? 'medium' : 'low';
    const roles: HeroRole[] = [];
    for (let i = 0; i < horns; i++) roles.push({ kit: 'horn', seed: 31 + i * 7 });
    for (let i = 0; i < near; i++) roles.push({ kit: 'spear', seed: 61 + i * 5 });
    const heroes: Hero[] = [];
    for (const r of roles) {
      const a = await FilmActor.create({ role: 'soldier', quality: q, seed: r.seed, lod: 'near', kit: r.kit, ground: o.ground });
      // short soldier's hair: the exact groom, no strand simulation (the heroes' largest CPU cost)
      a.groom?.setSimulation(false);
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
