/*
 * HostVanguard — host1 (wave 5, CUT v6 P6 'philistines'): the FRONT of the Philistine host as full actors.
 *
 * The user on P6 (4 Oct): "the animation here is most embarrassing and looks very bad — it must improve to a really,
 * really high level of animation and polish". The front ranks march up to a low lens and fill the picture for the whole
 * shot, and they were GPU-crowd figures (5 k triangles, painted faces, one rigid baked arm pose for the spear, the
 * shield glued to the swinging forearm). Now the men nearest the lens are FilmActors — the film's full humans (the
 * MakeHuman body with real faces and eyes, strand hair, the fitted costume of dressPhilistine: kilt with its tasselled
 * band, scale or ribbed corselet, bronze helmet / feather crown, greaves, sword, spear, shield) — each marching his
 * OWN motion capture:
 *   - his own march take (six captured walks / marches with their mirrors, no two neighbours alike), his own phase,
 *     pace and build; the take time-warped to his ground speed (MocapPlayer.matchSpeed: stride x cadence = speed, the
 *     feet planted, never sliding) and the feet on the plain by foot IK;
 *   - the spear carried upright in the right fist with the elbow bent, its shaft a damped pendulum on the grip: it lags
 *     the hand, nods forward on every heel strike and settles (never a fence of rigid parallel poles);
 *   - the round shield held by its central grip at the left side, the arm's swing damped by its weight, the shield
 *     itself swinging a little on the grip behind the hand;
 *   - the head alive: eyes and head on the road ahead with a glance now and then (a neighbour, the plain), each man on
 *     his own rhythm; visible breathing; a set, determined face; blinks (HumanRig);
 *   - the feather crowns' strips quiver and the kilts' tassels swing (dressPhilistine's crown flutter, the outfit's hem
 *     sway with the body's velocity and the coastal wind);
 *   - a puff of dust at every footfall (CrowdDust.emit at the foot that came down).
 * The crowd figure of each slot is hidden; the actor stands exactly where the host places that man (same path, same
 * weave, same pace), so the front and the column behind it are one formation. The actors are actors for the whole
 * shot: no LOD switch on screen.
 *
 * Accuracy (docs/visual-bible.md §3.9, Medinet Habu; 1 Sam 17:5-7, 13:19-21): clean-shaven, the elite of the front
 * ranks in bronze helmets, scale corselets and greaves, the ranks behind in the feathered crown; round shields with a
 * central grip, iron-headed spears, swords at the belt. No banners, no drums on screen, no horned helmets.
 *
 * Cost: per tier VANGUARD (count, actor LOD); the strand hair is not simulated (short hair under the headdress); one
 * mocap player and two-bone IK per man; built in yielding steps (core/slice) inside the coast set's background build.
 */
import * as THREE from 'three';
import type { FilmActor, Quality } from '../cast/FilmActor';
import type { CrowdTier } from './Crowd';
import type { CrowdDust } from './CrowdDust';
import { slice } from '../../core/slice';
import { PHILISTINE_CROWN_TIME } from '../../characters/wardrobe/film';

/**
 * actors per tier, their LOD ('near' = full costume; 'crowd' = base mesh, 1K skin, light groom) and content quality.
 * The men stand 6-25 m from P6's long lens (~250-400 px tall at 1280x720): the 'medium' body is ample there and is
 * ~half the 'high' one's 93 k triangles.
 */
export const VANGUARD: Record<CrowdTier, { n: number; lod: 'near' | 'crowd'; q: Quality; shadows: 'full' | 'lite' | 'none' }> = {
  'desktop-high': { n: 12, lod: 'near', q: 'medium', shadows: 'full' },
  'desktop-medium': { n: 8, lod: 'near', q: 'low', shadows: 'full' },
  'mobile-high': { n: 6, lod: 'crowd', q: 'low', shadows: 'lite' },
  'mobile-low': { n: 4, lod: 'crowd', q: 'low', shadows: 'none' },
};
/** phones ('lite'): only the large surfaces cast (the body, the kilt's skirt, the corselet, the shield) */
const LITE_SHADOW = /^body$|kiltSkirt|corselet|shield/i;
/**
 * no shadow from the small parts (each a draw call in the shadow pass): the face's inner meshes (teeth, brows, lashes,
 * eyes — ~25 k triangles a man), the hair, belts, sword, sandals, greaves, the spear's fittings, the tassels, the sleeves
 * and the kilt's linen under the corselet. The body, the kilt's skirt, the corselet and its scales, the helmet / crown,
 * the shield and the spear shaft keep theirs (the long morning shadows on the plain).
 */
