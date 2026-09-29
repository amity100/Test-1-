import * as THREE from 'three';
import { HumanModel } from '../../characters/human/HumanModel';
import type { Expression, FingerPose } from '../../characters/human/HumanRig';
import { createGroom, type Groom, type GroomStyleSpec, type Headband } from '../../characters/hair';
import { attachProp, dressMan, dressSaul, type Outfit, type Prop } from '../../characters/wardrobe';
import { PoseMixer, type Pose } from '../../characters/Rig';
import { CAST_POSES, walkPose, type CastPoseName } from './castPoses';

/*
 * CastActor — one member of Saul's court: a HumanModel + strand groom + wardrobe outfit + hand props, driven by a
 * base pose plus procedural "idle life" (breathing, slow weight shifts, head turns toward a look target with
 * occasional glances, eye saccades and blinks, micro head motion), and a grip solver that keeps a held spear
 * upright with its butt planted on the ground (1 Sam 26:7) whatever the arm pose.
 *
 * Frame order per update: mixer (pose + idle) -> hand correction -> human.update -> spear placement ->
 * groom.update -> outfit.update. No per-frame allocations.
 */

export type CastRole = 'saul' | 'abner' | 'guard' | 'runner' | 'servant' | 'bearer' | 'archer' | 'slinger';
export type Tier = 'low' | 'medium' | 'high';

