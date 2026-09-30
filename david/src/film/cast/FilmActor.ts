import * as THREE from 'three';
import { HumanModel } from '../../characters/human/HumanModel';
import { createGroom, type Groom, type GroomStyleSpec } from '../../characters/hair';
import { MocapLibrary, MocapPlayer, MOCAP_BONES } from '../../characters/mocap';
import {
  attachProp, dressArmourBearer, dressElder, dressPhilistine, dressSamuel, dressSaulGilgal, dressSoldier,
  type MeilTear, type Outfit, type Prop, type SoldierKit,
} from '../../characters/wardrobe';

/*
 * FilmActor — one member of the cast of the opening film: HumanModel + strand groom + costume + props + a mocap
 * player + face / eye / arm-IK controls, placed on a set by a world position + yaw (game convention: forward =
 * (sin yaw, 0, cos yaw)).
 *
 *   const saul = await FilmActor.create({ role: 'saul', quality: engine.quality.name, msaa: engine.quality.msaa });
 *   scene.add(saul.root);
 *   // per frame (performance code sets clips / poses first):
 *   saul.update(dt, camera, renderer.domElement.height, wind);
 *   saul.dispose();                                   // after the film (phones)
 *
 * Update order inside update(): mocap -> proxy arm poses -> human.update (rig, face, eyes) -> post IK (arm reach)
 * -> props -> groom -> outfit (cloth, tzitzit) -> tear.
 */

export type CastRole = 'saul' | 'samuel' | 'elder' | 'soldier' | 'armourBearer' | 'philistine';
export type Quality = 'low' | 'medium' | 'high';

export interface ActorSpec {
  role: CastRole;
  quality: Quality;
  seed?: number;
  msaa?: number;
  /** 'hero' = full quality (default for saul / samuel), 'near' = full costume, 'crowd' = base mesh, 1K, light groom */
  lod?: 'hero' | 'near' | 'crowd';
  kit?: SoldierKit;
  rank?: 'elite' | 'rank';
  /** ground height under a world point (feet IK / placement); default flat 0 */
  ground?: (x: number, z: number) => number;
}

/** proxy Euler rotations for the arms (character axes, DavidModel conventions: x < 0 swings forward) */
export interface ArmPose {
  ua: [number, number, number];
  fa: [number, number, number];
  hd: [number, number, number];
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _W = new THREE.Vector3(), _T = new THREE.Vector3();

export class FilmActor {
  readonly root = new THREE.Group();
  /** props (not in the outfit): spear / helmet / shield / staff / bow — keyed by name */
  readonly props: Record<string, THREE.Object3D> = {};
  tear: MeilTear | null = null;
  /** arm poses from the proxy path (masked out of the mocap); weight 0..1 each */
  readonly armPose: Record<'L' | 'R', { pose: ArmPose | null; weight: number }> = { L: { pose: null, weight: 0 }, R: { pose: null, weight: 0 } };
  /** world-space reach targets for post-IK (e.g. Saul's hand to the corner of the me'il) */
  readonly reach: Record<'L' | 'R', { target: THREE.Vector3 | null; weight: number }> = { L: { target: null, weight: 0 }, R: { target: null, weight: 0 } };
  /** keep a held prop's shaft world-aligned with `axis` (e.g. a carried spear upright) by turning the wrist */
  readonly upright: Record<'L' | 'R', { weight: number; axis: THREE.Vector3; prop: string | null }> = {
    L: { weight: 0, axis: new THREE.Vector3(0, 1, 0), prop: null },
    R: { weight: 0, axis: new THREE.Vector3(0, 1, 0), prop: null },
  };
  /** velocity for cloth sway (world m/s), set by the performance when the root is moved directly */
  readonly velocity = new THREE.Vector3();
  private lastPos = new THREE.Vector3();
  private hasLast = false;
  ground: (x: number, z: number) => number;
  /** in-place mocap: counter-rotate the clip's heading (default on) */
  cancelHeading = true;
  private headingCorr = 0;
  /** next update cancels the full heading at once (after a cut / clip change) */
  headingSnap = true;

  private constructor(
    readonly spec: ActorSpec,
    readonly human: HumanModel,
    readonly groom: Groom | null,
    readonly outfit: Outfit,
    readonly mocap: MocapPlayer,
  ) {
    this.root.name = `actor:${spec.role}${spec.seed ?? ''}`;
    this.root.add(human.root);
    this.ground = spec.ground ?? (() => 0);
  }