const NO_SHADOW = /teeth|tongue|brow|lash|eye|caruncle|tear|strand|groom|hair|belt|sword|sheath|hilt|sandal|greave|bind|butt|socket|fringe|tassel|Sleeve|kiltUpper/i;

/**
 * the march takes of the vanguard: natural walks with natural speeds near the host's 1.2 m/s, so the time-warp keeps
 * each man's own cadence (walk_b 1.19, walk_n1 1.11, walk_cool 1.14, walk 1.32, walk_c 0.97 m/s). Measured on the bench (foot lift /
 * forward thigh swing at 1.2 m/s): these 0.18-0.25 m / ~41°; the captured 'march' 0.36 m / 62° and 'march_c' 0.88 m /
 * 77° are parade high-kicks (not an Iron Age levy on the road) and are not used
 */
export const VANGUARD_CLIPS = ['walk_b', 'walk_n1', 'walk_cool', 'walk', 'walk_c'];

/** one slot of the host taken by an actor (filled by PhilistineHost) */
export interface VanguardSlot {
  file: number;
  rank: number;
  elite: boolean;
  /** the man's pace (x the host's speed) */
  pace: number;
  seed: number;
}

/** what the host tells each actor every frame */
export interface VanguardCue {
  pos: THREE.Vector3;
  yaw: number;
  /** ground speed (m/s) */
  speed: number;
}

const hash = (a: number, b: number) => {
  const h = Math.sin(a * 12.9898 + b * 78.233 + 0.731) * 43758.5453;
  return h - Math.floor(h);
};

/**
 * the spear-carrying right arm (proxy Euler, DavidModel conventions: x < 0 swings forward): elbow bent, the fist out at
 * the right hip, so the upright shaft rises beside the shoulder and never across the face
 */
const SPEAR_ARM = { ua: [-0.08, -0.08, -0.24], fa: [-1.1, 0, 0], hd: [0.08, 0, 0.05] } as { ua: [number, number, number]; fa: [number, number, number]; hd: [number, number, number] };
/** the shield arm: the forearm forward and down, the fist at the hip, the shield at the left side, its face outward */
const SHIELD_ARM = { ua: [-0.06, 0.05, 0.13], fa: [-0.82, 0.12, 0], hd: [0, 0.3, 0.05] } as { ua: [number, number, number]; fa: [number, number, number]; hd: [number, number, number] };

const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _n = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _mi = new THREE.Matrix4();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();

/** a damped 2-D angular spring (forward, sideways) */
class Swing {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  constructor(public k: number, public c: number) {}
  step(dt: number, x0: number, y0: number, ax: number, ay: number) {
    // semi-implicit Euler in small substeps (stiff spring, frame dt up to 1/20)
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.vx += (-this.k * (this.x - x0) - this.c * this.vx + ax) * h;
      this.vy += (-this.k * (this.y - y0) - this.c * this.vy + ay) * h;
      this.x += this.vx * h;
      this.y += this.vy * h;
    }
  }
  reset(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = this.vy = 0;
  }
}

/**
 * FOOT LOCK — the capture's contact flags (heel / ball per foot, tools/mocap) pin the foot to the plain while it bears
 * weight: on heel strike the ankle's ground point is recorded and held (the leg solved back onto it by two-bone IK, the
 * knee in its own bend plane, the foot's orientation kept); when the heel lifts and the ball still bears, the ball is
 * held instead (the ankle rises and rolls over it); on lift-off the correction eases out in ~0.12 s. The in-place take
 * time-warped to the ground speed leaves ~10-20 cm/s of residual drift at the ankle (measured on the bench); this takes
 * it to the capture's own roll.
 */