export interface ActorSpec {
  name: string;
  role: CastRole;
  /** 'man' preset seed (build, face, skin) and outfit seed */
  seed: number;
  beard?: 'none' | 'short' | 'full';
  /** body mesh level override (background figures: 'base') */
  geometry?: 'base' | 'sub1';
  hairQuality?: Tier;
  hairDensity?: number;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _qc = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export class CastActor {
  /** placement group (world position + yaw, in the palace scene); `human.root` is its child */
  readonly root = new THREE.Group();
  readonly name: string;
  readonly role: CastRole;
  readonly human: HumanModel;
  readonly outfit: Outfit;
  readonly groom: Groom | null;
  readonly mixer: PoseMixer;
  /** the spear this actor carries (wardrobe prop), if any */
  readonly spear: Prop | null;
  /** extra props parented to sockets (jug, bowl, bow, quiver, sling, shield, robe corner) */
  readonly props: Record<string, THREE.Object3D> = {};
  /** current base pose */
  pose: Pose;
  poseName: CastPoseName = 'guardAtEase';
  /** where the head (and eyes) look; null = straight ahead */
  lookTarget: THREE.Vector3 | null = null;
  /** secondary points for occasional glances */
  readonly glances: THREE.Vector3[] = [];
  /** 0..1 how much the head turns toward the target (eyes always follow) */
  headFollow = 0.75;
  /** idle motion amplitude (0 = still as a statue) */
  idle = 1;
  /** world wind (m/s) for hair / cloth */
  readonly wind = new THREE.Vector3(1.1, 0, 0.5);
  /** planted spear butt (world) — while set and spearMode === 'hand', the grip solver keeps the spear on it */
  readonly plant = new THREE.Vector3();
  spearMode: 'hand' | 'hidden' = 'hand';
  /** when set, the left hand is re-aimed so its grip axis (socket +Y) points along this world direction (bows) */
  leftAim: THREE.Vector3 | null = null;
  private readonly handCorrL = new THREE.Quaternion();
  /** seated: pelvis height offset applied through hipsY (see sitOn) */
  seatedHipsY: number | null = null;
  /** extra additive pose layer (performances), in proxy Euler radians */
  readonly offsets: Record<string, [number, number, number]> = {};
  hipsYOffset = 0;
  visible = true;
  /** time (s) */
  time = 0;
  /** walk: when > 0 the base pose is replaced by the walk cycle (phase advanced by speed) */
  walkSpeed = 0;
  private walkPhase = 0;
  private readonly walkBuf: Pose = { r: {}, hipsY: 0, hipsZ: 0 };
  private readonly phase: number;
  private glanceT = 3;
  private glanceIdx = -1;
  private glanceHold = 0;
  private readonly headAim = new THREE.Vector2();
  private readonly handCorr = new THREE.Quaternion();
  private readonly velocity = new THREE.Vector3();
  private readonly lookW = new THREE.Vector3();
  private readonly lookSmooth = new THREE.Vector3();
  private lookInit = false;
  expressionName: Expression = 'neutral';

  private constructor(spec: ActorSpec, human: HumanModel, outfit: Outfit, groom: Groom | null) {
    this.name = spec.name;
    this.role = spec.role;
    this.human = human;
    this.outfit = outfit;
    this.groom = groom;
    this.root.name = `cast:${spec.name}`;
    this.root.add(human.root);
    human.root.position.y = outfit.groundOffset;
    this.mixer = new PoseMixer(human.joints);
    this.pose = CAST_POSES.guardAtEase;
    this.phase = hash(spec.seed + spec.name.length * 7.3) * 100;
    this.glanceT = 2 + hash(this.phase) * 5;
    human.rig.blinkEnabled = true;
    human.setPupil(0.25);
    this.spear = outfit.props.spear ?? null;
    if (this.spear) {
      attachProp(this.spear, human.sockets.handGripR);
      human.setGripRadius(this.spear.object.userData.radiusAtGrip ?? 0.0158);
      human.rig.setFingers('R', 'grip');
    }
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.receiveShadow = true;
    });
    this.collectDetail();
  }

  /** meshes that cast shadows (restored by setDetail) and face parts that vanish at a distance */
  readonly shadowMeshes: THREE.Object3D[] = [];
  private readonly faceParts: THREE.Object3D[] = [];
  private detail = 2;
  get detailLevel() {
    return this.detail;
  }

  private collectDetail() {
    this.shadowMeshes.length = 0;
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.castShadow) this.shadowMeshes.push(o);
    });
    const h = this.human;
    for (const o of [h.eyes.L.cornea, h.eyes.R.cornea, h.lashes, h.tearLines, h.teeth]) if (o) this.faceParts.push(o);
  }

  /**
   * Distance LOD: 2 = full, 1 = far (> ~28 m: no face details, no shadow casting), 0 = very far (> ~70 m: no strand
   * hair either). Only toggles visibility / castShadow (no recompiles).
   */
  setDetail(level: number) {
    if (level === this.detail) return;
    this.detail = level;
    for (const o of this.faceParts) o.visible = level >= 2;
    for (const o of this.shadowMeshes) o.castShadow = level >= 2;
    this.groom?.setVisible(level >= 1);
  }

  /** Load, dress and groom one actor (the heavy part: ~0.3-3 s each). */
  static async create(spec: ActorSpec, tier: Tier, msaa: number): Promise<CastActor> {
    const preset = spec.role === 'saul' ? 'saul' : 'man';
    const human = await HumanModel.load({ preset, quality: tier, seed: preset === 'man' ? spec.seed : undefined, geometry: spec.geometry });
    let outfit: Outfit;
    if (spec.role === 'saul') outfit = await dressSaul(human, { quality: tier });
    else {
      const role = spec.role === 'abner' ? 'abner' : spec.role === 'servant' ? 'servant' : spec.role === 'runner' || spec.role === 'slinger' || spec.role === 'archer' || spec.role === 'bearer' ? 'runner' : 'guard';
      outfit = await dressMan(human, { quality: tier, role, seed: spec.seed });
    }
    // hair pressed under whatever the outfit put on the head (diadem, headband, headcloth)
    const [rx, rz] = human.metrics.crownRadius;
    let headband: Headband | undefined;
    const ring = human.sockets.crownAnchor.children.find((c) => c.name === 'headRing');
    if (spec.role === 'saul') headband = { height: 0, radius: [rx + 0.0078, rz + 0.0078], width: 0.017, tilt: 0.008 };
    else if (ring && spec.role !== 'servant') headband = { height: 0, radius: [rx + 0.007, rz + 0.007], width: spec.role === 'abner' ? 0.022 : 0.02 };
    const style: GroomStyleSpec = spec.role === 'saul' ? 'saul' : { kind: 'man', seed: spec.seed, beard: spec.beard, headband: !!headband && spec.role !== 'servant' };
    let groom: Groom | null = null;
    try {
      groom = await createGroom(human, style, { quality: spec.hairQuality ?? tier, msaa, headband, density: spec.hairDensity ?? 1 });
    } catch (e) {
      console.warn('[cast] groom failed for', spec.name, e);
    }
    return new CastActor(spec, human, outfit, groom);
  }

  /** Place the actor standing at `pos` (feet) facing `yaw` (forward = (sin yaw, 0, cos yaw)). */
  stand(pos: THREE.Vector3, yaw: number) {
    this.root.position.copy(pos);
    this.root.rotation.set(0, yaw, 0);
    this.seatedHipsY = null;
    this.human.root.position.set(0, this.outfit.groundOffset, 0);
  }

  /**
   * Seat the actor: `seatTop` = the seat surface under the pelvis, `groundY` = where the feet rest, `yaw` = facing.
   * The pelvis (hip joints) rests ~0.1 m above the seat surface, 4 cm forward of the seat centre.
   */
  sitOn(seatTop: THREE.Vector3, groundY: number, yaw: number) {
    const fwd = _v.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.root.position.set(seatTop.x, groundY, seatTop.z).addScaledVector(fwd, -0.02);
    this.root.rotation.set(0, yaw, 0);
    const rig = this.human.rig;
    // hip joint centre above the seat (ischium + compressed soft tissue ~ 0.1 m for a big man)
    this.seatedHipsY = seatTop.y + 0.105 - groundY - this.outfit.groundOffset - rig.hipHeight;
    this.human.root.position.set(0, this.outfit.groundOffset, 0);
  }

  setPose(name: CastPoseName) {
    this.poseName = name;
    this.pose = CAST_POSES[name];
  }

  setExpression(e: Expression, w = 1) {
    this.expressionName = e;
    this.human.rig.setExpression(e, w);
  }

  setFingers(side: 'L' | 'R' | 'both', p: FingerPose) {
    this.human.rig.setFingers(side, p);
  }

  /** Plant the held spear's butt at a world point (the grip solver aims the hand / shaft at it). */
  plantSpear(p: THREE.Vector3) {
    this.plant.copy(p);
    this.spearMode = 'hand';
    if (this.spear) this.spear.object.visible = true;
  }

  hideSpear() {
    this.spearMode = 'hidden';
    if (this.spear) this.spear.object.visible = false;
  }

  setVisible(v: boolean) {
    this.visible = v;
    this.root.visible = v;
  }

  /** Snap cloth / hair dynamics and the solvers after a cut or a teleport. */
  settle(frames = 24, camera?: THREE.Camera, vh?: number) {
    this.outfit.resetDynamics();
    this.lookInit = false;
    for (let i = 0; i < frames; i++) this.update(1 / 30, camera, vh, true);
  }

  headWorld(out: THREE.Vector3) {
    return this.human.bones.head.getWorldPosition(out);
  }

  eyesWorld(out: THREE.Vector3) {
    const a = this.human.sockets.eyeL.getWorldPosition(out);
    const b = this.human.sockets.eyeR.getWorldPosition(_v2);
    return a.add(b).multiplyScalar(0.5);
  }

  update(dt: number, camera?: THREE.Camera, vh?: number, settling = false) {
    if (!this.visible) return;
    this.time += dt;
    const t = this.time + this.phase;
    const I = this.idle;
    const human = this.human;
    const mixer = this.mixer;
    mixer.reset();
    if (this.walkSpeed > 0) {
      this.walkPhase += dt * this.walkSpeed * 5.2;
      mixer.layer(walkPose(this.walkPhase, this.walkBuf), 1);
    } else mixer.layer(this.pose, 1);
    // ---- idle life: slow weight shift, breathing sway, micro head motion
    const ws = Math.sin(t * 0.21) * 0.6 + Math.sin(t * 0.13 + 1.7) * 0.4;
    const seated = this.seatedHipsY !== null;
    if (!seated && this.walkSpeed <= 0) {
      mixer.add('hips', 0, ws * 0.025 * I, ws * 0.018 * I);
      mixer.add('chest', 0, -ws * 0.02 * I, -ws * 0.012 * I);
      mixer.add('thL', 0, 0, -ws * 0.012 * I);
      mixer.add('thR', 0, 0, -ws * 0.012 * I);
    } else if (seated) {
      mixer.add('spine', Math.sin(t * 0.17) * 0.008 * I, 0, 0);
    }
    mixer.add('head', (Math.sin(t * 0.53) * 0.006 + Math.sin(t * 1.31) * 0.003) * I, (Math.sin(t * 0.37 + 2) * 0.01) * I, Math.sin(t * 0.29) * 0.006 * I);
    // ---- head aim toward the look target (or a glance)
    this.glanceT -= dt;
    if (this.glanceT <= 0) {
      if (this.glanceIdx >= 0 || !this.glances.length) {
        this.glanceIdx = -1;
        this.glanceT = 3.5 + hash(t) * 5;
      } else {
        this.glanceIdx = Math.floor(hash(t * 1.7) * this.glances.length);
        this.glanceT = 0.9 + hash(t * 2.3) * 1.4;
      }
    }
    const target = this.glanceIdx >= 0 ? this.glances[this.glanceIdx] : this.lookTarget;
    let yawT = 0, pitchT = 0;
    if (target) {
      if (!this.lookInit) {
        this.lookSmooth.copy(target);
        this.lookInit = true;
      }
      const k = settling ? 1 : 1 - Math.exp(-dt * 3.5);
      this.lookSmooth.lerp(target, k);
      // direction in the actor's frame from the (last) head position
      human.bones.head.getWorldPosition(_v);
      _v2.copy(this.lookSmooth).sub(_v);
      this.root.getWorldQuaternion(_q).invert();
      _v2.applyQuaternion(_q);
      yawT = THREE.MathUtils.clamp(Math.atan2(_v2.x, _v2.z), -0.9, 0.9) * this.headFollow;
      pitchT = THREE.MathUtils.clamp(-Math.atan2(_v2.y, Math.hypot(_v2.x, _v2.z)), -0.35, 0.45) * this.headFollow;
      human.rig.lookTarget = this.lookW.copy(this.lookSmooth);
    } else human.rig.lookTarget = null;
    const ka = settling ? 1 : 1 - Math.exp(-dt * 2.6);
    this.headAim.x += (yawT - this.headAim.x) * ka;
    this.headAim.y += (pitchT - this.headAim.y) * ka;
    // head carries 60 %, neck 40 % (pitch relative to the pose's own head tilt is only partly applied)
    mixer.add('neck', this.headAim.y * 0.25, this.headAim.x * 0.4, 0);
    mixer.add('head', this.headAim.y * 0.35, this.headAim.x * 0.6, 0);
    for (const k in this.offsets) {
      const o = this.offsets[k];
      mixer.add(k, o[0], o[1], o[2]);
    }
    mixer.apply();
    const j = human.joints;
    j.hips.position.y = human.rig.hipHeight + (mixer.cur.hipsY ?? 0) + (this.seatedHipsY ?? 0) + this.hipsYOffset;
    j.hips.position.z = human.rig.pelvis.z + (mixer.cur.hipsZ ?? 0);
    // ---- spear grip: re-aim the right hand (correction from the previous frame)
    const spear = this.spear;
    const solve = spear && this.spearMode === 'hand';
    if (solve) j.hdR.quaternion.premultiply(this.handCorr);
    if (this.leftAim) j.hdL.quaternion.premultiply(this.handCorrL);
    human.update(dt, camera, vh);
    if (this.leftAim) {
      human.sockets.handGripL.getWorldQuaternion(_q);
      const cur = _v.copy(UP).applyQuaternion(_q);
      _qc.setFromUnitVectors(cur, _v2.copy(this.leftAim).normalize());
      const pq = j.hdL.parent!.getWorldQuaternion(_q2);
      _q.copy(pq).invert().multiply(_qc).multiply(pq);
      this.handCorrL.premultiply(_q).normalize();
    }
    if (solve) {
      const sock = human.sockets.handGripR;
      sock.getWorldPosition(_v);
      const D = _v.distanceTo(this.plant);
      const want = _v2.copy(_v).sub(this.plant).normalize();
      sock.getWorldQuaternion(_q);
      const cur = _v.copy(UP).applyQuaternion(_q);
      _qc.setFromUnitVectors(cur, want);
      const pq = j.hdR.parent!.getWorldQuaternion(_q2);
      // corr = pq^-1 * qc * pq * corr
      _q.copy(pq).invert().multiply(_qc).multiply(pq);
      this.handCorr.premultiply(_q).normalize();
      // slide the shaft through the fist so the butt lands on the plant point
      const buttY = spear!.butt.position.y;
      // (attachProp put the grip frame on the socket: the shaft runs along the socket's +Y, butt below the fist)
      spear!.object.position.y = -D - buttY;
      spear!.object.updateMatrixWorld(true);
    }
    this.groom?.update(dt, this.wind);
    this.velocity.set(0, 0, 0);
    if (this.walkSpeed > 0) this.velocity.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y)).multiplyScalar(this.walkSpeed);
    this.outfit.update(dt, { velocity: this.velocity, wind: this.wind });
    void _m;
  }

  /** triangles of the body + outfit + full groom (upper bound; hair LOD draws fewer at distance) */
  stats() {
    return {
      name: this.name,
      bodyTris: this.human.metrics.triangles,
      outfitTris: this.outfit.stats.triangles,
      outfitCalls: this.outfit.stats.drawCalls,
      hairTris: this.groom?.stats.trianglesFull ?? 0,
      hairStrands: this.groom?.stats.strands ?? 0,
    };
  }

  dispose() {
    this.groom?.dispose();
    this.outfit.dispose();
    for (const k in this.props) {
      this.props[k].traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      this.props[k].removeFromParent();
    }
    this.human.dispose();
    this.root.removeFromParent();
  }
}