  static async create(spec: ActorSpec): Promise<FilmActor> {
    const q = spec.quality;
    const lod = spec.lod ?? (spec.role === 'saul' || spec.role === 'samuel' ? 'hero' : 'near');
    const crowd = lod === 'crowd';
    const seed = spec.seed ?? 1;
    const preset = spec.role === 'saul' ? 'saul' : spec.role === 'samuel' ? 'samuel' : spec.role === 'elder' ? 'elder' : 'man';
    const human = await HumanModel.load({
      preset, quality: crowd ? 'low' : q,
      ...(preset === 'man' || preset === 'elder' ? { seed: spec.role === 'philistine' ? seed + 400 : seed } : {}),
      ...(crowd ? { geometry: 'base' as const, textureSize: 1024 as const } : {}),
    });
    const gq = crowd ? 'low' : q;
    let outfit: Outfit;
    let tear: MeilTear | null = null;
    const props: Record<string, THREE.Object3D> = {};
    let groomSpec: GroomStyleSpec;
    let headband: { height: number; radius: [number, number]; width?: number; tilt?: number } | undefined;
    const [rx, rz] = human.metrics.crownRadius;
    switch (spec.role) {
      case 'saul': {
        const r = await dressSaulGilgal(human, { quality: q, crowd });
        outfit = r.outfit;
        props.spear = r.spear.object;
        props.helmet = r.helmet;
        (props.spear as THREE.Object3D).userData.prop = r.spear;
        groomSpec = 'saul';
        headband = { height: 0, radius: [rx + 0.0078, rz + 0.0078], width: 0.018, tilt: 0.008 };
        break;
      }
      case 'samuel': {
        const r = await dressSamuel(human, { quality: q, crowd });
        outfit = r.outfit;
        tear = r.tear;
        groomSpec = 'samuel';
        break;
      }
      case 'elder': {
        const r = await dressElder(human, { quality: q, seed, crowd });
        outfit = r.outfit;
        if (r.staff) {
          props.staff = r.staff.object;
          props.staff.userData.prop = r.staff;
        }
        groomSpec = { kind: 'elder', seed };
        break;
      }
      case 'philistine': {
        const r = await dressPhilistine(human, { quality: q, seed, crowd, rank: spec.rank });
        outfit = r.outfit;
        if (r.main) {
          props.main = r.main.object;
          props.main.userData.prop = r.main;
        }
        if (r.shield) props.shield = r.shield;
        groomSpec = { kind: 'philistine', seed };
        headband = { height: 0, radius: [rx + 0.006, rz + 0.006] };
        break;
      }
      default: {
        const r = spec.role === 'armourBearer' ? await dressArmourBearer(human, { quality: q, seed, crowd }) : await dressSoldier(human, { quality: q, seed, crowd, kit: spec.kit });
        outfit = r.outfit;
        if (r.main) {
          props.main = r.main.object;
          props.main.userData.prop = r.main;
        }
        if (r.off) {
          const o = (r.off as Prop).object ?? (r.off as THREE.Object3D);
          props.off = o;
          if ((r.off as Prop).object) o.userData.prop = r.off;
        }
        if (r.shield) props.shield = r.shield;
        groomSpec = { kind: 'soldier', seed, headband: false };
      }
    }
    const groom = await createGroom(human, groomSpec, { quality: gq, msaa: spec.msaa, headband, density: crowd ? 0.5 : 1, simulate: !crowd });
    const mocap = new MocapPlayer(human);
    mocap.rootMotion = 'inplace';
    const a = new FilmActor({ ...spec, lod }, human, groom, outfit, mocap);
    a.tear = tear;
    Object.assign(a.props, props);
    human.root.position.y = outfit.groundOffset;
    return a;
  }

  /** attach a prop (by key) to a hand grip socket (props made by the wardrobe carry their grip frame) */
  holdProp(key: string, side: 'L' | 'R', flip = false) {
    const o = this.props[key];
    if (!o) return;
    const prop = o.userData.prop as Prop | undefined;
    const sock = side === 'L' ? this.human.sockets.handGripL : this.human.sockets.handGripR;
    if (prop) {
      attachProp(prop, sock, flip);
      const r = o.userData.radiusAtGrip as number | undefined;
      if (r) this.human.setGripRadius(r);
    } else sock.add(o);
    this.human.rig.setFingers(side, 'grip');
  }

  /** place on the set: feet at (x, ground, z), facing yaw */
  place(pos: THREE.Vector3, yaw: number) {
    this.root.position.set(pos.x, this.ground(pos.x, pos.z), pos.z);
    this.root.rotation.set(0, yaw, 0);
  }

  get yaw() {
    return this.root.rotation.y;
  }