class FootLock {
  private mode: 0 | 1 | 2 = 0; // free / heel / ball
  private readonly lock = new THREE.Vector3();
  /** the correction applied last frame (world), eased out after lift-off */
  private readonly off = new THREE.Vector3();
  constructor(private readonly heelBit: number, private readonly ballBit: number) {}
  reset() {
    this.mode = 0;
    this.off.set(0, 0, 0);
  }
  apply(contacts: number, thigh: THREE.Object3D, shin: THREE.Object3D, foot: THREE.Object3D, toe: THREE.Object3D | undefined, dt: number) {
    const heel = (contacts & this.heelBit) !== 0, ball = (contacts & this.ballBit) !== 0;
    foot.getWorldPosition(_fa);
    if (toe) toe.getWorldPosition(_ft);
    const want = heel ? 1 : ball && toe ? 2 : 0;
    if (want !== this.mode) {
      // a new phase: hold the point where it is NOW (with last frame's correction, so nothing jumps)
      if (want === 1) this.lock.copy(_fa).add(this.off);
      else if (want === 2) this.lock.copy(toe ? _ft : _fa).add(this.off);
      this.mode = want;
    }
    if (this.mode === 0) {
      this.off.multiplyScalar(Math.exp(-dt / 0.05));
    } else {
      // horizontal correction only (the height is the foot IK's); never more than 15 cm (a bad contact flag)
      _fd.copy(this.lock).sub(this.mode === 1 ? _fa : _ft).setY(0);
      if (_fd.lengthSq() > 0.15 * 0.15) {
        this.mode = 0;
        this.off.multiplyScalar(Math.exp(-dt / 0.05));
      } else this.off.copy(_fd);
    }
    if (this.off.lengthSq() < 1e-8) return;
    // two-bone IK: the ankle to (ankle + off), the knee in its current plane, the foot's world orientation kept
    foot.getWorldQuaternion(_fq);
    thigh.getWorldPosition(_fh);
    shin.getWorldPosition(_fk);
    _ftg.copy(_fa).add(this.off);
    const la = _fh.distanceTo(_fk), lb = _fk.distanceTo(_fa);
    _fd.copy(_ftg).sub(_fh);
    const d = THREE.MathUtils.clamp(_fd.length(), Math.abs(la - lb) + 1e-4, la + lb - 1e-4);
    _fd.normalize();
    // bend plane: the current knee's offset from the hip-ankle line
    _fp.copy(_fk).sub(_fh);
    _fp.addScaledVector(_fd, -_fp.dot(_fd));
    if (_fp.lengthSq() < 1e-8) return;
    _fp.normalize();
    const x = (la * la - lb * lb + d * d) / (2 * d);
    const y = Math.sqrt(Math.max(0, la * la - x * x));
    _fk2.copy(_fh).addScaledVector(_fd, x).addScaledVector(_fp, y);
    rotWorld(thigh, _fq2.setFromUnitVectors(_fv.copy(_fk).sub(_fh).normalize(), _fv2.copy(_fk2).sub(_fh).normalize()));
    shin.getWorldPosition(_fk);
    foot.getWorldPosition(_fa);
    rotWorld(shin, _fq2.setFromUnitVectors(_fv.copy(_fa).sub(_fk).normalize(), _fv2.copy(_ftg).sub(_fk).normalize()));
    setWorldQuat(foot, _fq);
  }
}

const _fa = new THREE.Vector3(), _ft = new THREE.Vector3(), _fd = new THREE.Vector3(), _fh = new THREE.Vector3(), _fk = new THREE.Vector3();
const _fk2 = new THREE.Vector3(), _ftg = new THREE.Vector3(), _fp = new THREE.Vector3(), _fv = new THREE.Vector3(), _fv2 = new THREE.Vector3();
const _fq = new THREE.Quaternion(), _fq2 = new THREE.Quaternion(), _rwP = new THREE.Quaternion(), _rwW = new THREE.Quaternion();
/** apply a world-space rotation to a bone (children follow) */
function rotWorld(bone: THREE.Object3D, dq: THREE.Quaternion) {
  bone.updateWorldMatrix(true, false);
  bone.getWorldQuaternion(_rwW);
  bone.parent!.getWorldQuaternion(_rwP);
  _rwW.premultiply(dq);
  bone.quaternion.copy(_rwP.invert().multiply(_rwW));
  bone.updateMatrixWorld(true);
}
function setWorldQuat(bone: THREE.Object3D, qw: THREE.Quaternion) {
  bone.parent!.updateWorldMatrix(true, false);
  bone.parent!.getWorldQuaternion(_rwP);
  bone.quaternion.copy(_rwP.invert().multiply(qw));
  bone.updateMatrixWorld(true);
}

