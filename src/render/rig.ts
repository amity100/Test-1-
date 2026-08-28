import * as THREE from 'three';

/**
 * A human being built out of nothing.
 *
 * No models, no rigs, no motion capture — a joint hierarchy with a mesh hung on
 * each bone, and every angle driven by maths at runtime. Proportions follow the
 * usual eight-head canon so the silhouette reads as a person from across a room
 * and still reads as a person from a desk away.
 */

export interface Joints {
  root: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  shoulderL: THREE.Group; shoulderR: THREE.Group;
  armL: THREE.Group; armR: THREE.Group;
  foreL: THREE.Group; foreR: THREE.Group;
  thighL: THREE.Group; thighR: THREE.Group;
  shinL: THREE.Group; shinR: THREE.Group;
  footL: THREE.Group; footR: THREE.Group;
  /** Floor to hip joint. Everything that puts a body somewhere needs this. */
  legLen: number;
}

export interface Build {
  /** Standing height in metres. */
  height: number;
  /** 0 slight … 1 broad. */
  bulk: number;
  skin: THREE.Color;
  shirt: THREE.Color;
  trousers: THREE.Color;
  hair: THREE.Color;
}

const SKINS = ['#e8c8a8', '#d9b08c', '#c69770', '#a9784f', '#8a5c3a', '#f0d6bd'];
const SHIRTS = ['#dfe6ea', '#4a6c86', '#2f3a45', '#7d5b6b', '#3f5f4b', '#8a8f96', '#b9532f', '#25303a'];
const TROUSERS = ['#2d3540', '#3b4654', '#1f262e', '#54463a', '#2a3b4a'];
const HAIRS = ['#1b1512', '#2e2119', '#4a3524', '#6b5340', '#8f8a86', '#241c17'];

export function randomBuild(rand: () => number): Build {
  const pick = <T>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
  return {
    height: 1.6 + rand() * 0.27,
    bulk: rand(),
    skin: new THREE.Color(pick(SKINS)),
    shirt: new THREE.Color(pick(SHIRTS)),
    trousers: new THREE.Color(pick(TROUSERS)),
    hair: new THREE.Color(pick(HAIRS)),
  };
}

/**
 * Hang a limb on a bone. A capsule is a cylinder plus two hemispheres, so its
 * total length is the cylinder plus twice the radius — take that off, or every
 * joint in the body ends up with a gap or an overlap in it.
 */
function limb(
  parent: THREE.Group, r: number, len: number, mat: THREE.Material,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.02, len - r * 2), 4, 9), mat);
  m.position.y = -len / 2;
  m.castShadow = true;
  parent.add(m);
  return m;
}