  /** diagnostics: horizontal facing angle of the face (from the eyes) vs the placement yaw */
  facing() {
    const s = this.human.sockets as Record<string, THREE.Object3D>;
    const h = this.human.bones.head.getWorldPosition(new THREE.Vector3());
    const e = this.eyesWorld(new THREE.Vector3());
    void s;
    return { yaw: this.yaw, face: Math.atan2(e.x - h.x, e.z - h.z) };
  }

  /** world position of a named head / chest point (camera and look-at targets) */
  headWorld(out = new THREE.Vector3()) {
    return this.human.bones.head.getWorldPosition(out).add(_v.set(0, 0.06, 0));
  }

  eyesWorld(out = new THREE.Vector3()) {
    const s = this.human.sockets as Record<string, THREE.Object3D>;
    s.eyeL.getWorldPosition(out);
    s.eyeR.getWorldPosition(_v);
    return out.add(_v).multiplyScalar(0.5);
  }

  /** mask the mocap out of one arm so that armPose (proxy path) drives it */
  private applyArmMasks() {
    const mask = this.mocap.mask;
    for (let i = 0; i < MOCAP_BONES.length; i++) {
      const b = MOCAP_BONES[i];
      const side = b.endsWith('.L') ? 'L' : b.endsWith('.R') ? 'R' : null;
      const arm = side && /^(clavicle|shoulder01|upperarm|lowerarm|wrist)/.test(b);
      mask[i] = arm ? 1 - (this.armPose[side!].pose ? this.armPose[side!].weight : 0) : 1;
    }
    const j = this.human.joints;
    for (const side of ['L', 'R'] as const) {
      const p = this.armPose[side].pose;
      const ua = side === 'L' ? j.uaL : j.uaR, fa = side === 'L' ? j.faL : j.faR, hd = side === 'L' ? j.hdL : j.hdR;
      if (!p) {
        ua.rotation.set(0, 0, 0);
        fa.rotation.set(0, 0, 0);
        hd.rotation.set(0, 0, 0);
        continue;
      }
      ua.rotation.set(...p.ua);
      fa.rotation.set(...p.fa);
      hd.rotation.set(...p.hd);
    }
  }

  /**
   * Per frame. `wind` world m/s. Call after the performance has set clips, poses, targets and placement.
   */
  update(dt: number, camera?: THREE.Camera, viewportH?: number, wind = _zero) {
    // velocity from placement (performances move root directly)
    if (this.hasLast && dt > 0) this.velocity.copy(this.root.position).sub(this.lastPos).divideScalar(dt);
    this.lastPos.copy(this.root.position);
    this.hasLast = true;
    this.applyArmMasks();
    this.mocap.update(dt);
    if (!(this.mocap.rootMotion === 'inplace' && this.cancelHeading)) this.headingCorr = 0;
    this.human.root.rotation.y = this.headingCorr;
    this.root.updateMatrixWorld(true);
    this.human.update(dt, camera, viewportH);
    // in-place playback keeps the clip's own pelvis heading (idles were captured facing anywhere): measure the pelvis
    // heading relative to the placement and cancel its average (slowly, so a walk keeps its natural pelvis swing)
    if (this.mocap.rootMotion === 'inplace' && this.cancelHeading) {
      const rb = (this.human.bones as Record<string, THREE.Object3D>).root;
      if (rb) {
        rb.getWorldQuaternion(_q);
        this.root.getWorldQuaternion(_q2);
        _q.premultiply(_q2.invert());
        _q.multiply(this.human.rig.restWorldQuaternion('root', _q3).invert());
        _v.set(0, 0, 1).applyQuaternion(_q);
        const heading = Math.atan2(_v.x, _v.z);
        const k = this.headingSnap ? 1 : 1 - Math.exp(-3 * dt);
        this.headingCorr -= heading * k;
        this.headingSnap = false;
      }
    }
    for (const side of ['L', 'R'] as const) {
      const r = this.reach[side];
      if (r.target && r.weight > 0.001) this.armIK(side, r.target, r.weight);
    }
    for (const side of ['L', 'R'] as const) {
      const u = this.upright[side];
      if (u.prop && u.weight > 0.001) this.keepUpright(side, u.prop, u.axis, u.weight);
    }
    this.groom?.update(dt, wind);
    this.outfit.update(dt, { velocity: this.velocity, wind });
    if (this.tear) {
      this.tear.wind.copy(wind);
      this.tear.update(dt);
    }
  }