class VanMan {
  readonly look = new THREE.Vector3();
  private readonly lookCur = new THREE.Vector3();
  /** the spear's tilt about the grip (rad: forward, to the man's right), its rest tilt */
  private readonly spear = new Swing(70, 4.2);
  private readonly spear0: [number, number];
  /** the shield's swing on its grip (rad: about the upright bar / its tilt forward) */
  private readonly shield = new Swing(55, 5.5);
  private shieldObj: THREE.Object3D | null = null;
  /** the shield's rest turn from the man's left toward his front (rad) */
  private readonly shieldTurn: number;
  private readonly gripPrev = new THREE.Vector3();
  private readonly gripVel = new THREE.Vector3();
  private hasGrip = false;
  private readonly clip: string;
  private readonly mirror: boolean;
  private readonly phase: number;
  /** the head's glances: next change (s), the current yaw / pitch offsets */
  private glanceAt = 0;
  private glanceYaw = 0;
  private glancePitch = 0;
  private clock = 0;
  private readonly h: (k: number) => number;
  steps = 0;
  /** the feather crown (rank men): its strips bend back against the head's acceleration (dressPhilistine flutter) */
  private readonly crown: { obj: THREE.Object3D; bend: THREE.Vector3 } | null = null;
  private readonly headPrev = new THREE.Vector3();
  private readonly headVel = new THREE.Vector3();
  private readonly bendW = new THREE.Vector3();
  private hasHead = false;
  private readonly locks = [new FootLock(1, 2), new FootLock(4, 8)];

  constructor(readonly actor: FilmActor, readonly slot: VanguardSlot, index: number, private readonly dust: CrowdDust | null) {
    const h = (k: number) => hash(slot.seed * 3.17 + k * 1.31, k * 0.77 + index);
    this.h = h;
    // the neighbours never share a take: step through the pool by file and rank, the mirror alternating
    this.clip = VANGUARD_CLIPS[(slot.file * 2 + slot.rank * 3 + index) % VANGUARD_CLIPS.length];
    this.mirror = (slot.file + slot.rank) % 2 === 1;
    this.phase = h(1) * 3;
    // each man's own carry: tipped forward 2-11°, out to his right 1-7° (clear of his face; never a fence of parallel
    // poles)
    this.spear0 = [0.04 + 0.15 * h(2), 0.02 + 0.1 * h(3)];
    const a = actor;
    a.mocap.rootMotion = 'inplace';
    a.cancelHeading = true;
    a.headingRate = 2.2;
    a.lookRate = 2.6 + 1.2 * h(4);
    a.lookLimits.yaw = 0.9;
    // (FilmActor applies the breath layer twice for a standing actor: these are half the visible amplitude)
    a.breath.amp = 0.2 + 0.12 * h(5);
    a.breath.rate = 0.3 + 0.08 * h(6);
    // the spear in the right fist, upright with the elbow bent (a little of the capture's own swing kept: 25 %)
    if (a.props.main) {
      a.holdProp('main', 'R');
      a.upright.R.prop = 'main';
      a.upright.R.weight = 1;
      a.armPose.R.pose = SPEAR_ARM;
      a.armPose.R.weight = 0.75;
    }
    // the shield by its central grip in the left fist: placed every frame in the man's own frame (its face out to his
    // left and a little forward, the bar upright through the fist) plus its swing on the grip — under the actor's root
    const sh = a.props.shield;
    if (sh) {
      a.root.add(sh);
      sh.matrixAutoUpdate = false;
      this.shieldObj = sh;
      a.human.rig.setFingers('L', 'grip');
      a.armPose.L.pose = SHIELD_ARM;
      a.armPose.L.weight = 0.6;
    }
    this.shieldTurn = 0.45 + 0.3 * h(9);
    // footfalls: a puff of dust where the foot came down
    a.mocap.onFootstep = (side) => this.footfall(side);
    a.groom?.setSimulation(false);
    // under the bronze helmet the hair is cropped and hidden (the short groom stuck out below the rim as a ragged mane)
    if (slot.elite) a.groom?.setVisible(false);
    // never seen from P6's lens (each a draw call): the teeth (the mouths stay closed on the march), the lashes and the
    // eyes' tear lines (under a pixel at 6-25 m), and under the elite's scale corselet the kilt's linen body (its sleeves
    // and skirt stay)
    a.root.traverse((m) => {
      if (!(m as THREE.Mesh).isMesh) return;
      if (/teeth|tongue|lash|tearLine/i.test(m.name) || (slot.elite && /kiltUpper/.test(m.name))) m.visible = false;
    });
    let crown: THREE.Object3D | null = null;
    a.root.traverse((o) => {
      if (!crown && o.name === 'featherCrown' && o.userData.flutter) crown = o;
    });
    if (crown) this.crown = { obj: crown, bend: ((crown as THREE.Object3D).userData.flutter as { bend: THREE.Vector3 }).bend };
    const r = a.human.rig;
    r.setExpressionWeight('determined', 0.25 + 0.25 * h(7));
  }