function joint(parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export function buildBody(b: Build): { root: THREE.Group; joints: Joints } {
  const H = b.height;
  // Real proportions, as fractions of standing height. Every one of these is a
  // measurement off a real person rather than a guess: the hip joint sits at
  // 0.53 of your height, the shoulder at 0.82, the knee at 0.285, and the head
  // is an eighth of you. Get these wrong by a tenth and the thing on the screen
  // reads as a doll no matter how well it walks.
  const head = H * 0.14;
  const legLen = H * 0.53;
  const thighLen = H * 0.245;
  const shinLen = H * 0.246;
  const torsoLen = H * 0.33;
  const upperArm = H * 0.186;
  const foreArm = H * 0.146;
  // Shoulder span is nearly a quarter of your height; hip joints are much closer
  // together than hips look. Both of these are the usual thing people get wrong.
  const shoulderW = H * (0.20 + b.bulk * 0.035);
  const hipW = H * (0.105 + b.bulk * 0.012);
  const thick = 0.046 + b.bulk * 0.018;

  const skin = new THREE.MeshStandardMaterial({ color: b.skin, roughness: 0.72 });
  const shirt = new THREE.MeshStandardMaterial({ color: b.shirt, roughness: 0.88 });
  const trousers = new THREE.MeshStandardMaterial({ color: b.trousers, roughness: 0.9 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: b.hair, roughness: 0.95 });

  const root = new THREE.Group();
  const pelvis = joint(root, 0, legLen, 0);

  // ── spine ────────────────────────────────────────────────────────────────
  const spine = joint(pelvis, 0, 0, 0);
  const hips = new THREE.Mesh(
    new THREE.CapsuleGeometry(hipW * 0.82, torsoLen * 0.16, 4, 10), trousers,
  );
  hips.position.y = torsoLen * 0.04;
  hips.scale.set(1.04, 1, 0.76);
  hips.castShadow = true;
  spine.add(hips);

  const chest = joint(spine, 0, torsoLen * 0.52, 0);
  const ribs = new THREE.Mesh(
    new THREE.CapsuleGeometry(shoulderW * 0.44, torsoLen * 0.4, 5, 12), shirt,
  );
  ribs.position.y = torsoLen * 0.15;
  ribs.scale.set(1.08, 1, 0.62);
  ribs.castShadow = true;
  chest.add(ribs);

  // Shoulders: a wedge across the top of the ribs. Without it the arms look bolted on.
  const yoke = new THREE.Mesh(
    new THREE.CapsuleGeometry(thick * 1.42, shoulderW * 0.84, 4, 8), shirt,
  );
  yoke.rotation.z = Math.PI / 2;
  yoke.position.y = torsoLen * 0.36;
  yoke.scale.z = 0.72;
  yoke.castShadow = true;
  chest.add(yoke);

  const neck = joint(chest, 0, torsoLen * 0.44, 0);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(head * 0.25, head * 0.29, head * 0.32, 9), skin);
  neckMesh.position.y = head * 0.13;
  neck.add(neckMesh);

  const headJ = joint(neck, 0, head * 0.3, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(head * 0.42, 14, 12), skin);
  skull.position.y = head * 0.38;
  skull.scale.set(0.9, 1.08, 0.94);
  skull.castShadow = true;
  headJ.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(head * 0.29, 10, 8), skin);
  jaw.position.set(0, head * 0.24, head * 0.1);
  jaw.scale.set(0.86, 0.8, 0.95);
  headJ.add(jaw);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(head * 0.44, 14, 10,
    0, Math.PI * 2, 0, Math.PI * 0.62), hair);
  cap.position.y = head * 0.4;
  cap.scale.set(0.94, 1.06, 1.0);
  headJ.add(cap);
  // A nose. It is four triangles, and it is the difference between a head and a ball:
  // without it you cannot tell which way somebody is looking.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(head * 0.08, head * 0.16, 4), skin);
  nose.position.set(0, head * 0.33, head * 0.33);
  nose.rotation.set(Math.PI * 0.42, Math.PI * 0.25, 0);
  headJ.add(nose);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(head * 0.34, head * 0.035, head * 0.06), hair);
  brow.position.set(0, head * 0.5, head * 0.28);
  headJ.add(brow);

  // ── arms ─────────────────────────────────────────────────────────────────
  const mkArm = (side: -1 | 1) => {
    const shoulder = joint(chest, side * shoulderW * 0.5, torsoLen * 0.36, 0);
    // A deltoid, so the arm grows out of the shoulder instead of hanging beside it.
    const cap = new THREE.Mesh(new THREE.SphereGeometry(thick * 1.34, 9, 7), shirt);
    cap.scale.set(1, 1.1, 0.9);
    cap.castShadow = true;
    shoulder.add(cap);
    const arm = joint(shoulder);
    limb(arm, thick * 1.02, upperArm, shirt);
    const fore = joint(arm, 0, -upperArm, 0);
    limb(fore, thick * 0.84, foreArm, skin);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(thick * 0.92, 8, 6), skin);
    hand.position.y = -foreArm - thick * 0.62;
    hand.scale.set(0.78, 1.45, 0.5);
    fore.add(hand);
    return { shoulder, arm, fore };
  };
  const L = mkArm(-1);
  const R = mkArm(1);

  // ── legs ─────────────────────────────────────────────────────────────────
  const mkLeg = (side: -1 | 1) => {
    const thigh = joint(pelvis, side * hipW * 0.5, 0, 0);
    limb(thigh, thick * 1.62, thighLen, trousers);
    const shin = joint(thigh, 0, -thighLen, 0);
    limb(shin, thick * 1.2, shinLen, trousers);
    const foot = joint(shin, 0, -shinLen, 0);
    const shoeMesh = new THREE.Mesh(new THREE.BoxGeometry(thick * 2.2, thick * 1.35, head * 0.5), shoe);
    shoeMesh.position.set(0, -thick * 0.62, head * 0.11);
    shoeMesh.castShadow = true;
    foot.add(shoeMesh);
    return { thigh, shin, foot };
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

  return {
    root,
    joints: {
      root, pelvis, spine, chest, neck, head: headJ,
      shoulderL: L.shoulder, shoulderR: R.shoulder,
      armL: L.arm, armR: R.arm, foreL: L.fore, foreR: R.fore,
      thighL: legL.thigh, thighR: legR.thigh,
      shinL: legL.shin, shinR: legR.shin,
      footL: legL.foot, footR: legR.foot,
      legLen,
    },
  };
}

const D = Math.PI / 180;

/**
 * One stride, in joint angles.
 *
 * `phase` runs 0..1 over a full two-step cycle. The curves are the standard
 * gait shape: the hip swings forward and back once per step, the knee has two
 * flexion peaks (a small one just after the foot lands, a big one as the leg
 * swings through), the ankle rolls off the toe, and the arms swing opposite
 * their leg. The pelvis bobs twice per cycle and rolls toward the stance leg.
 */