  /** two-bone IK on the MakeHuman arm (after the rig): wrist toward `target` (world), blended by `w` */
  armIK(side: 'L' | 'R', target: THREE.Vector3, w: number) {
    const b = this.human.bones as Record<string, THREE.Object3D>;
    const ua = b[`upperarm01.${side}`], fa = b[`lowerarm01.${side}`], wr = b[`wrist.${side}`];
    if (!ua || !fa || !wr) return;
    ua.getWorldPosition(_S);
    fa.getWorldPosition(_E);
    wr.getWorldPosition(_W);
    const a = _S.distanceTo(_E), bl = _E.distanceTo(_W);
    _T.copy(target).sub(_S);
    const d = Math.min(a + bl - 1e-3, Math.max(Math.abs(a - bl) + 1e-3, _T.length()));
    _T.setLength(d).add(_S);
    // 1. elbow angle
    const uSE = _v.copy(_S).sub(_E).normalize();
    const uEW = _v2.copy(_W).sub(_E).normalize();
    const n = _v3.crossVectors(uSE, uEW);
    if (n.lengthSq() < 1e-8) n.set(0, 1, 0);
    n.normalize();
    const want = Math.acos(THREE.MathUtils.clamp((a * a + bl * bl - d * d) / (2 * a * bl), -1, 1));
    const newDir = uSE.clone().applyAxisAngle(n, want);
    _q.setFromUnitVectors(uEW, newDir);
    _q.slerp(_q3.identity(), 1 - w);
    rotateWorld(fa, _q);
    // 2. aim the chain
    wr.getWorldPosition(_W);
    _q2.setFromUnitVectors(_W.sub(_S).normalize(), _v.copy(_T).sub(_S).normalize());
    _q2.slerp(_q3.identity(), 1 - w);
    rotateWorld(ua, _q2);
    ua.updateMatrixWorld(true);
  }

  /** turn the wrist so that the held prop's +Y axis points along `axis` (world) */
  keepUpright(side: 'L' | 'R', key: string, axis: THREE.Vector3, w: number) {
    const o = this.props[key];
    const wr = (this.human.bones as Record<string, THREE.Object3D>)[`wrist.${side}`];
    if (!o || !wr) return;
    o.updateWorldMatrix(true, false);
    _v.set(0, 1, 0).transformDirection(o.matrixWorld);
    _q.setFromUnitVectors(_v, _v2.copy(axis).normalize());
    _q.slerp(_q3.identity(), 1 - w);
    rotateWorld(wr, _q);
  }

  /** carry the helmet under the left arm: a socket on the left forearm (rest frame), crown outward, rim to the hip */
  carryUnderArm(key: string, side: 'L' | 'R' = 'L', o: { along?: number; back?: number; inward?: number } = {}) {
    const obj = this.props[key];
    if (!obj) return;
    const rig = this.human.rig;
    const e = rig.restWorldPosition(`lowerarm01.${side}`), wr = rig.restWorldPosition(`wrist.${side}`);
    const sx = side === 'L' ? 1 : -1;
    const c = e.clone().lerp(wr, o.along ?? 0.5).add(new THREE.Vector3(-sx * (o.inward ?? 0.02), 0, -(o.back ?? 0.12)));
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -sx * Math.PI / 2);
    const sock = this.human.addSocket(`carry_${key}`, `lowerarm01.${side}`, c, q);
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    sock.add(obj);
    rig.setFingers(side, 'cup');
  }

  setVisible(v: boolean) {
    this.root.visible = v;
    if (this.tear) {
      this.tear.free.visible = v && this.tear.isTorn;
      this.tear.threads.visible = v && this.tear.isTorn;
    }
  }

  /** add world-space helper objects (the torn piece, threads) to the scene */
  addTo(scene: THREE.Object3D) {
    scene.add(this.root);
    if (this.tear) scene.add(this.tear.free, this.tear.threads);
  }

  dispose() {
    this.mocap.detach?.();
    this.groom?.dispose();
    this.outfit.dispose();
    this.tear?.dispose();
    for (const k in this.props) {
      this.props[k].traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
        }
      });
      this.props[k].removeFromParent();
    }
    this.human.dispose();
    this.root.removeFromParent();
  }

  /** preload the mocap clips of the film's performances (behind the loading screen) */
  static preloadClips(names: string[]) {
    return MocapLibrary.shared.preload(names);
  }
}

const _zero = new THREE.Vector3();

function rotateWorld(bone: THREE.Object3D, dq: THREE.Quaternion) {
  bone.updateWorldMatrix(true, false);
  bone.getWorldQuaternion(_q3);
  const parentQ = new THREE.Quaternion();
  bone.parent!.getWorldQuaternion(parentQ);
  const world = dq.clone().multiply(_q3);
  bone.quaternion.copy(parentQ.invert().multiply(world));
  bone.updateMatrixWorld(true);
}