  enter() {
    const a = this.actor;
    a.mocap.play(this.clip, { fade: 0, time: this.phase, mirror: this.mirror });
    a.headingSnap = true;
    this.spear.reset(this.spear0[0], this.spear0[1]);
    this.shield.reset(0, 0);
    this.hasGrip = false;
    this.glanceAt = 0.4 + 2.5 * this.h(8);
    this.glanceYaw = this.glancePitch = 0;
    this.clock = 0;
    this.lookCur.set(0, 0, 0);
    this.hasHead = false;
    this.bendW.set(0, 0, 0);
    for (const l of this.locks) l.reset();
  }

  /** the shield on the left fist: face out to the man's left, turned toward his front, swinging on the grip */
  private placeShield(yaw: number) {
    const a = this.actor, sh = this.shieldObj!;
    const turn = this.shieldTurn + THREE.MathUtils.clamp(this.shield.y, -0.35, 0.35);
    const tilt = THREE.MathUtils.clamp(this.shield.x, -0.3, 0.3) * 0.6 + 0.06;
    _f.set(Math.sin(yaw), 0, Math.cos(yaw));
    _r.set(-_f.z, 0, _f.x);
    // normal (+Z of the shield): the man's left (-right) turned `turn` toward the front, tipped `tilt` (top forward)
    _n.copy(_r).multiplyScalar(-Math.cos(turn)).addScaledVector(_f, Math.sin(turn)).normalize();
    _y.set(0, 1, 0).addScaledVector(_n, -Math.sin(tilt)).normalize();
    _x.crossVectors(_y, _n).normalize();
    _y.crossVectors(_n, _x);
    _m.makeBasis(_x, _y, _n);
    a.human.sockets.handGripL.getWorldPosition(_p);
    // the bar (0.03 behind the disc) in the fist
    _p.addScaledVector(_n, 0.03);
    _m.setPosition(_p);
    a.root.updateWorldMatrix(true, false);
    _mi.copy(a.root.matrixWorld).invert();
    sh.matrix.multiplyMatrices(_mi, _m);
    sh.matrixWorldNeedsUpdate = true;
  }

  private footfall(side: 'L' | 'R') {
    this.steps++;
    // the heel strike jolts the shaft forward (the hand stops with the body, the tip goes on)
    this.spear.vx += 0.32 + 0.12 * this.h(20 + (this.steps % 5));
    this.shield.vy += (side === 'L' ? 1 : -1) * 0.25;
    if (!this.dust || !this.actor.root.visible) return;
    const foot = (this.actor.human.bones as Record<string, THREE.Object3D>)[`foot.${side}`];
    if (!foot) return;
    foot.getWorldPosition(_p);
    const y = this.actor.root.position.y;
    this.dust.emit(_p.x, y, _p.z, Math.sin(this.actor.yaw), Math.cos(this.actor.yaw), 0.75);
  }

