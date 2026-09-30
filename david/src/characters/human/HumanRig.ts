import * as THREE from 'three';
import type { RigJson } from './HumanData';

/*
 * HumanRig — drives the MakeHuman skeleton from the game's simple pose format (src/characters/Rig.ts).
 *
 * `joints` are proxy Object3Ds with exactly the DavidModel conventions: the character faces +Z, its left is
 * +X, a rotation.x < 0 swings a limb forward, positive shin rotation bends the knee, and at rotation 0 every
 * limb hangs straight down (the rest pose built by tools/human/build_human.py).  A PoseMixer can drive them
 * directly (mixer.apply()), foot IK can edit them, then call `update()` once per frame to transfer them to the
 * MakeHuman bones with the aligned-frame mapping
 *
 *     bone.local = B * W^-1 * c * W          (W = rest world rotation, B = rest local rotation)
 *
 * where c is the joint rotation expressed in character axes.  Spine/neck rotations are distributed over the
 * multi-segment MakeHuman bones, limb twist is split between the twist bones (no candy-wrapping), the forearm
 * takes the hand's twist (the wrist cannot twist), and the clavicles follow the arm (scapulohumeral rhythm).
 *
 * Fingers, eyes, lids, jaw and facial expressions (MakeHuman FACS-like pose units) are layered on top.
 */

export const PROXY_JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'uaL', 'faL', 'hdL', 'uaR', 'faR', 'hdR', 'thL', 'shinL', 'ftL', 'thR', 'shinR', 'ftR'] as const;
export type ProxyJoint = (typeof PROXY_JOINTS)[number];

export type FingerPose = 'relaxed' | 'fist' | 'grip' | 'open' | 'spread' | 'cup';
export type Expression = 'neutral' | 'determined' | 'effort' | 'awe' | 'smile' | 'fear' | 'pain' | 'anger' | 'sad';

// [MCP, PIP, DIP] flexion (degrees) for index, middle, ring, pinky; thumb [CMC, MCP, IP]; spread (deg, + = toward middle)
export interface FingerShape {
  f: [number, number, number][];
  t: [number, number, number];
  tOpp: number; // thumb opposition (deg)
  tw?: [number, number, number]; // thumb wrap about the grip (cylinder) axis: CMC, MCP, IP (deg)
  spread: [number, number, number, number];
  cup: number; // metacarpal arch for ring/pinky (deg)
}
const FINGER_SHAPES: Record<FingerPose, FingerShape> = {
  open: { f: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], t: [0, 0, 0], tOpp: 0, spread: [2, 0, 1, 2], cup: 0 },
  spread: { f: [[-5, 0, 0], [-5, 0, 0], [-5, 0, 0], [-5, 0, 0]], t: [-10, 0, 0], tOpp: -10, spread: [-6, 0, -5, -12], cup: -4 },
  relaxed: { f: [[14, 24, 10], [18, 30, 14], [22, 34, 16], [27, 38, 20]], t: [6, 12, 14], tOpp: 16, spread: [6, 1, 4, 9], cup: 5 },
  cup: { f: [[28, 30, 12], [30, 32, 14], [32, 34, 16], [34, 36, 18]], t: [10, 14, 10], tOpp: 30, spread: [7, 1, 4, 8], cup: 10 },
  grip: { f: [[58, 78, 42], [64, 80, 44], [68, 82, 46], [72, 84, 48]], t: [0, 8, 10], tOpp: 20, tw: [34, 34, 30], spread: [6, 1, 3, 6], cup: 12 },
  fist: { f: [[86, 100, 62], [90, 102, 64], [92, 104, 66], [94, 106, 68]], t: [10, 20, 20], tOpp: 30, tw: [30, 36, 30], spread: [7, 1, 4, 8], cup: 16 },
};