export function walk(j: Joints, phase: number, speed: number, standH: number) {
  const t = phase * Math.PI * 2;
  const amp = Math.min(1, speed / 1.35);

  const leg = (thigh: THREE.Group, shin: THREE.Group, foot: THREE.Group, off: number) => {
    const p = t + off;
    // Hip: forward at the start of stance, back by toe-off.
    thigh.rotation.x = Math.sin(p) * 26 * D * amp;
    // Knee: never straightens backwards; two peaks per cycle.
    const swing = Math.max(0, -Math.cos(p - 0.7));
    const strike = Math.max(0, Math.sin(p * 2 + 1.4)) * 0.22;
    shin.rotation.x = -(swing * 62 + strike * 26) * D * amp;
    // Ankle: toe down as the leg swings, flat at the plant.
    foot.rotation.x = (Math.sin(p + 2.2) * 15 - 4) * D * amp;
  };
  leg(j.thighL, j.shinL, j.footL, 0);
  leg(j.thighR, j.shinR, j.footR, Math.PI);

  // Arms swing opposite the leg on the same side, and a shade wider than you expect.
  j.armL.rotation.x = -Math.sin(t) * 30 * D * amp;
  j.armR.rotation.x = Math.sin(t) * 30 * D * amp;
  j.foreL.rotation.x = -(18 + Math.sin(t + 1.2) * 14) * D * amp;
  j.foreR.rotation.x = -(18 - Math.sin(t + 1.2) * 14) * D * amp;
  j.armL.rotation.z = -5 * D;
  j.armR.rotation.z = 5 * D;

  // The body rises twice per stride and leans into the stance leg.
  j.root.position.y = standH + Math.abs(Math.sin(t)) * 0.022 * amp;
  j.pelvis.rotation.z = Math.sin(t) * 4 * D * amp;
  j.pelvis.rotation.y = Math.sin(t) * 5 * D * amp;
  // The chest counter-rotates against the hips: this is what stops it reading as a puppet.
  j.chest.rotation.y = -Math.sin(t) * 7 * D * amp;
  j.spine.rotation.x = (2 + amp * 3) * D;
}

/** Standing still is not standing frozen. */
export function idle(j: Joints, t: number, standH: number, seed: number) {
  const b = Math.sin(t * 1.15 + seed) * 0.5 + Math.sin(t * 0.47 + seed * 2) * 0.5;
  j.root.position.y = standH + b * 0.006;
  j.pelvis.rotation.z = b * 1.6 * D;
  j.chest.rotation.y = Math.sin(t * 0.33 + seed) * 2.2 * D;
  j.spine.rotation.x = 2 * D + b * 0.8 * D;
  for (const [thigh, shin, foot] of [
    [j.thighL, j.shinL, j.footL], [j.thighR, j.shinR, j.footR],
  ] as const) {
    thigh.rotation.x *= 0.85;
    shin.rotation.x = shin.rotation.x * 0.85 - 1.5 * D;
    foot.rotation.x *= 0.85;
  }
  j.armL.rotation.x = (Math.sin(t * 0.6 + seed) * 2 - 3) * D;
  j.armR.rotation.x = (Math.sin(t * 0.6 + seed + 1) * 2 - 3) * D;
  j.foreL.rotation.x = -12 * D;
  j.foreR.rotation.x = -12 * D;
  j.armL.rotation.z = -6 * D;
  j.armR.rotation.z = 6 * D;
}

/**
 * Sitting at a desk. `seatY` is the world height of the seat itself, not of the
 * body — the hips go on the seat and the root, which is the floor of the body,
 * drops a leg's length below it. Passing the floor height here was what had
 * everybody sitting a metre up in the air.
 */
export function sit(j: Joints, t: number, seatY: number, seed: number) {
  j.root.position.y = seatY - j.legLen;
  j.thighL.rotation.x = -84 * D; j.thighR.rotation.x = -84 * D;
  j.shinL.rotation.x = 86 * D; j.shinR.rotation.x = 86 * D;
  j.footL.rotation.x = 4 * D; j.footR.rotation.x = 4 * D;
  j.pelvis.rotation.z = 0;
  j.spine.rotation.x = 6 * D;
  j.chest.rotation.y = Math.sin(t * 0.3 + seed) * 1.6 * D;
  // Typing: small alternating wrist dips.
  const type = Math.sin(t * 7.4 + seed) * 0.5 + 0.5;
  j.armL.rotation.x = -46 * D; j.armR.rotation.x = -46 * D;
  j.foreL.rotation.x = -(52 + type * 6) * D;
  j.foreR.rotation.x = -(52 + (1 - type) * 6) * D;
  j.armL.rotation.z = -9 * D; j.armR.rotation.z = 9 * D;
}

/** Turn the head toward something, within a neck's actual range. */
export function lookAt(j: Joints, worldPoint: THREE.Vector3, k: number) {
  const local = j.head.parent!.worldToLocal(worldPoint.clone());
  const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -78 * D, 78 * D);
  const flat = Math.hypot(local.x, local.z);
  const pitch = THREE.MathUtils.clamp(-Math.atan2(local.y, flat), -38 * D, 45 * D);
  j.head.rotation.y += (yaw - j.head.rotation.y) * k;
  j.head.rotation.x += (pitch - j.head.rotation.x) * k;
  // The chest follows the head a little, the way a real person turns.
  j.chest.rotation.y += (yaw * 0.34 - j.chest.rotation.y) * k * 0.6;
}