  update(cue: VanguardCue, dt: number, camera: THREE.Camera | undefined, viewportH: number | undefined, wind: THREE.Vector3) {
    const a = this.actor;
    this.clock += dt;
    a.place(cue.pos, cue.yaw);
    a.mocap.matchSpeed(this.clip, Math.max(0.2, cue.speed));
    // ---- the head: down the road, a glance now and then
    if (this.clock >= this.glanceAt) {
      const k = this.h(30 + Math.floor(this.clock * 3.7));
      const k2 = this.h(40 + Math.floor(this.clock * 5.3));
      // 60 % straight ahead (small drift), 25 % a neighbour / across the column, 15 % out over the plain to the left —
      // the lens stands off their right front: a glance that way stays short of it (no man looks into the camera)
      this.glanceYaw = k < 0.6 ? (k2 - 0.5) * 0.25 : k < 0.85 ? (k2 < 0.5 ? -0.26 : 0.35 + 0.3 * k2) : 0.55 + 0.35 * k2;
      this.glancePitch = -0.05 + 0.12 * (k2 - 0.5);
      this.glanceAt = this.clock + (k < 0.6 ? 1.6 + 2.2 * k2 : 0.7 + 0.9 * k2);
    }
    const yaw = cue.yaw + this.glanceYaw;
    a.headWorld(_p);
    this.look.set(_p.x + Math.sin(yaw) * 15, _p.y + Math.tan(this.glancePitch) * 15, _p.z + Math.cos(yaw) * 15);
    a.mocap.lookAt = this.look;
    a.mocap.lookWeight = 1;
    // ---- the spear: a damped pendulum on the grip, driven by the fist's acceleration (it lags the hand)
    const grip = a.human.sockets.handGripR;
    grip.getWorldPosition(_p);
    _f.set(Math.sin(cue.yaw), 0, Math.cos(cue.yaw));
    _r.set(-_f.z, 0, _f.x);
    let af = 0, ar = 0;
    if (this.hasGrip && dt > 1e-4) {
      _v.copy(_p).sub(this.gripPrev).divideScalar(dt);
      _a.copy(_v).sub(this.gripVel).divideScalar(dt);
      this.gripVel.copy(_v);
      // the body's own march speed is constant: what is left is the arm's swing and the hips' sway
      af = THREE.MathUtils.clamp(_a.dot(_f), -6, 6);
      ar = THREE.MathUtils.clamp(_a.dot(_r), -6, 6);
    } else if (!this.hasGrip) {
      this.gripVel.set(_f.x * cue.speed, 0, _f.z * cue.speed);
    }
    this.gripPrev.copy(_p);
    this.hasGrip = true;
    if (dt > 0) {
      // ~1.4 m of shaft above the fist: a hand accelerating forward tips the shaft back
      this.spear.step(dt, this.spear0[0], this.spear0[1], -af * 0.7, -ar * 0.7);
      this.shield.step(dt, 0, 0, -af * 0.5, -ar * 0.9);
    }
    const sx = THREE.MathUtils.clamp(this.spear.x, -0.2, 0.45), sy = THREE.MathUtils.clamp(this.spear.y, -0.25, 0.25);
    a.upright.R.axis.set(0, Math.cos(sx) * Math.cos(sy), 0).addScaledVector(_f, Math.sin(sx)).addScaledVector(_r, Math.sin(sy)).normalize();
    a.update(dt, camera, viewportH, wind);
    // ---- the feet planted while they bear weight (after the rig, the body layer and the foot IK)
    if (dt > 0) {
      const b = a.human.bones as Record<string, THREE.Object3D>;
      const c = a.mocap.pose.contacts;
      for (let i = 0; i < 2; i++) {
        const s = i === 0 ? 'L' : 'R';
        this.locks[i].apply(c, b[`upperleg01.${s}`], b[`lowerleg01.${s}`], b[`foot.${s}`], b[`toe3-1.${s}`] ?? b[`toes.${s}`], dt);
      }
    }
    if (this.shieldObj) this.placeShield(cue.yaw);
    // ---- the crown's strips: bent back by the head's acceleration (the bob of every step) and leaning in the breeze
    if (this.crown && dt > 1e-4) {
      a.human.bones.head.getWorldPosition(_p);
      if (this.hasHead) {
        _v.copy(_p).sub(this.headPrev).divideScalar(dt);
        _a.copy(_v).sub(this.headVel).divideScalar(dt).clampLength(0, 8);
        this.headVel.copy(_v);
        // target bend (world): against the acceleration, 2.5 mm per m/s², plus the wind; eased (the strips' own lag)
        _v.copy(_a).multiplyScalar(-0.0025).addScaledVector(wind, 0.004);
        this.bendW.lerp(_v, 1 - Math.exp(-14 * dt));
      } else {
        this.headVel.set(Math.sin(cue.yaw) * cue.speed, 0, Math.cos(cue.yaw) * cue.speed);
      }
      this.headPrev.copy(_p);
      this.hasHead = true;
      this.crown.obj.getWorldQuaternion(_q).invert();
      this.crown.bend.copy(this.bendW).applyQuaternion(_q).clampLength(0, 0.025);
    }
  }
}