// Facial expressions as MakeHuman pose-unit weights (face-poseunits.bvh).
const EXPRESSIONS: Record<Expression, Record<string, number>> = {
  neutral: {},
  determined: {
    LeftBrowDown: 0.55, RightBrowDown: 0.55, LeftLowerLidUp: 0.3, RightLowerLidUp: 0.3,
    NasolabialDeepener: 0.2, lowerLipUp: 0.18, MouthLeftPullSide: 0.12, MouthRightPullSide: 0.12, ChinForward: 0.1,
  },
  effort: {
    LeftBrowDown: 0.8, RightBrowDown: 0.8, NoseWrinkler: 0.35, LeftLowerLidUp: 0.55, RightLowerLidUp: 0.55,
    LeftUpperLidClosed: 0.2, RightUpperLidClosed: 0.2, MouthLeftPullSide: 0.45, MouthRightPullSide: 0.45,
    MouthLeftPlatysma: 0.45, MouthRightPlatysma: 0.45, UpperLipUp: 0.25, lowerLipDown: 0.2, JawDrop: 0.06, NasolabialDeepener: 0.4,
  },
  awe: {
    LeftInnerBrowUp: 0.6, RightInnerBrowUp: 0.6, LeftOuterBrowUp: 0.45, RightOuterBrowUp: 0.45,
    LeftUpperLidOpen: 0.45, RightUpperLidOpen: 0.45, JawDrop: 0.12, lowerLipDown: 0.15,
  },
  smile: {
    MouthLeftPullUp: 0.6, MouthRightPullUp: 0.6, LeftCheekUp: 0.45, RightCheekUp: 0.45, LeftLowerLidUp: 0.25, RightLowerLidUp: 0.25,
    NasolabialDeepener: 0.2,
  },
  fear: {
    LeftInnerBrowUp: 0.8, RightInnerBrowUp: 0.8, LeftOuterBrowUp: 0.3, RightOuterBrowUp: 0.3, LeftUpperLidOpen: 0.7, RightUpperLidOpen: 0.7,
    MouthLeftPullSide: 0.35, MouthRightPullSide: 0.35, JawDrop: 0.15, MouthLeftPlatysma: 0.4, MouthRightPlatysma: 0.4,
  },
  pain: {
    LeftBrowDown: 0.5, RightBrowDown: 0.5, LeftInnerBrowUp: 0.5, RightInnerBrowUp: 0.5, LeftUpperLidClosed: 0.45, RightUpperLidClosed: 0.45,
    LeftLowerLidUp: 0.6, RightLowerLidUp: 0.6, NoseWrinkler: 0.5, UpperLipUp: 0.4, MouthLeftPullSide: 0.4, MouthRightPullSide: 0.4, JawDrop: 0.08,
  },
  anger: {
    LeftBrowDown: 0.9, RightBrowDown: 0.9, NoseWrinkler: 0.3, LeftUpperLidOpen: 0.25, RightUpperLidOpen: 0.25, LeftLowerLidUp: 0.35,
    RightLowerLidUp: 0.35, lowerLipUp: 0.3, MouthLeftPlatysma: 0.25, MouthRightPlatysma: 0.25, NasolabialDeepener: 0.3,
  },
  sad: {
    LeftInnerBrowUp: 0.7, RightInnerBrowUp: 0.7, LeftUpperLidClosed: 0.25, RightUpperLidClosed: 0.25, MouthLeftPullDown: 0.4, MouthRightPullDown: 0.4,
    lowerLipUp: 0.2,
  },
};

const EXPR_NAMES = Object.keys(EXPRESSIONS) as Expression[];
const LR_NAMES = ['Left', 'Right'] as const;
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const QI = new THREE.Quaternion();
const T_SW = new THREE.Quaternion(), T_TW = new THREE.Quaternion(), T_A = new THREE.Quaternion(), T_B = new THREE.Quaternion();
const T_SWF = new THREE.Quaternion(), T_TWF = new THREE.Quaternion(), T_SWH = new THREE.Quaternion(), T_TWH = new THREE.Quaternion();
const T_T = new THREE.Quaternion(), T_C = new THREE.Quaternion(), T_D = new THREE.Quaternion();
const T_E = new THREE.Euler();
const Y = new THREE.Vector3(0, 1, 0);

function frac(q: THREE.Quaternion, f: number, out: THREE.Quaternion) {
  return out.copy(QI).slerp(q, f);
}
/** q = swing * twist, twist about Y (all limbs point along -Y in the rest pose). */
function swingTwistY(q: THREE.Quaternion, swing: THREE.Quaternion, twist: THREE.Quaternion) {
  twist.set(0, q.y, 0, q.w);
  const l = twist.length();
  if (l < 1e-6) twist.identity();
  else twist.set(0, q.y / l, 0, q.w / l);
  swing.copy(q).multiply(_q3.copy(twist).invert());
}

interface BoneRest {
  bone: THREE.Bone;
  parent: number;
  P: THREE.Quaternion; // inverse rest world rotation of the parent
  Q: THREE.Quaternion; // rest world rotation
  restLocal: THREE.Quaternion;
  restWorldPos: THREE.Vector3;
  bindPos: THREE.Vector3; // local bind offset
  c: THREE.Quaternion; // current aligned control rotation
  dirty: boolean;
}

export class HumanRig {
  /** proxy joints (DavidModel.j compatible) — children of `root` */
  readonly joints: Record<ProxyJoint, THREE.Object3D>;
  readonly bones: Record<string, THREE.Bone> = {};
  readonly rest: BoneRest[] = [];
  private byName: Record<string, number> = {};
  /** rest heights / lengths for IK */
  readonly hipHeight: number;
  readonly thighLength: number;
  readonly shinLength: number;
  readonly pelvis = new THREE.Vector3();
  // controls
  fingerPose: Record<'L' | 'R', { pose: FingerPose; w: number; cur: Map<FingerPose, number> }> = {
    L: { pose: 'relaxed', w: 1, cur: new Map([['relaxed', 1]]) },
    R: { pose: 'relaxed', w: 1, cur: new Map([['relaxed', 1]]) },
  };
  /** direct per-unit face control (MakeHuman pose units), 0..1 */
  readonly faceUnits: Record<string, number> = {};
  /** resting lip closure (lowerLipUp pose-unit weight), released automatically when the jaw opens */
  lipSeal = 0.3;
  /** always-on bias: relaxed lids (the upper lid rests ~1.5 mm over the iris, the lower lid touches its rim) */
  // face pass: the upper lid a little lower (0.1 -> 0.16) - the old rest pose showed sclera above the iris (a stare)
  readonly faceBias: Record<string, number> = { LeftLowerLidUp: 0.16, RightLowerLidUp: 0.16, LeftUpperLidClosed: 0.16, RightUpperLidClosed: 0.16 };
  /** resting gaze pitch (radians, negative = down) */
  gazeRestPitch = -0.035;
  private readonly _fAcc: [number, number, number][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  private readonly _tAcc = [0, 0, 0];
  private readonly _twAcc = [0, 0, 0];
  private readonly _spAcc = [0, 0, 0, 0];
  private exprTarget: Partial<Record<Expression, number>> = {};
  private exprCur: Partial<Record<Expression, number>> = {};
  expressionSpeed = 4;
  /** world-space point to look at (eyes + small head contribution is up to the caller) */
  lookTarget: THREE.Vector3 | null = null;
  eyeYaw = 0;
  eyePitch = 0;
  private eyeYawT = 0;
  private eyePitchT = 0;
  jawOpen = 0;
  /** current upper-lid closure 0..1 (read-only; blink + expressions) */
  lidClose = 0;
  breathe = 1;
  blinkEnabled = true;
  private blinkT = 2;
  private blinkPhase = -1;
  private saccadeT = 0.5;
  private saccade = new THREE.Vector2();
  private time = 0;
  private fingerAxes: Record<string, { flex: THREE.Vector3; spread: THREE.Vector3 }> = {};
  /** per-side grip finger shape, solved so the fingers wrap a cylinder of `gripRadius` */
  readonly gripShape: Record<'L' | 'R', FingerShape> = { L: { ...FINGER_SHAPES.grip }, R: { ...FINGER_SHAPES.grip } };
  /** rest-pose grip centre / frame per hand (see HumanModel sockets handGripL/R) */
  readonly grip: Record<'L' | 'R', { center: THREE.Vector3; x: THREE.Vector3; y: THREE.Vector3; z: THREE.Vector3 }> = {} as never;
  gripRadius = 0.02;
  private unitQ: Record<string, Record<string, THREE.Quaternion>> = {};
  private unitIdx: Record<string, number> = {};
  private unitBones: { bi: number; q: THREE.Quaternion }[][] = [];
  private unitW = new Float32Array(0);
  private exprUnits: number[][] = [];
  private faceAcc: THREE.Quaternion[] = [];
  private faceMark = new Uint8Array(0);
  private faceTouched: number[] = [];

  constructor(readonly rig: RigJson, readonly root: THREE.Object3D) {
    // ---------- MakeHuman bones (bind pose: identity rotations, translations only)
    const bones: THREE.Bone[] = [];
    const restWorld: THREE.Quaternion[] = [];
    const restPos: THREE.Vector3[] = [];
    rig.bones.forEach((b, i) => {
      const bone = new THREE.Bone();
      bone.name = b.n;
      const h = new THREE.Vector3(...b.h);
      const bind = b.p >= 0 ? h.clone().sub(new THREE.Vector3(...rig.bones[b.p].h)) : h.clone();
      bone.position.copy(bind);
      bones.push(bone);
      this.bones[b.n] = bone;
      this.byName[b.n] = i;
      const rl = new THREE.Quaternion(b.r[0], b.r[1], b.r[2], b.r[3]);
      const pw = b.p >= 0 ? restWorld[b.p] : QI;
      restWorld.push(pw.clone().multiply(rl));
      restPos.push(b.p >= 0 ? restPos[b.p].clone().add(bind.clone().applyQuaternion(restWorld[b.p])) : h.clone());
      this.rest.push({
        bone, parent: b.p, P: pw.clone().invert(), Q: restWorld[i].clone(), restLocal: rl, restWorldPos: restPos[i], bindPos: bind,
        c: new THREE.Quaternion(), dirty: false,
      });
      if (b.p >= 0) bones[b.p].add(bone);
    });
    root.add(bones[0]);
    // ---------- proxies at rest-pose joint positions
    const P = (n: string) => this.rest[this.byName[n]].restWorldPos;
    this.pelvis.copy(P('spine05'));
    const J = {} as Record<ProxyJoint, THREE.Object3D>;
    const mk = (name: ProxyJoint, parent: THREE.Object3D, at: THREE.Vector3) => {
      const o = new THREE.Object3D();
      o.name = name;
      parent.add(o);
      const parentWorld = (parent as THREE.Object3D) === root ? new THREE.Vector3() : this.worldOfProxy(parent);
      o.position.copy(at).sub(parentWorld);
      J[name] = o;
      return o;
    };
    const hips = mk('hips', root, this.pelvis);
    const spine = mk('spine', hips, P('spine04'));
    const chest = mk('chest', spine, P('spine02'));
    const neck = mk('neck', chest, P('neck01'));
    mk('head', neck, P('head'));
    for (const s of ['L', 'R'] as const) {
      const ua = mk(`ua${s}`, chest, P(`upperarm01.${s}`));
      const fa = mk(`fa${s}`, ua, P(`lowerarm01.${s}`));
      mk(`hd${s}`, fa, P(`wrist.${s}`));
      const th = mk(`th${s}`, hips, P(`upperleg01.${s}`));
      const sh = mk(`shin${s}`, th, P(`lowerleg01.${s}`));
      mk(`ft${s}`, sh, P(`foot.${s}`));
    }
    this.joints = J;
    this.hipHeight = this.pelvis.y;
    this.thighLength = P('upperleg01.L').distanceTo(P('lowerleg01.L'));
    this.shinLength = P('lowerleg01.L').distanceTo(P('foot.L'));
    // ---------- finger axes (rest, character axes)
    for (const s of ['L', 'R'] as const) {
      const sg = s === 'L' ? 1 : -1;
      const wr = P(`wrist.${s}`), idx = P(`finger2-1.${s}`), pky = P(`finger5-1.${s}`), mid = P(`finger3-1.${s}`);
      const f = mid.clone().sub(wr).normalize();
      const r = idx.clone().sub(pky).normalize();
      const palm = f.clone().cross(r).multiplyScalar(sg).normalize();
      for (let k = 1; k <= 5; k++) {
        const a = P(`finger${k}-1.${s}`);
        const tipBone = rig.bones[this.byName[`finger${k}-3.${s}`]];
        const tip = new THREE.Vector3(...tipBone.t);
        // tip in rest: transform bind tail by the (rigid) rest transform of the hand
        const bi = this.byName[`finger${k}-3.${s}`];
        const tipRest = tip.clone().sub(new THREE.Vector3(...tipBone.h)).applyQuaternion(this.rest[bi].Q).add(this.rest[bi].restWorldPos);
        const d = tipRest.sub(a).normalize();
        let flex: THREE.Vector3;
        if (k === 1) {
          // thumb curls across the palm toward the little finger
          const across = r.clone().negate();
          const tgt = palm.clone().multiplyScalar(0.8).add(across.multiplyScalar(0.6)).normalize();
          flex = d.clone().cross(tgt).normalize();
        } else flex = d.clone().cross(palm).normalize();
        this.fingerAxes[`${k}${s}`] = { flex, spread: palm.clone() };
      }
      this.fingerAxes[`palm${s}`] = { flex: r.clone(), spread: palm.clone() };
    }
    this.solveGrip(this.gripRadius);
    // ---------- face pose units as quaternions
    for (const [u, map] of Object.entries(rig.poseunits)) {
      const m: Record<string, THREE.Quaternion> = {};
      for (const [b, q] of Object.entries(map)) if (b in this.byName) m[b] = new THREE.Quaternion(q[0], q[1], q[2], q[3]);
      this.unitQ[u] = m;
      this.unitIdx[u] = this.unitBones.length;
      this.unitBones.push(Object.entries(m).map(([b, qq]) => ({ bi: this.byName[b], q: qq })));
    }
    this.unitW = new Float32Array(this.unitBones.length);
    this.exprUnits = EXPR_NAMES.map((e) => Object.entries(EXPRESSIONS[e]).flatMap(([u, w]) => (u in this.unitIdx ? [this.unitIdx[u], w] : [])));
    this.faceAcc = this.rest.map(() => new THREE.Quaternion());
    this.faceMark = new Uint8Array(this.rest.length);
    this.toRest();
  }

  /**
   * Solve finger flexion so each finger's joint chain wraps a cylinder (staff) of the given radius whose axis
   * runs across the palm under the knuckles.  Updates `gripShape` and `grip` (centre/frame in the rest pose).
   */
  solveGrip(radius: number) {
    this.gripRadius = radius;
    const R = (n: string) => this.rest[this.byName[n]].restWorldPos;
    const tailRest = (n: string) => {
      const i = this.byName[n];
      const b = this.rig.bones[i];
      return new THREE.Vector3(b.t[0] - b.h[0], b.t[1] - b.h[1], b.t[2] - b.h[2]).applyQuaternion(this.rest[i].Q).add(this.rest[i].restWorldPos);
    };
    const D = 180 / Math.PI;
    for (const s of ['L', 'R'] as const) {
      const sg = s === 'L' ? 1 : -1;
      const wr = R(`wrist.${s}`), idx = R(`finger2-1.${s}`), pky = R(`finger5-1.${s}`), mid = R(`finger3-1.${s}`);
      const f = mid.clone().sub(wr).normalize();
      const r = idx.clone().sub(pky).normalize();
      const n = f.clone().cross(r).multiplyScalar(sg).normalize();
      // cylinder axis across the palm, centre under the distal palm crease
      const fingerHalf = 0.0085;
      const center = idx.clone().add(pky).multiplyScalar(0.5).addScaledVector(n, 0.012 + radius + 0.004).addScaledVector(f, -0.012);
      const y = r.clone().sub(n.clone().multiplyScalar(r.dot(n))).normalize();
      this.grip[s] = { center, x: n.clone(), y, z: n.clone().cross(y).normalize() };
      const shape: FingerShape = JSON.parse(JSON.stringify(FINGER_SHAPES.grip));
      const Re = radius + fingerHalf;
      for (let k = 2; k <= 5; k++) {
        const P0 = R(`finger${k}-1.${s}`), P1 = R(`finger${k}-2.${s}`), P2 = R(`finger${k}-3.${s}`), P3 = tailRest(`finger${k}-3.${s}`);
        const u = P1.clone().sub(P0).normalize();
        const w = n.clone().sub(u.clone().multiplyScalar(n.dot(u))).normalize();
        const to2 = (v: THREE.Vector3) => new THREE.Vector2(v.clone().sub(P0).dot(u), v.clone().sub(P0).dot(w));
        const C = to2(center);
        const L = [P1.distanceTo(P0), P2.distanceTo(P1), P3.distanceTo(P2)];
        const rest2 = to2(P2).sub(to2(P1)), rest3 = to2(P3).sub(to2(P2));
        const restAng = [0, Math.atan2(rest2.y, rest2.x), Math.atan2(rest3.y, rest3.x)];
        // walk the chain: each next joint lands on the circle of radius Re around C (flexing toward the palm)
        let P = new THREE.Vector2(0, 0);
        let prevAng = 0;
        const abs: number[] = [];
        for (let j = 0; j < 3; j++) {
          const PC = P.clone().sub(C);
          const rho = PC.length();
          const kk = (Re * Re - rho * rho - L[j] * L[j]) / (2 * L[j]);
          const alpha = Math.atan2(PC.y, PC.x);
          const c = THREE.MathUtils.clamp(kk / Math.max(rho, 1e-6), -1, 1);
          const a1 = alpha + Math.acos(c), a2 = alpha - Math.acos(c);
          // pick the solution that flexes (angle increases toward +w) but by the least amount
          const norm = (a: number) => { let x = a - prevAng; while (x < -Math.PI) x += 2 * Math.PI; while (x > Math.PI) x -= 2 * Math.PI; return x; };
          const c1 = norm(a1), c2 = norm(a2);
          const pick = [c1, c2].filter((x) => x > -0.05).sort((a, b) => a - b)[0] ?? Math.max(c1, c2);
          const ang = prevAng + THREE.MathUtils.clamp(pick, 0, THREE.MathUtils.degToRad(110));
          abs.push(ang);
          P = P.clone().add(new THREE.Vector2(Math.cos(ang), Math.sin(ang)).multiplyScalar(L[j]));
          prevAng = ang;
        }
        const rel = [abs[0] - restAng[0], abs[1] - abs[0] - (restAng[1] - restAng[0]), abs[2] - abs[1] - (restAng[2] - restAng[1])];
        shape.f[k - 2] = [rel[0] * D, rel[1] * D, rel[2] * D];
        // per-finger flexion axis for this chain
        this.fingerAxes[`${k}${s}`].flex.copy(u.clone().cross(w).normalize());
      }
      // thumb wraps around the cylinder axis, curling toward the palm side
      const tb = R(`finger1-2.${s}`), tt = tailRest(`finger1-3.${s}`);
      const dT = tt.clone().sub(tb).normalize();
      const wrap = y.clone();
      if (dT.clone().cross(n).dot(wrap) < 0) wrap.negate();
      this.fingerAxes[`thumbWrap${s}`] = { flex: wrap, spread: n.clone() };
      this.gripShape[s] = shape;
    }
  }

  private worldOfProxy(o: THREE.Object3D) {
    const v = new THREE.Vector3();
    let n: THREE.Object3D | null = o;
    while (n && n !== this.root) {
      v.add(n.position);
      n = n.parent;
    }
    return v;
  }

  get boneList(): THREE.Bone[] {
    return this.rest.map((r) => r.bone);
  }

  /** Put every bone into the rest pose (arms down) and zero all proxies. */
  toRest() {
    for (const r of this.rest) {
      r.bone.quaternion.copy(r.restLocal);
      r.bone.position.copy(r.bindPos);
      r.c.identity();
    }
    for (const k of PROXY_JOINTS) this.joints[k].quaternion.identity();
    this.joints.hips.position.copy(this.pelvis);
  }

  restWorldPosition(bone: string, out = new THREE.Vector3()) {
    return out.copy(this.rest[this.byName[bone]].restWorldPos);
  }
  restWorldQuaternion(bone: string, out = new THREE.Quaternion()) {
    return out.copy(this.rest[this.byName[bone]].Q);
  }
  boneIndex(name: string) {
    return this.byName[name] ?? -1;
  }

  // ---------------------------------------------------------------------------------------- controls
  setFingers(side: 'L' | 'R' | 'both', pose: FingerPose) {
    for (const s of side === 'both' ? (['L', 'R'] as const) : [side]) this.fingerPose[s].pose = pose;
  }
  setExpression(e: Expression, weight = 1) {
    for (const k of Object.keys(this.exprTarget) as Expression[]) this.exprTarget[k] = 0;
    if (e !== 'neutral') this.exprTarget[e] = weight;
  }
  /** blend an extra expression layer on top (e.g. effort while the base is determined) */
  setExpressionWeight(e: Expression, weight: number) {
    this.exprTarget[e] = weight;
  }
  blink() {
    if (this.blinkPhase < 0) this.blinkPhase = 0;
  }

  private setC(name: string, q: THREE.Quaternion) {
    const i = this.byName[name];
    if (i === undefined) return;
    this.rest[i].c.copy(q);
    this.rest[i].dirty = true;
  }
  private mulC(name: string, q: THREE.Quaternion) {
    const i = this.byName[name];
    if (i === undefined) return;
    this.rest[i].c.multiply(q);
    this.rest[i].dirty = true;
  }

  // ---------------------------------------------------------------------------------------- update
  /** Transfer proxy rotations (+ fingers, face, eyes) to the MakeHuman bones. Call once per frame. */
  update(dt: number) {
    this.time += dt;
    for (const r of this.rest) {
      r.c.identity();
      r.dirty = false;
    }
    const J = this.joints;
    const q = (o: THREE.Object3D) => o.quaternion;
    const sw = T_SW, tw = T_TW, a = T_A, b = T_B;
    // ---- torso
    const breath = Math.sin(this.time * 1.35) * this.breathe;
    const rs = q(J.spine), rc = _q2.copy(q(J.chest)).multiply(a.setFromAxisAngle(_v.set(1, 0, 0), -0.012 * breath)), rn = q(J.neck);
    this.setC('spine05', frac(rs, 0.25, a));
    this.setC('spine04', frac(rs, 0.35, a));
    this.setC('spine03', frac(rs, 0.4, a));
    this.setC('spine02', frac(rc, 0.5, a));
    this.setC('spine01', frac(rc, 0.5, a));
    this.setC('neck01', frac(rn, 0.4, a));
    this.setC('neck02', frac(rn, 0.35, a));
    this.setC('neck03', frac(rn, 0.25, a));
    this.setC('head', q(J.head));
    // ---- arms
    for (const s of ['L', 'R'] as const) {
      const sg = s === 'L' ? 1 : -1;
      swingTwistY(q(J[`ua${s}`]), sw, tw);
      // scapulohumeral rhythm: clavicle elevates / protracts with the arm
      const dir = _v.set(0, -1, 0).applyQuaternion(sw);
      const elev = Math.acos(THREE.MathUtils.clamp(-dir.y, -1, 1));
      const lift = 0.3 * Math.max(0, elev - 0.45) + 0.012 * breath;
      const protract = 0.16 * Math.max(0, dir.z) * Math.min(1, elev);
      const clav = a.setFromAxisAngle(_v2.set(0, 0, 1), sg * lift).multiply(b.setFromAxisAngle(Y, -sg * protract));
      this.setC(`clavicle.${s}`, clav);
      // the deltoid bone takes part of the swing (keeps the shoulder round when the arm is raised)
      const sh = frac(sw, 0.3, T_D);
      this.setC(`shoulder01.${s}`, sh);
      const ua1 = _q.copy(clav).multiply(sh).invert().multiply(sw).multiply(frac(tw, 0.5, b));
      this.setC(`upperarm01.${s}`, ua1);
      this.setC(`upperarm02.${s}`, frac(tw, 0.5, b));
      // forearm: elbow swing + forearm twist + the hand's twist (pronation/supination)
      const swF = T_SWF, twF = T_TWF, swH = T_SWH, twH = T_TWH;
      swingTwistY(q(J[`fa${s}`]), swF, twF);
      swingTwistY(q(J[`hd${s}`]), swH, twH);
      const T = T_T.copy(twF).multiply(twH);
      this.setC(`lowerarm01.${s}`, T_C.copy(swF).multiply(frac(T, 0.35, b)));
      this.setC(`lowerarm02.${s}`, frac(T, 0.65, b));
      this.setC(`wrist.${s}`, T_C.copy(twH).invert().multiply(q(J[`hd${s}`])));
      // ---- legs
      swingTwistY(q(J[`th${s}`]), sw, tw);
      this.setC(`upperleg01.${s}`, T_C.copy(sw).multiply(frac(tw, 0.5, b)));
      this.setC(`upperleg02.${s}`, frac(tw, 0.5, b));
      swingTwistY(q(J[`shin${s}`]), sw, tw);
      this.setC(`lowerleg01.${s}`, T_C.copy(sw).multiply(frac(tw, 0.5, b)));
      this.setC(`lowerleg02.${s}`, frac(tw, 0.5, b));
      this.setC(`foot.${s}`, q(J[`ft${s}`]));
      this.updateFingers(s, dt);
    }
    // ---- face
    this.updateFace(dt);
    // ---- write bones
    for (const r of this.rest) {
      if (r.parent < 0) continue;
      r.bone.quaternion.copy(r.P).multiply(r.c).multiply(r.Q);
    }
    // root: rotation about the pelvis centre, translation from the hips proxy
    const root = this.rest[0];
    const hq = q(J.hips);
    root.bone.quaternion.copy(hq).multiply(root.Q);
    root.bone.position.copy(root.bindPos).sub(this.pelvis).applyQuaternion(hq).add(J.hips.position);
  }

  private updateFingers(s: 'L' | 'R', dt: number) {
    const st = this.fingerPose[s];
    // cross-fade between finger poses
    const k = 1 - Math.exp(-12 * dt);
    let sum = 0;
    for (const p of Object.keys(FINGER_SHAPES) as FingerPose[]) {
      const cur = st.cur.get(p) ?? 0;
      const nv = cur + ((p === st.pose ? 1 : 0) - cur) * k;
      if (nv > 1e-3) st.cur.set(p, nv);
      else st.cur.delete(p);
      sum += nv > 1e-3 ? nv : 0;
    }
    // scratch arrays reused every frame (no per-frame allocations)
    const f = this._fAcc, t = this._tAcc, tw = this._twAcc, spread = this._spAcc;
    for (let i = 0; i < 4; i++) {
      f[i][0] = f[i][1] = f[i][2] = 0;
      spread[i] = 0;
    }
    t[0] = t[1] = t[2] = tw[0] = tw[1] = tw[2] = 0;
    let opp = 0, cup = 0;
    for (const [p, w0] of st.cur) {
      const w = w0 / (sum || 1);
      const S = p === 'grip' ? this.gripShape[s] : FINGER_SHAPES[p];
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) f[i][j] += S.f[i][j] * w;
        spread[i] += S.spread[i] * w;
      }
      for (let j = 0; j < 3; j++) {
        t[j] += S.t[j] * w;
        tw[j] += (S.tw?.[j] ?? 0) * w;
      }
      opp += S.tOpp * w;
      cup += S.cup * w;
    }
    const D = Math.PI / 180;
    const sg = s === 'L' ? 1 : -1;
    const a = T_A, b = T_B;
    for (let i = 0; i < 4; i++) {
      const ax = this.fingerAxes[`${i + 2}${s}`];
      // spread (abduction) about the palm normal; positive values close the fingers toward the middle finger.
      // A positive rotation about the palm normal moves the fingers toward the thumb on the left hand
      // and toward the little finger on the right hand.
      const dirSign = i <= 1 ? -1 : 1;
      const spr = a.setFromAxisAngle(ax.spread, spread[i] * D * dirSign * sg);
      this.setC(`finger${i + 2}-1.${s}`, spr.multiply(b.setFromAxisAngle(ax.flex, f[i][0] * D)));
      this.setC(`finger${i + 2}-2.${s}`, a.setFromAxisAngle(ax.flex, f[i][1] * D));
      this.setC(`finger${i + 2}-3.${s}`, a.setFromAxisAngle(ax.flex, f[i][2] * D));
    }
    // palm arch: ring & little-finger metacarpals roll the ulnar side of the hand toward the palm
    const palm = this.fingerAxes[`palm${s}`];
    const cupAxis = _v.copy(palm.flex).negate().cross(palm.spread).normalize();
    this.setC(`metacarpal3.${s}`, a.setFromAxisAngle(cupAxis, cup * 0.5 * D));
    this.setC(`metacarpal4.${s}`, a.setFromAxisAngle(cupAxis, cup * D));
    // thumb: opposition at the CMC joint (swings the thumb in front of the palm), then flexion
    const th = this.fingerAxes[`1${s}`];
    const oppAxis = _v2.copy(palm.flex).cross(palm.spread).normalize();
    const oppQ = a.setFromAxisAngle(oppAxis, opp * D * 0.6);
    const wrapAx = this.fingerAxes[`thumbWrap${s}`].flex;
    const c = T_C;
    this.setC(`finger1-1.${s}`, c.setFromAxisAngle(wrapAx, tw[0] * D).multiply(oppQ).multiply(b.setFromAxisAngle(th.flex, t[0] * D)));
    this.setC(`finger1-2.${s}`, c.setFromAxisAngle(wrapAx, tw[1] * D).multiply(a.setFromAxisAngle(th.flex, t[1] * D)));
    this.setC(`finger1-3.${s}`, c.setFromAxisAngle(wrapAx, tw[2] * D).multiply(a.setFromAxisAngle(th.flex, t[2] * D)));
  }

  private updateFace(dt: number) {
    const W = this.unitW;
    W.fill(0);
    const add = (name: string, w: number) => {
      const i = this.unitIdx[name];
      if (i !== undefined) W[i] += w;
    };
    // expressions (smoothed)
    const k = 1 - Math.exp(-this.expressionSpeed * dt);
    for (let e = 0; e < EXPR_NAMES.length; e++) {
      const name = EXPR_NAMES[e];
      const cur = this.exprCur[name] ?? 0;
      const tgt = this.exprTarget[name] ?? 0;
      const nv = cur + (tgt - cur) * k;
      this.exprCur[name] = nv;
      if (nv < 1e-3) continue;
      const list = this.exprUnits[e];
      for (let j = 0; j < list.length; j += 2) W[list[j]] += list[j + 1] * nv;
    }
    for (const u in this.faceUnits) add(u, this.faceUnits[u]);
    for (const u in this.faceBias) add(u, this.faceBias[u]);
    {
      // lips rest closed (MakeHuman's neutral mouth is slightly parted); the seal releases as the jaw opens
      const iL = this.unitIdx.lowerLipUp, iJ = this.unitIdx.JawDrop, iD = this.unitIdx.lowerLipDown;
      if (iL !== undefined) {
        const open = this.jawOpen * 5 + (iJ !== undefined ? W[iJ] * 5 : 0) + (iD !== undefined ? W[iD] * 3 : 0);
        W[iL] += this.lipSeal * Math.max(0, 1 - open);
      }
    }
    // blinking (natural rate ~ every 2-6 s, ~0.25 s)
    if (this.blinkEnabled) {
      this.blinkT -= dt;
      if (this.blinkT <= 0 && this.blinkPhase < 0) {
        this.blinkPhase = 0;
        this.blinkT = 2 + Math.random() * 4;
      }
    }
    let blink = 0;
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt;
      const p = this.blinkPhase;
      blink = p < 0.07 ? p / 0.07 : p < 0.1 ? 1 : p < 0.26 ? 1 - (p - 0.1) / 0.16 : 0;
      if (p >= 0.26) this.blinkPhase = -1;
    }
    // eyes: look-at + micro saccades
    this.saccadeT -= dt;
    if (this.saccadeT <= 0) {
      this.saccadeT = 0.4 + Math.random() * 1.6;
      this.saccade.set((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.03);
    }
    if (this.lookTarget) this.computeLook(this.lookTarget);
    const ke = 1 - Math.exp(-25 * dt);
    this.eyeYaw += (this.eyeYawT + this.saccade.x - this.eyeYaw) * ke;
    this.eyePitch += (this.eyePitchT + this.gazeRestPitch + this.saccade.y - this.eyePitch) * ke;
    // lids follow the gaze
    const down = Math.max(0, -this.eyePitch) * 1.6, up = Math.max(0, this.eyePitch) * 1.4;
    for (const S of LR_NAMES) {
      const uc = this.unitIdx[`${S}UpperLidClosed`], uo = this.unitIdx[`${S}UpperLidOpen`], lu = this.unitIdx[`${S}LowerLidUp`];
      if (uc !== undefined) W[uc] = Math.min(1, W[uc] + blink + down * 0.6);
      if (uo !== undefined) W[uo] = Math.max(0, W[uo] + up * 0.5 - blink);
      if (lu !== undefined) W[lu] += down * 0.2 + blink * 0.15;
    }
    if (this.jawOpen) add('JawDrop', this.jawOpen);
    this.lidClose = Math.min(1, W[this.unitIdx.LeftUpperLidClosed] ?? 0);
    // accumulate unit rotations per bone (small rotations: order-independent enough)
    const touched = this.faceTouched;
    touched.length = 0;
    for (let u = 0; u < W.length; u++) {
      const w = W[u];
      if (w <= 1e-4) continue;
      const list = this.unitBones[u];
      for (let j = 0; j < list.length; j++) {
        const { bi, q } = list[j];
        const qa = this.faceAcc[bi];
        if (!this.faceMark[bi]) {
          this.faceMark[bi] = 1;
          qa.identity();
          touched.push(bi);
        }
        T_D.copy(QI).slerp(q, Math.min(w, 1.5));
        qa.premultiply(T_D);
      }
    }
    for (const bi of touched) {
      this.rest[bi].c.multiply(this.faceAcc[bi]);
      this.faceMark[bi] = 0;
    }
    // eyeballs
    const e = T_D.setFromEuler(T_E.set(-this.eyePitch, this.eyeYaw, 0, 'YXZ'));
    this.mulC('eye.L', e);
    this.mulC('eye.R', e);
  }

  /** Aim the eyes at a world point (converted into head space; clamped to anatomical limits). */
  private computeLook(target: THREE.Vector3) {
    const head = this.bones.head;
    head.updateWorldMatrix(true, false);
    const eyeMid = _v.copy(this.rest[this.byName['eye.L']].restWorldPos).add(this.rest[this.byName['eye.R']].restWorldPos).multiplyScalar(0.5);
    // eye midpoint in head-bone local space (rest) — head rest rotation is identity for the face
    const headRest = this.rest[this.byName.head];
    const local = eyeMid.sub(headRest.restWorldPos).applyQuaternion(_q.copy(headRest.Q).invert());
    _m.copy(head.matrixWorld).invert();
    const t = _v2.copy(target).applyMatrix4(_m).sub(local).applyQuaternion(headRest.Q);
    this.eyeYawT = THREE.MathUtils.clamp(Math.atan2(t.x, t.z), -0.6, 0.6);
    this.eyePitchT = THREE.MathUtils.clamp(Math.atan2(t.y, Math.hypot(t.x, t.z)), -0.45, 0.35);
  }

  /** Set gaze directly (radians, head space) — ignored while lookTarget is set. */
  setGaze(yaw: number, pitch: number) {
    this.eyeYawT = yaw;
    this.eyePitchT = pitch;
  }
}

export { FINGER_SHAPES, EXPRESSIONS };