export class HostVanguard {
  /** build ms of each actor (FilmActor.create, wall clock incl. its slice pauses) and of the whole vanguard */
  readonly buildMs: number[] = [];
  totalMs = 0;
  private constructor(readonly men: VanMan[]) {}

  get actors() {
    return this.men.map((m) => m.actor);
  }

  /** the mocap clips the vanguard plays */
  static clips() {
    return [...VANGUARD_CLIPS];
  }

  static async create(o: { tier: CrowdTier; slots: VanguardSlot[]; ground: (x: number, z: number) => number; dust: CrowdDust | null; parent: THREE.Object3D }): Promise<HostVanguard> {
    const t0 = performance.now();
    const { FilmActor } = await import('../cast/FilmActor');
    await FilmActor.preloadClips(VANGUARD_CLIPS);
    const ms: number[] = [];
    const q: Quality = VANGUARD[o.tier].q;
    const lod = VANGUARD[o.tier].lod;
    const men: VanMan[] = [];
    for (let i = 0; i < o.slots.length; i++) {
      const s = o.slots[i];
      if (slice.due()) await slice.pause();
      const ta = performance.now();
      const a = await FilmActor.create({ role: 'philistine', quality: q, seed: s.seed, lod, rank: s.elite ? 'elite' : 'rank', ground: o.ground });
      ms.push(Math.round(performance.now() - ta));
      a.addTo(o.parent);
      const sh = VANGUARD[o.tier].shadows;
      a.root.traverse((m) => {
        if (!(m as THREE.Mesh).isMesh) return;
        const n = m.name, pn = m.parent?.name ?? '';
        if (sh === 'none' || NO_SHADOW.test(n) || NO_SHADOW.test(pn) || (sh === 'lite' && !LITE_SHADOW.test(n) && !LITE_SHADOW.test(pn))) m.castShadow = false;
        // mobile-low: the brows too (a draw call; a pixel at the phone's size)
        if (o.tier === 'mobile-low' && /brow/i.test(n)) m.visible = false;
      });
      men.push(new VanMan(a, s, i, o.dust));
    }
    const v = new HostVanguard(men);
    v.buildMs.push(...ms);
    v.totalMs = Math.round(performance.now() - t0);
    v.enter();
    return v;
  }

  /** the cut into the shot: every man back on his take's phase, the springs at rest */
  enter() {
    for (const m of this.men) m.enter();
  }

  update(cues: VanguardCue[], dt: number, camera: THREE.Camera | undefined, viewportH: number | undefined, wind: THREE.Vector3) {
    PHILISTINE_CROWN_TIME.value += dt;
    for (let i = 0; i < this.men.length; i++) this.men[i].update(cues[i], dt, camera, viewportH, wind);
  }

  dispose() {
    for (const m of this.men) m.actor.dispose();
  }
}
