import * as THREE from 'three';
import { clamp, lerp } from '../core/util.js';
import { MAX_HOLES } from '../render/glsl.js';
import { FILL } from './looks.js';
import { GOLD } from './looks.js';
import { carryShapes, carryStrokes, carryPose, heldIn } from './carry.js';
import { TATTOO_LINES, TATTOO_INK } from './wardrobe.js';

// The people's rig: joints for every pose (walk / run / aim / melee / sit / crawl / fall / dance /
// carry), and the solid shapes of the body for bullets and the eraser (render/people.js dresses
// the joints in the first boulevard's bodies). Every hit can erase a hole exactly where it lands;
// parts can be erased away one by one.

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _e = new THREE.Vector3();
const _w = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
// the parts of each arm and leg and the names of their bones (the same strings every time)
const ARM_BONES = [['armR', 'uarmR', 'farmR', 'handR'], ['armL', 'uarmL', 'farmL', 'handL']];
const LEG_BONES = [['legR', 'thighR', 'shinR', 'footR'], ['legL', 'thighL', 'shinL', 'footL']];
const SHIRT_WHITE = [0.92, 0.92, 0.9];
// colours of the small things drawn every frame (one array each, never changed: the linear
// copy of each is worked out once)
const COL_08_08_1 = [0.08, 0.08, 0.1];
const COL_06_06_08 = [0.06, 0.06, 0.08];
const COL_42_5_62 = [0.42, 0.5, 0.62];
const COL_7_12_14 = [0.7, 0.12, 0.14];
const COL_84_14_16 = [0.84, 0.14, 0.16];
const COL_15_15_18 = [0.15, 0.15, 0.18];
const COL_8_3_3 = [0.8, 0.3, 0.3];
const COL_4_26_18 = [0.4, 0.26, 0.18];
const COL_16_14_16 = [0.16, 0.14, 0.16];
const COL_92_88_8 = [0.92, 0.88, 0.8];
const COL_45_3_2 = [0.45, 0.3, 0.2];
const COL_15_25_45 = [0.15, 0.25, 0.45];
const COL_95_78_3 = [0.95, 0.78, 0.3];
const UPPER = ['neck', 'headC', 'shoulder', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR'];
// a bike under somebody (body units, from their feet: up y, forward z): the saddle's height, the
// crank's centre and its length; game/workers.js draws the bike round the same points
export const RIDE = { hip: 0.9, crankY: 0.3, crankZ: 0.16, crank: 0.17 };
const LOWER = ['hip', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR', 'toeL', 'toeR'];
// a fist fight (ROADMAP 5.4, game/fists.js): how far out the punching hand is (0..1) as the punch
// goes (0..1); in a kick, how high the knee is and how far out the foot
const punchOut = (t) => (t < 0.38 ? Math.sin((t / 0.38) * Math.PI * 0.5) : t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.45));
const kickUp = (t) => (t < 0.28 ? t / 0.28 : t < 0.66 ? 1 : Math.max(0, 1 - (t - 0.66) / 0.34));
const kickOut = (t) => (t < 0.3 ? 0 : t < 0.48 ? (t - 0.3) / 0.18 : t < 0.62 ? 1 : Math.max(0, 1 - (t - 0.62) / 0.2));

// approximate volumes (m³) of each erasable part of a 1.85 m adult
const PART_VOL = { head: 0.0075, torso: 0.03, armL: 0.0055, armR: 0.0055, legL: 0.014, legR: 0.014 };
export const PARTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];
// hair styles drawn over a cap of hair
const CAPPED = new Set(['buzz', 'short', 'slick', 'cornrows', 'messy', 'long', 'bob', 'ponytail', 'bun', 'curly', 'spiky', 'pompadour', 'pigtails', 'spacebuns', 'braids', 'beehive']);

function ik(root, target, l1, l2, pole, out) {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const dz = target.z - root.z;
  const dl = Math.hypot(dx, dy, dz);
  let d = dl;
  const maxD = (l1 + l2) * 0.999;
  if (d > maxD) d = maxD;
  if (dl < 1e-4) {
    out.copy(root).addScaledVector(pole, l1);
    return out;
  }
  const ux = dx / dl;
  const uy = dy / dl;
  const uz = dz / dl;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const pd = pole.x * ux + pole.y * uy + pole.z * uz;
  let px = pole.x - ux * pd;
  let py = pole.y - uy * pd;
  let pz = pole.z - uz * pd;
  const pl = Math.hypot(px, py, pz) || 1;
  px /= pl;
  py /= pl;
  pz /= pl;
  out.set(root.x + ux * a + px * h, root.y + uy * a + py * h, root.z + uz * a + pz * h);
  return out;
}

// --- ray / shape intersections on the CPU (bullets, erasing)
function rayCapsule(ro, rd, pa, pb, ra) {
  const bax = pb.x - pa.x, bay = pb.y - pa.y, baz = pb.z - pa.z;
  const oax = ro.x - pa.x, oay = ro.y - pa.y, oaz = ro.z - pa.z;
  const baba = bax * bax + bay * bay + baz * baz;
  const bard = bax * rd.x + bay * rd.y + baz * rd.z;
  const baoa = bax * oax + bay * oay + baz * oaz;
  const rdoa = rd.x * oax + rd.y * oay + rd.z * oaz;
  const oaoa = oax * oax + oay * oay + oaz * oaz;
  const a = baba - bard * bard;
  const b = baba * rdoa - baoa * bard;
  const c = baba * oaoa - baoa * baoa - ra * ra * baba;
  const h = b * b - a * c;
  if (h >= 0 && a > 1e-9) {
    const t = (-b - Math.sqrt(h)) / a;
    const y = baoa + t * bard;
    if (y > 0 && y < baba) return t;
    const ocx = y <= 0 ? oax : ro.x - pb.x;
    const ocy = y <= 0 ? oay : ro.y - pb.y;
    const ocz = y <= 0 ? oaz : ro.z - pb.z;
    const b2 = rd.x * ocx + rd.y * ocy + rd.z * ocz;
    const c2 = ocx * ocx + ocy * ocy + ocz * ocz - ra * ra;
    const h2 = b2 * b2 - c2;
    if (h2 > 0) return -b2 - Math.sqrt(h2);
  }
  return -1;
}

function rayEllipsoid(ro, rd, s) {
  const lx2 = s.x.lengthSq();
  const ly2 = s.y.lengthSq();
  const lz2 = s.z.lengthSq();
  _a.copy(ro).sub(s.c);
  const ou = [_a.dot(s.x) / lx2, _a.dot(s.y) / ly2, _a.dot(s.z) / lz2];
  const du = [rd.dot(s.x) / lx2, rd.dot(s.y) / ly2, rd.dot(s.z) / lz2];
  const a = du[0] * du[0] + du[1] * du[1] + du[2] * du[2];
  const b = ou[0] * du[0] + ou[1] * du[1] + ou[2] * du[2];
  const c = ou[0] * ou[0] + ou[1] * ou[1] + ou[2] * ou[2] - 1;
  const h = b * b - a * c;
  if (h < 0) return [-1, -1];
  const sq = Math.sqrt(h);
  return [(-b - sq) / a, (-b + sq) / a];
}

function makeShape() {
  return { type: 0, c: new THREE.Vector3(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), part: 'torso', bone: '', col: [1, 1, 1, 1], fill: 0, clip: null, clipArr: [0, 0, 0, 0], bias: 0, solid: true };
}

export class Doodle {
  constructor(fr, look, o = {}) {
    this.fr = fr;
    this.look = look;
    this.owner = fr.bodies.allocOwner();
    this.seed = o.seed !== undefined ? o.seed : Math.random() * 100;
    this.scale = (o.scale || 1) * look.build.height;
    this.bulk = look.build.bulk * (o.bulk || 1);
    this.headScale = look.build.head;
    this.limbs = look.build.limbs;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.phase = Math.random() * 6;
    this.air = false;
    this.aim = 0;
    this.aimPitch = 0;
    this.aimYaw = 0; // aim offset from where the body faces (headless guys wave the gun around)
    this.melee = -1;
    this.sit = 0;
    this.crouch = 0; // kneeling behind cover
    this.climb = 0; // up a ladder (ROADMAP 5.1, game/climb.js): a foot up a rung, then the other
    this.climbPh = 0;
    this.sneak = 0; // walking bent low and quiet (ROADMAP 5.3)
    // a fist fight (ROADMAP 5.4, game/fists.js): a punch going out and back (0..1; the hand: 1 the
    // right, -1 the left), a kick (0..1), the guard up (0..1), a blow just taken (1, fading; the
    // side the head goes)
    this.punch = -1;
    this.punchSide = 1;
    this.kick = -1;
    this.guard = 0;
    this.recoil = 0;
    this.recoilSide = 0;
    // thrown by a car or a blast (ROADMAP 5.5, game/ragdoll.js): the ragdoll has the joints; just
    // up off the street, the pose eases out of how the body lay
    this.rag = null;
    this.unragT = 0;
    this.unragDur = 0;
    this.unragJ = null;
    this.dead = 0;
    this.crawl = 0;
    this.stagger = 0;
    this.armsUp = 0;
    this.flail = 0; // headless panic: arms waving
    this.dance = 0;
    this.drinkT = -1; // raising a glass to the mouth (0..1)
    this.reachR = null;
    this.reachL = null;
    this.hunch = 0; // old age: bent forward over the knees
    this.ride = 0; // on a bike (game/workers.js): on the saddle, feet on the pedals
    this.crank = 0; // the pedals' turn (radians)
    this.carry = null; // what the right hand holds (see carry.js): 'cane', 'coffee', 'umbrella'...
    this.carryL = null; // ...and the left
    this.carryT = 0; // clock for the held things (steam, strumming, sweeping)
    this.leashTo = null; // where a dog's leash ends
    this.lookAt = null; // world point the head turns toward
    this.visible = true;
    this.parts = { head: 1, torso: 1, armL: 1, armR: 1, legL: 1, legR: 1, pelvis: 1 };
    this.split = -1; // seconds since the waist was erased: the body falls apart
    this.splitDir = 1;
    this.erased = { head: 0, torso: 0, armL: 0, armR: 0, legL: 0, legR: 0 };
    this.holes = [];
    this.dissolve = 0; // 0..1: the whole drawing being rubbed out
    this.belly = 0; // drink inside (0..1), seen through the body
    this.bellyColor = [0.95, 0.72, 0.2];
    this.paintT = 0;
    this.paintColor = [1, 1, 1];
    this.color = look.pen.ink; // for code that colours the held weapon etc.
    this.j = {};
    for (const k of ['hip', 'neck', 'headC', 'shoulder', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR', 'kneeL', 'kneeR', 'footL', 'footR', 'hipL', 'hipR', 'toeL', 'toeR']) this.j[k] = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, 1);
    this.right = new THREE.Vector3(-1, 0, 0);
    this.aimDir = new THREE.Vector3(0, 0, 1);
    this.ax = new THREE.Vector3(0, 1, 0);
    this.bfwd = new THREE.Vector3(0, 0, 1);
    this.brgt = new THREE.Vector3(-1, 0, 0);
    this.hu = new THREE.Vector3(0, 1, 0);
    this.hf = new THREE.Vector3(0, 0, 1);
    this.hr = new THREE.Vector3(-1, 0, 0);
    this.pool = [];
    this.shapes = [];
    this.shapesDirty = false;
    this.bones = {};
    this.center = new THREE.Vector3();
  }

  dispose() {
    this.fr.bodies.releaseOwner(this.owner);
    this.owner = -1;
  }

  setVisible(v) {
    this.visible = v;
  }

  toWorld(x, y, z, out) {
    const s = this.scale;
    out.set(this.pos.x + (this.right.x * x + this.forward.x * z) * s, this.pos.y + y * s, this.pos.z + (this.right.z * x + this.forward.z * z) * s);
    return out;
  }

  paint(color) {
    this.paintT = 2.5;
    this.paintColor = color;
  }

  // ------------------------------------------------------------------ pose
  update(dt) {
    if (this.paintT > 0) this.paintT -= dt;
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 4);
    this.carryT += dt;
    if (this.rag) {
      this.rag.pose(dt);
      return;
    }
    const f = this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.right.set(-f.z, 0, f.x);
    const sp = this.speed;
    const stride = sp > 5.5 ? 2.3 : 1.5;
    this.phase += (sp * dt * Math.PI * 2) / stride + this.dance * dt * 7;
    const A = clamp(sp / 7.5, 0, 1);
    const ph = this.phase;
    const j = this.j;
    const sit = this.sit;
    const crawl = this.crawl;
    const crouch = this.crouch * (1 - crawl);
    const fem = this.look.fem;
    const bulk = this.bulk;
    const sw = (fem ? 0.15 : 0.17) * Math.max(0.9, bulk * 0.96);
    const hw = (fem ? 0.095 : 0.085) * bulk;
    const legGone = (this.parts.legL < 0.5 ? 1 : 0) + (this.parts.legR < 0.5 ? 1 : 0);

    let hipY = 0.93 - Math.abs(Math.sin(ph)) * 0.05 * A + Math.sin(ph * 2) * 0.01;
    hipY += this.dance * Math.abs(Math.sin(ph)) * 0.05;
    hipY = lerp(hipY, 0.5, sit);
    hipY = lerp(hipY, 0.25, crawl);
    hipY = lerp(hipY, 0.56, crouch);
    hipY -= this.hunch * 0.05;
    let lean = A * 0.12 + (this.aim ? 0.04 : 0) + crawl * 1.2 + sit * 0.05 + crouch * 0.22 + this.hunch * 0.42;
    if (this.sneak > 0) {
      hipY = lerp(hipY, 0.66, this.sneak);
      lean += this.sneak * 0.38;
    }
    if (this.ride > 0) {
      hipY = lerp(hipY, RIDE.hip, this.ride);
      lean += this.ride * 0.3;
    }
    // (a fist fight) into the punch, the shoulders turning with it; back off the kick; the head
    // snapped back by a blow
    let twist = 0;
    if (this.punch >= 0) {
      const out = punchOut(this.punch);
      lean += out * 0.14;
      twist = out * this.punchSide * 0.1;
    } else if (this.kick >= 0) lean -= kickUp(this.kick) * 0.22;
    let leanSide = this.stagger * Math.sin(ph * 1.3) * 0.15 + this.dance * Math.sin(ph * 0.5) * 0.12;
    if (this.recoil > 0) {
      lean -= this.recoil * this.recoil * 0.42;
      leanSide += this.recoil * this.recoilSide * 0.12;
    }
    this.toWorld(this.dance * Math.sin(ph * 0.5) * 0.05, hipY, 0, j.hip);
    const spine = 0.5;
    const nx = leanSide;
    const ny = hipY + spine * Math.cos(lean);
    const nz = spine * Math.sin(lean);
    this.toWorld(nx, ny, nz, j.neck);
    const hOff = 0.1 + 0.12 * this.headScale;
    this.toWorld(nx * 1.2, ny + hOff * Math.cos(lean), nz + hOff * Math.sin(lean), j.headC);
    this.toWorld(nx + sw, ny - 0.07, nz + twist, j.shoulderR);
    this.toWorld(nx - sw, ny - 0.07, nz - twist, j.shoulderL);
    j.shoulder.copy(j.shoulderR);
    this.toWorld(hw, hipY, 0, j.hipR);
    this.toWorld(-hw, hipY, 0, j.hipL);

    // legs
    const legL = 0.47 * (this.look.build.legs || 1);
    // (the joints never change: the lists are made once)
    const legs = this._legs || (this._legs = [[j.kneeR, j.footR, j.toeR, 0], [j.kneeL, j.footL, j.toeL, Math.PI]]);
    for (let li = 0; li < 2; li++) {
      const knee = legs[li][0];
      const foot = legs[li][1];
      const toe = legs[li][2];
      const off = legs[li][3];
      const side = off === 0 ? 1 : -1;
      let th = Math.sin(ph + off) * (0.18 + 0.62 * A);
      let kb = Math.max(0, Math.sin(ph + off - Math.PI * 0.5)) * (0.25 + 0.9 * A) + 0.05;
      if (this.dance > 0) {
        th = lerp(th, Math.sin(ph + off) * 0.25, this.dance);
        kb = lerp(kb, 0.25 + Math.max(0, Math.sin(ph + off)) * 0.5, this.dance);
      }
      if (this.air) {
        th = off === 0 ? 0.55 : -0.25;
        kb = off === 0 ? 1.1 : 0.4;
      }
      if (sit > 0) {
        th = lerp(th, 1.45, sit);
        kb = lerp(kb, 1.5, sit);
      }
      if (crawl > 0) {
        th = lerp(th, -0.2 + Math.sin(ph + off) * 0.3, crawl);
        kb = lerp(kb, 0.3, crawl);
      }
      if (crouch > 0) {
        // right knee down, left foot planted forward
        th = lerp(th, off === 0 ? 0.35 : 1.05, crouch);
        kb = lerp(kb, off === 0 ? 1.95 : 1.55, crouch);
      }
      if (this.sneak > 0) {
        // bent low: short steps on bent knees
        th = lerp(th, 0.42 + Math.sin(ph + off) * 0.38, this.sneak);
        kb = lerp(kb, 1.22 + Math.max(0, Math.sin(ph + off - Math.PI * 0.5)) * 0.45, this.sneak);
      }
      if (this.climb > 0) {
        // up a ladder: one foot up on a rung, the other on the one below, the knees to the wall
        const up = Math.max(0, Math.sin(this.climbPh + off));
        th = lerp(th, 0.35 + up * 0.75, this.climb);
        kb = lerp(kb, 0.45 + up * 1.15, this.climb);
      }
      if (this.kick >= 0) {
        // the kick: the right knee up, the foot snapped out and back; the left leg braced under
        const up = kickUp(this.kick);
        if (off === 0) {
          th = lerp(th, 1.42, up);
          kb = lerp(kb, lerp(1.85, 0.15, kickOut(this.kick)), up);
        } else {
          th = lerp(th, -0.12, up);
          kb = lerp(kb, 0.28, up);
        }
      }
      const sx = side * hw * (1 + sit * 0.4);
      const ky = hipY - Math.cos(th) * legL;
      const kz = Math.sin(th) * legL;
      this.toWorld(sx, ky, kz, knee);
      const sh = th - kb;
      let fy = ky - Math.cos(sh) * legL;
      const fz = kz + Math.sin(sh) * legL;
      fy = Math.max(fy, 0.04);
      this.toWorld(sx, fy, fz, foot);
      this.toWorld(sx, Math.max(0.03, fy - 0.01), fz + 0.13, toe);
    }
    if (this.ride > 0) this.pedal(hw, legL);

    // arms
    const armU = 0.31 * (this.look.build.arms || 1);
    const armF = 0.29 * (this.look.build.arms || 1);
    const swing = (0.15 + 0.7 * A) * (1 - sit);
    const arms = this._arms || (this._arms = [[j.shoulderR, j.elbowR, j.handR, 1, 0], [j.shoulderL, j.elbowL, j.handL, -1, Math.PI]]);
    const aimP = this.aimPitch;
    const ay = this.yaw + this.aimYaw;
    this.aimDir.set(Math.sin(ay) * Math.cos(aimP), Math.sin(aimP), Math.cos(ay) * Math.cos(aimP));
    for (let ai = 0; ai < 2; ai++) {
      const shoulder = arms[ai][0];
      const elbow = arms[ai][1];
      const hand = arms[ai][2];
      const side = arms[ai][3];
      const off = arms[ai][4];
      const tgt = _a;
      let useIK = false;
      const reach = side === 1 ? this.reachR : this.reachL;
      const held = heldIn(this, side);
      if (this.surrender > 0) {
        // (hands up: given up to the police, ROADMAP 6.3)
        this.toWorld(side * 0.32, ny + 0.48, nz + 0.12, tgt);
        useIK = true;
      } else if (reach) {
        const d = _w.copy(reach).sub(shoulder);
        const L = (armU + armF) * this.scale * 0.97;
        if (d.length() > L) d.setLength(L);
        tgt.copy(shoulder).add(d);
        useIK = true;
      } else if (this.drinkT >= 0 && side === 1) {
        // glass up to the mouth and back
        const k = Math.sin(clamp(this.drinkT, 0, 1) * Math.PI);
        this.toWorld(nx + 0.08, lerp(ny - 0.25, ny + hOff - 0.06, k), nz + lerp(0.3, 0.14, k), tgt);
        useIK = true;
      } else if (this.flail > 0) {
        const a = ph * 2.2 + off;
        this.toWorld(side * (0.3 + Math.sin(a) * 0.15), ny + 0.1 + Math.cos(a * 1.3) * 0.35, nz + 0.2 + Math.sin(a * 0.7) * 0.2, tgt);
        useIK = true;
      } else if (this.aim && (side === 1 || this.aim === 2)) {
        const reach = side === 1 ? 0.55 : 0.42;
        tgt.copy(j.neck).addScaledVector(this.aimDir, reach * this.scale).addScaledVector(this.right, (side === 1 ? 0.08 : 0.03) * this.scale);
        tgt.y -= 0.12 * this.scale;
        useIK = true;
      } else if (this.punch >= 0 && side === this.punchSide) {
        // the punch: straight out from the shoulder at the height of a face, and back to the guard
        const out = punchOut(this.punch);
        this.toWorld(nx + side * lerp(0.13, 0.04, out), ny + lerp(-0.03, 0.1, out), nz + lerp(0.25, 0.68, out), tgt);
        useIK = true;
      } else if (this.guard > 0.01 || this.punch >= 0 || this.kick >= 0) {
        // the guard: both fists up by the chin (the other hand while one punches, both in a kick);
        // a loose guard lower down
        const g = this.punch >= 0 || this.kick >= 0 ? 1 : this.guard;
        this.toWorld(nx + side * lerp(sw + 0.03, 0.13, g), lerp(ny - 0.62, ny - 0.03, g), lerp(nz + 0.08, nz + 0.25, g), tgt);
        useIK = true;
      } else if (this.melee >= 0 && side === 1) {
        const t = this.melee;
        const a = lerp(-2.2, 1.0, Math.min(1, t * 1.6));
        this.toWorld(nx + 0.08 + Math.sin(a) * 0.2, ny + 0.05 - Math.min(1, t) * 0.25, nz + Math.cos(a) * 0.62, tgt);
        useIK = true;
      } else if (this.dance > 0) {
        const a = ph + off;
        this.toWorld(side * (0.3 + Math.sin(a) * 0.1), ny + 0.15 + Math.sin(a * 2) * 0.3 * this.dance, nz + 0.15, tgt);
        useIK = true;
      } else if (held && carryPose(this, held, side, hipY, ny, nz, tgt)) {
        useIK = true;
      } else if (sit > 0.5) {
        this.toWorld(side * 0.16, hipY + 0.32, 0.36, tgt);
        useIK = true;
      } else if (crawl > 0.5) {
        const r = Math.sin(ph + off) * 0.3;
        this.toWorld(side * 0.25, 0.05, nz + 0.35 + r, tgt);
        useIK = true;
      } else if (this.armsUp > 0) {
        this.toWorld(side * 0.34, ny + 0.45, nz + 0.25, tgt);
        useIK = true;
      }
      if (useIK) {
        const pole = _d.set(this.right.x * side * 0.6, -1, this.right.z * side * 0.6);
        ik(shoulder, tgt, armU * this.scale, armF * this.scale, pole, elbow);
        hand.copy(tgt);
        const reachMax = (armU + armF) * this.scale * 0.999;
        if (hand.distanceTo(shoulder) > reachMax) hand.sub(shoulder).setLength(reachMax).add(shoulder);
      } else {
        const a = -Math.sin(ph + off) * swing;
        const out = 0.06 + (this.stagger ? 0.25 : 0);
        const sxl = side * (sw + out * 0.3);
        const ey = ny - 0.07 - Math.cos(a) * armU;
        const ez = nz + Math.sin(a) * armU;
        this.toWorld(nx + sxl, ey, ez, elbow);
        const b = a + 0.35 + A * 0.5;
        this.toWorld(nx + sxl + side * 0.02, ey - Math.cos(b) * armF, ez + Math.sin(b) * armF, hand);
      }
    }

    if (legGone && !crawl && !sit) {
      // missing a leg: sag to that side
      for (const k in j) j[k].y -= 0.02 * legGone;
    }

    if (this.split >= 0) {
      // the upper body topples off and drops, the legs walk on a moment and then fold
      const k = clamp(this.split * 2.2, 0, 1);
      const ang = k * k * Math.PI * 0.5 * this.splitDir;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const pv = _p.copy(j.hip);
      const drop = Math.max(0, j.hip.y - this.pos.y - 0.14) * k * k;
      for (const key of UPPER) {
        const p = j[key];
        const ry = p.y - pv.y;
        const along = (p.x - pv.x) * f.x + (p.z - pv.z) * f.z;
        const ny2 = ry * c - along * s;
        const al2 = ry * s + along * c;
        p.x += f.x * (al2 - along);
        p.z += f.z * (al2 - along);
        p.y = Math.max(this.pos.y + 0.06, pv.y + ny2 - drop);
      }
      const kl = clamp((this.split - 1.0) * 2.0, 0, 1);
      if (kl > 0) {
        const angL = kl * Math.PI * 0.48;
        const cl = Math.cos(angL);
        const sl = Math.sin(angL);
        for (const key of LOWER) {
          const p = j[key];
          const ry = p.y - this.pos.y;
          const along = (p.x - this.pos.x) * f.x + (p.z - this.pos.z) * f.z;
          const ny2 = ry * cl - along * sl;
          const al2 = ry * sl + along * cl;
          p.x += f.x * (al2 - along);
          p.z += f.z * (al2 - along);
          p.y = this.pos.y + Math.max(0.06, ny2);
        }
      }
    }

    if (this.dead > 0) {
      const pivot = this.pos;
      const ang = this.dead * Math.PI * 0.48;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      for (const k in j) {
        const p = j[k];
        const rx = p.x - pivot.x;
        const ry = p.y - pivot.y;
        const rz = p.z - pivot.z;
        const along = rx * f.x + rz * f.z;
        const ny2 = ry * c + along * s;
        const al2 = -ry * s + along * c;
        const perpX = rx - along * f.x;
        const perpZ = rz - along * f.z;
        p.set(pivot.x + perpX + f.x * al2, pivot.y + Math.max(0.06, ny2), pivot.z + perpZ + f.z * al2);
      }
    }
    if (this.unragT > 0) {
      this.unragT = Math.max(0, this.unragT - dt);
      const k = 1 - this.unragT / this.unragDur;
      const e = k * k * (3 - 2 * k);
      const from = this.unragJ;
      for (const key in j) j[key].lerpVectors(from[key], j[key], e);
    }
    // the body's shapes (for drawing it and for what hits it) are made when they are next needed:
    // nobody asks for those of somebody out of sight
    this.center.lerpVectors(j.hip, j.neck, 0.5);
    this.shapesDirty = true;
  }

  // let go of a ragdoll: the next moments of the pose start from where the joints are now
  unrag(dur) {
    const from = this.unragJ || (this.unragJ = {});
    for (const key in this.j) (from[key] || (from[key] = new THREE.Vector3())).copy(this.j[key]);
    this.unragDur = dur;
    this.unragT = dur;
  }

  ensureShapes() {
    if (!this.shapesDirty) return;
    this.shapesDirty = false;
    this.buildShapes();
  }

  // on a bike: each foot on its pedal going round the crank, the knee where the leg bends to it
  pedal(hw, legL) {
    const j = this.j;
    const L = legL * this.scale;
    const pole = _q.copy(this.forward).multiplyScalar(0.8).add(UP);
    for (let li = 0; li < 2; li++) {
      const side = li === 0 ? 1 : -1;
      const a = this.crank + (li === 0 ? 0 : Math.PI);
      const hip = li === 0 ? j.hipR : j.hipL;
      const knee = li === 0 ? j.kneeR : j.kneeL;
      const foot = li === 0 ? j.footR : j.footL;
      const toe = li === 0 ? j.toeR : j.toeL;
      const sx = side * (hw + 0.03);
      const py = RIDE.crankY - Math.cos(a) * RIDE.crank;
      const pz = RIDE.crankZ - Math.sin(a) * RIDE.crank;
      // (blended from wherever the walk put the foot, as they get on and off)
      this.toWorld(sx, py, pz, _e);
      foot.lerp(_e, this.ride);
      ik(hip, foot, L, L, pole, _p);
      knee.lerp(_p, this.ride);
      this.toWorld(sx, py - 0.01, pz + 0.12, _e);
      toe.lerp(_e, this.ride);
    }
  }

  // ------------------------------------------------------------------ body shapes
  shape(type, part, bone) {
    let s = this.pool[this.shapes.length];
    if (!s) {
      s = makeShape();
      this.pool.push(s);
    }
    s.type = type;
    s.part = part;
    s.bone = bone;
    s.clip = null;
    s.bias = 0;
    s.solid = true;
    s.fill = this.look.pen.fill;
    s.dress = this.dressing;
    s.gloss = false;
    this.shapes.push(s);
    return s;
  }

  capsule(part, bone, a, b, r, col) {
    const s = this.shape(0, part, bone);
    s.c.addVectors(a, b).multiplyScalar(0.5);
    s.y.subVectors(b, a).multiplyScalar(0.5);
    s.x.set(r, 0, 0);
    s.z.set(0, 0, 0);
    s.col = col;
    return s;
  }

  ellipsoid(part, bone, c, xa, ya, za, rx, ry, rz, col) {
    const s = this.shape(1, part, bone);
    s.c.copy(c);
    s.x.copy(xa).multiplyScalar(rx);
    s.y.copy(ya).multiplyScalar(ry);
    s.z.copy(za).multiplyScalar(rz);
    s.col = col;
    return s;
  }

  // keep only the side of the plane opposite to n (discard where dot(p, n) > dot(at, n) + off)
  clip(s, n, at, off = 0) {
    s.clip = s.clipArr;
    s.clipArr[0] = n.x;
    s.clipArr[1] = n.y;
    s.clipArr[2] = n.z;
    s.clipArr[3] = at.dot(n) + off;
    return s;
  }

  buildShapes() {
    this.shapes.length = 0;
    const L = this.look;
    const j = this.j;
    const P = this.parts;
    const bulk = this.bulk;
    const hs = this.headScale * this.scale;
    const lim = this.limbs * this.scale;
    const S = this.scale;
    // body frame from the joints (works for falls and crawls too)
    const ax = this.ax.subVectors(j.neck, j.hip);
    if (ax.lengthSq() < 1e-6) ax.set(0, 1, 0);
    ax.normalize();
    const rgt = this.brgt.subVectors(j.shoulderR, j.shoulderL);
    rgt.addScaledVector(ax, -rgt.dot(ax));
    if (rgt.lengthSq() < 1e-6) rgt.copy(this.right);
    rgt.normalize();
    const fwd = this.bfwd.crossVectors(ax, rgt).normalize();
    // head frame: up from the neck, facing the body (or a look target)
    const hu = this.hu.subVectors(j.headC, j.neck);
    if (hu.lengthSq() < 1e-6) hu.copy(ax);
    hu.normalize();
    const hf = this.hf.copy(fwd);
    if (this.lookAt && this.dead < 0.2) {
      _a.subVectors(this.lookAt, j.headC);
      _a.y = 0;
      if (_a.lengthSq() > 0.01) {
        _a.normalize();
        if (_a.dot(fwd) > -0.2) hf.lerp(_a, 0.7);
      }
    }
    hf.addScaledVector(hu, -hf.dot(hu)).normalize();
    const hr = this.hr.crossVectors(hf, hu).normalize().negate();
    // colours
    const skin = L.skin;
    const top = L.top;
    const bot = L.bottom;
    let topC = top.color;
    if (this.paintT > 0) topC = topC.map((v, i) => lerp(v, this.paintColor[i], 0.7));
    const sleeves = top.sleeves;
    // (the armour vest over a shirt: the sleeves are the shirt's, ROADMAP 5.7)
    const sleeveC = top.armor && top.under ? top.under : topC;
    const upperArmC = sleeves === 'none' ? skin : sleeveC;
    const foreArmC = sleeves === 'long' ? sleeveC : skin;
    // skirts and dresses reach the ankle: the legs under them are the fabric
    const longSkirt = bot.kind === 'skirt' || bot.kind === 'dress' || bot.kind === 'midi';
    const pantsC = bot.color;
    const shinC = bot.kind === 'shorts' ? skin : bot.color;
    const legR = bot.kind === 'baggy' ? 1.2 : 1;

    // pelvis (stays with the legs if the waist gets erased)
    if (P.pelvis > 0.5) {
      _a.copy(j.hip).addScaledVector(ax, 0.02);
      this.ellipsoid('pelvis', 'pelvis', _a, rgt, ax, fwd, 0.155 * bulk * (L.fem ? 1.08 : 1) * S, 0.11 * S, 0.105 * bulk * S, longSkirt ? bot.color : pantsC);
    }
    // torso
    if (P.torso > 0.5) {
      // one shape from the waist to the shoulders reads as a single drawn torso
      _a.lerpVectors(j.hip, j.neck, 0.58);
      const swc = (L.fem ? 0.15 : 0.17) * Math.max(0.9, bulk * 0.96);
      const tight = top.kind === 'dress' || top.kind === 'tank';
      this.ellipsoid('torso', 'chest', _a, rgt, ax, fwd, swc * 1.04 * (tight ? 0.95 : 1) * S, 0.27 * S, (L.fem ? 0.13 : 0.122) * bulk * S, topC);
      // neck
      _b.copy(j.headC).addScaledVector(hu, -0.07 * hs);
      this.capsule('torso', 'neck', j.neck, _b, 0.045 * S * Math.max(1, bulk * 0.9), skin);
      // clothing details with volume
      if (top.kind === 'suit' || top.kind === 'blazer' || top.kind === 'jacket') {
        _a.lerpVectors(j.hip, j.neck, 0.62).addScaledVector(fwd, 0.09 * bulk * S);
        this.ellipsoid('torso', 'chest', _a, rgt, ax, fwd, 0.045 * S, 0.17 * S, 0.04 * S, top.shirt || top.inner || SHIRT_WHITE);
      }
      if (top.kind === 'vest' && top.under) {
        // sleeve stubs of the shirt under the vest
        for (const sh of [j.shoulderL, j.shoulderR]) this.ellipsoid('torso', 'chest', sh, rgt, ax, fwd, 0.06 * S, 0.06 * S, 0.06 * S, top.under);
      }
      if (longSkirt) {
        // a long skirt: fitted at the hips, flaring out down to the ankles (sitting, it drapes
        // over the knees)
        _a.copy(j.hip).addScaledVector(ax, -0.24 * S);
        const sk = this.ellipsoid('pelvis', 'pelvis', _a, rgt, ax, fwd, 0.2 * bulk * S, 0.3 * S, 0.19 * bulk * S, bot.color);
        this.clip(sk, ax, j.hip, 0.04 * S);
        if (this.sit > 0.3) {
          _a.lerpVectors(j.kneeL, j.kneeR, 0.5);
          _b.lerpVectors(j.footL, j.footR, 0.5);
          _c.lerpVectors(_a, _b, 0.5);
          _d.subVectors(_a, _b).normalize();
          this.ellipsoid('pelvis', 'pelvis', _c, rgt, _d, _e.crossVectors(rgt, _d).normalize(), 0.22 * bulk * S, Math.max(0.2 * S, _a.distanceTo(_b) * 0.55), 0.2 * bulk * S, bot.color);
        } else {
          _a.copy(j.hip).addScaledVector(ax, -0.6 * S);
          this.ellipsoid('pelvis', 'pelvis', _a, rgt, ax, fwd, 0.235 * bulk * S, 0.31 * S, 0.215 * bulk * S, bot.color);
        }
      }
      if (this.belly > 0.02) {
        // the drink inside, seen through the drawing
        const lv = clamp(this.belly, 0, 1);
        _a.lerpVectors(j.hip, j.neck, 0.36).addScaledVector(ax, -0.05 * (1 - lv) * S).addScaledVector(fwd, 0.02 * S);
        const dr = this.ellipsoid('torso', 'chest', _a, rgt, ax, fwd, 0.08 * S, (0.03 + 0.06 * lv) * S, 0.065 * S, this.bellyColor);
        dr.fill = FILL.FLAT;
        dr.bias = 0.16 * bulk * S;
        dr.solid = false;
      }
    }
    // arms (the joints never change: their lists are made once)
    const armSide = this._armS || (this._armS = [[j.shoulderR, j.elbowR, j.handR], [j.shoulderL, j.elbowL, j.handL]]);
    for (let ai = 0; ai < 2; ai++) {
      const B = ARM_BONES[ai];
      const part = B[0];
      if (P[part] < 0.5) continue;
      const sh = armSide[ai][0];
      const el = armSide[ai][1];
      const hd = armSide[ai][2];
      this.capsule(part, B[1], sh, el, 0.05 * lim * Math.max(1, bulk * 0.85), upperArmC);
      this.capsule(part, B[2], el, hd, 0.042 * lim * Math.max(1, bulk * 0.8), foreArmC);
      _a.subVectors(hd, el).normalize();
      _b.copy(hd).addScaledVector(_a, 0.025 * S);
      this.ellipsoid(part, B[3], _b, rgt, ax, fwd, 0.042 * S, 0.046 * S, 0.042 * S, skin);
    }
    // legs
    const legSide = this._legS || (this._legS = [[j.hipR, j.kneeR, j.footR, j.toeR], [j.hipL, j.kneeL, j.footL, j.toeL]]);
    for (let li = 0; li < 2; li++) {
      const B = LEG_BONES[li];
      const part = B[0];
      if (P[part] < 0.5) continue;
      const hp = legSide[li][0];
      const kn = legSide[li][1];
      const ft = legSide[li][2];
      const to = legSide[li][3];
      this.capsule(part, B[1], hp, kn, 0.072 * lim * legR * Math.max(1, bulk * 0.9), pantsC);
      this.capsule(part, B[2], kn, ft, 0.056 * lim * legR * Math.max(1, bulk * 0.85), shinC);
      // shoe: points where the foot points
      _a.subVectors(to, ft);
      if (_a.lengthSq() < 1e-6) _a.copy(fwd);
      _a.normalize();
      _b.crossVectors(_a, UP);
      if (_b.lengthSq() < 1e-6) _b.copy(rgt);
      _b.normalize();
      _c.crossVectors(_b, _a).normalize();
      _d.copy(ft).addScaledVector(_a, 0.055 * S).addScaledVector(_c, 0.0);
      this.ellipsoid(part, B[3], _d, _b, _c, _a, 0.056 * S, 0.046 * S, 0.12 * S, L.shoes);
    }
    // head, hair, hats
    if (P.head > 0.5) {
      const rx = 0.11 * hs;
      const ry = 0.125 * hs;
      const rz = 0.115 * hs;
      const hc = j.headC;
      this.ellipsoid('head', 'head', hc, hr, hu, hf, rx, ry, rz, skin);
      this.dressing = true;
      this.dressHead(hc, hr, hu, hf, rx, ry, rz, hs);
      this.dressing = false;
    }
    this.dressing = true;
    if (P.torso > 0.5) this.dressTorso(ax, rgt, fwd, S);
    this.dressing = false;
    // the centre used by explosions / aim helpers
    this.center.lerpVectors(j.hip, j.neck, 0.5);
    this.updateBones();
  }

  dressHead(hc, hr, hu, hf, rx, ry, rz, hs) {
    const L = this.look;
    const hair = L.hair;
    const hat = L.hat;
    const hcol = hair.color;
    const S = this.scale;
    // (front: cut the shape at a plane in front of the head; below: under it - see clip)
    // hair
    const st = hair.style;
    const hair0 = this.shapes.length;
    if (CAPPED.has(st)) {
      const g = st === 'buzz' || st === 'cornrows' || st === 'spiky' ? 1.03 : st === 'curly' ? 1.14 : 1.08;
      _a.copy(hc).addScaledVector(hu, 0.012 * hs).addScaledVector(hf, -0.01 * hs);
      const cap = this.ellipsoid('head', 'head', _a, hr, hu, hf, rx * g, ry * g, rz * g, hcol);
      this.clip(cap, _q.copy(hu).negate(), hc, -(st === 'long' || st === 'bob' ? 0.0 : 0.03) * hs);
    }
    if (st === 'long' || st === 'bob') {
      const len = st === 'long' ? 0.2 : 0.12;
      _a.copy(hc).addScaledVector(hf, -0.06 * hs).addScaledVector(hu, -len * 0.55 * hs);
      const back = this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.125 * hs, len * hs, 0.08 * hs, hcol);
      this.clip(back, hf, hc, (0.02) * hs);
    } else if (st === 'ponytail') {
      _a.copy(hc).addScaledVector(hf, -0.1 * hs).addScaledVector(hu, 0.06 * hs);
      _b.copy(hc).addScaledVector(hf, -0.19 * hs).addScaledVector(hu, -0.12 * hs);
      this.capsule('head', 'head', _a, _b, 0.035 * hs, hcol);
    } else if (st === 'bun') {
      _a.copy(hc).addScaledVector(hf, -0.08 * hs).addScaledVector(hu, 0.12 * hs);
      this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.06 * hs, 0.055 * hs, 0.06 * hs, hcol);
    } else if (st === 'afro') {
      _a.copy(hc).addScaledVector(hu, 0.05 * hs).addScaledVector(hf, -0.02 * hs);
      const af = this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.19 * hs, 0.175 * hs, 0.19 * hs, hcol);
      this.clip(af, hf, hc, (0.035) * hs);
    } else if (st === 'mohawk') {
      // shaved sides, one proud crest from the forehead to the neck
      _a.copy(hc).addScaledVector(hu, 0.085 * hs).addScaledVector(hf, -0.01 * hs);
      const m = this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.03 * hs, 0.11 * hs, 0.14 * hs, hcol);
      this.clip(m, _q.copy(hu).negate(), hc, -(0.02) * hs);
    } else if (st === 'spiky') {
      // pointed tufts: long thin ellipsoids standing out of the head
      for (let i = 0; i < 7; i++) {
        const a = (i / 6 - 0.5) * 2.2;
        _c.copy(hu).multiplyScalar(Math.cos(a * 0.6)).addScaledVector(hr, Math.sin(a) * 0.55).addScaledVector(hf, i % 2 ? -0.35 : 0.15).normalize();
        _a.copy(hc).addScaledVector(_c, 0.15 * hs);
        _b.crossVectors(_c, hf).normalize();
        _d.crossVectors(_b, _c).normalize();
        this.ellipsoid('head', 'head', _a, _b, _c, _d, 0.03 * hs, 0.085 * hs, 0.03 * hs, hcol);
      }
    } else if (st === 'pompadour') {
      _a.copy(hc).addScaledVector(hu, 0.105 * hs).addScaledVector(hf, 0.06 * hs);
      this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.105 * hs, 0.075 * hs, 0.095 * hs, hcol);
    } else if (st === 'pigtails') {
      for (const sd of [-1, 1]) {
        _a.copy(hc).addScaledVector(hr, sd * 0.155 * hs).addScaledVector(hu, -0.02 * hs).addScaledVector(hf, -0.03 * hs);
        this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.05 * hs, 0.09 * hs, 0.05 * hs, hcol);
      }
    } else if (st === 'spacebuns') {
      for (const sd of [-1, 1]) {
        _a.copy(hc).addScaledVector(hr, sd * 0.078 * hs).addScaledVector(hu, 0.125 * hs).addScaledVector(hf, -0.01 * hs);
        this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.056 * hs, 0.052 * hs, 0.056 * hs, hcol);
      }
    } else if (st === 'braids') {
      for (const sd of [-1, 1]) {
        _a.copy(hc).addScaledVector(hr, sd * 0.1 * hs).addScaledVector(hu, -0.03 * hs).addScaledVector(hf, -0.04 * hs);
        _b.copy(hc).addScaledVector(hr, sd * 0.12 * hs).addScaledVector(hu, -0.3 * hs).addScaledVector(hf, 0.03 * hs);
        this.capsule('head', 'head', _a, _b, 0.03 * hs, hcol);
      }
    } else if (st === 'beehive') {
      _a.copy(hc).addScaledVector(hu, 0.16 * hs).addScaledVector(hf, -0.01 * hs);
      this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.1 * hs, 0.15 * hs, 0.1 * hs, hcol);
    }
    // the hero is a blank paper doodle, but a haircut from the barber comes in colour
    if (L.hero) for (let i = hair0; i < this.shapes.length; i++) this.shapes[i].fill = FILL.MARKER;
    // hats
    if (hat) {
      const k = hat.kind;
      if (k === 'cap' || k === 'capBack' || k === 'beanie' || k === 'hardhat' || k === 'bandanaHead') {
        const g = k === 'hardhat' ? 1.16 : k === 'bandanaHead' ? 1.04 : 1.09;
        _a.copy(hc).addScaledVector(hu, 0.01 * hs);
        const dome = this.ellipsoid('head', 'head', _a, hr, hu, hf, rx * g, ry * g, rz * g, hat.color);
        this.clip(dome, _q.copy(hu).negate(), hc, -(k === 'beanie' ? 0.0 : 0.035) * hs);
        if (k === 'cap' || k === 'capBack') {
          const dir = k === 'cap' ? 1 : -1;
          _a.copy(hc).addScaledVector(hu, 0.04 * hs).addScaledVector(hf, 0.12 * dir * hs);
          this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.095 * hs, 0.012 * hs, 0.085 * hs, hat.color);
        } else if (k === 'beanie') {
          _a.copy(hc).addScaledVector(hu, 0.015 * hs);
          this.ellipsoid('head', 'head', _a, hr, hu, hf, rx * 1.14, 0.03 * hs, rz * 1.14, hat.color);
        } else if (k === 'hardhat') {
          _a.copy(hc).addScaledVector(hu, 0.04 * hs);
          this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.15 * hs, 0.012 * hs, 0.16 * hs, hat.color);
        }
      } else if (k === 'fedora') {
        _a.copy(hc).addScaledVector(hu, 0.11 * hs);
        this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.1 * hs, 0.085 * hs, 0.11 * hs, hat.color);
        _a.copy(hc).addScaledVector(hu, 0.06 * hs);
        this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.2 * hs, 0.014 * hs, 0.2 * hs, hat.color);
      } else if (k === 'police') {
        _a.copy(hc).addScaledVector(hu, 0.125 * hs);
        this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.13 * hs, 0.05 * hs, 0.14 * hs, hat.color);
        _a.copy(hc).addScaledVector(hu, 0.075 * hs);
        this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.118 * hs, 0.04 * hs, 0.125 * hs, COL_08_08_1);
        _a.copy(hc).addScaledVector(hu, 0.055 * hs).addScaledVector(hf, 0.11 * hs);
        this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.085 * hs, 0.01 * hs, 0.06 * hs, COL_06_06_08);
      } else if (k === 'toque') {
        // a chef's tall white hat
        _a.copy(hc).addScaledVector(hu, 0.07 * hs);
        this.ellipsoid('head', 'head', _a, hr, hu, hf, rx * 1.1, 0.045 * hs, rz * 1.1, hat.color);
        _a.copy(hc).addScaledVector(hu, 0.2 * hs);
        this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.125 * hs, 0.13 * hs, 0.125 * hs, hat.color);
      } else if (k === 'bucket') {
        // a bucket hat: a soft crown and a brim sloping down all round
        _a.copy(hc).addScaledVector(hu, 0.06 * hs);
        const crown = this.ellipsoid('head', 'head', _a, hr, hu, hf, rx * 1.1, ry * 0.75, rz * 1.1, hat.color);
        this.clip(crown, _q.copy(hu).negate(), hc, -(-0.02) * hs);
        _a.copy(hc).addScaledVector(hu, 0.035 * hs);
        this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.17 * hs, 0.022 * hs, 0.17 * hs, hat.color);
      } else if (k === 'beret') {
        _a.copy(hc).addScaledVector(hu, 0.1 * hs).addScaledVector(hr, 0.03 * hs);
        this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.135 * hs, 0.042 * hs, 0.13 * hs, hat.color);
      } else if (k === 'skimask') {
        this.ellipsoid('head', 'head', hc, hr, hu, hf, rx * 1.04, ry * 1.04, rz * 1.04, hat.color);
      } else if (k === 'helmet') {
        // riot helmet: a big dome and a smoky visor over the eyes
        _a.copy(hc).addScaledVector(hu, 0.03 * hs);
        const dome = this.ellipsoid('head', 'head', _a, hr, hu, hf, rx * 1.22, ry * 1.18, rz * 1.22, hat.color);
        this.clip(dome, _q.copy(hu).negate(), hc, -(-0.01) * hs);
        _a.copy(hc).addScaledVector(hf, rz * 0.55).addScaledVector(hu, 0.0);
        const visor = this.ellipsoid('head', 'head', _a, hr, hu, hf, rx * 1.05, 0.06 * hs, rz * 0.62, COL_42_5_62);
        visor.fill = FILL.FLAT;
      } else if (k === 'fire') {
        // a firefighter's helmet (ROADMAP 8.4): a high dome, a brim all round that is longer at
        // the back, a gold badge in front
        _a.copy(hc).addScaledVector(hu, 0.05 * hs);
        const dome = this.ellipsoid('head', 'head', _a, hr, hu, hf, rx * 1.14, ry * 1.12, rz * 1.16, hat.color);
        this.clip(dome, _q.copy(hu).negate(), hc, 0.01 * hs);
        _a.copy(hc).addScaledVector(hu, 0.025 * hs).addScaledVector(hf, -0.045 * hs);
        this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.165 * hs, 0.016 * hs, 0.215 * hs, hat.color);
        _a.copy(hc).addScaledVector(hu, 0.1 * hs).addScaledVector(hf, rz * 1.08);
        this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.036 * hs, 0.042 * hs, 0.014 * hs, COL_95_78_3);
      }
    }
    // a hoodie's hood (up frames the face, down rolls behind the neck)
    if (L.top.kind === 'hoodie' && this.parts.torso > 0.5) {
      if (L.top.hoodUp) {
        _a.copy(hc).addScaledVector(hu, 0.01 * hs).addScaledVector(hf, -0.025 * hs);
        const hood = this.ellipsoid('head', 'head', _a, hr, hu, hf, rx * 1.28, ry * 1.22, rz * 1.25, L.top.color);
        this.clip(hood, hf, hc, (0.035) * hs);
      } else {
        _a.copy(this.j.neck).addScaledVector(hf, -0.08 * S).addScaledVector(hu, 0.01 * S);
        this.ellipsoid('torso', 'neck', _a, hr, hu, hf, 0.13 * S, 0.06 * S, 0.075 * S, L.top.color);
      }
    }
    // bandana over the mouth, a full beard, shades
    if (L.acc.includes('bandanaMouth')) {
      _a.copy(hc).addScaledVector(hf, 0.035 * hs).addScaledVector(hu, -0.06 * hs);
      const b = this.ellipsoid('head', 'head', _a, hr, hu, hf, rx * 1.06, 0.07 * hs, rz * 1.02, L.bandana || COL_7_12_14);
      this.clip(b, _q.copy(hf).negate(), hc, 0.0);
    }
    if (L.face.beard === 'full') {
      _a.copy(hc).addScaledVector(hf, 0.03 * hs).addScaledVector(hu, -0.07 * hs);
      const b = this.ellipsoid('head', 'head', _a, hr, hu, hf, rx * 1.02, 0.075 * hs, rz * 1.0, hcol);
      this.clip(b, _q.copy(hf).negate(), hc, 0.01 * hs);
    }
    if (L.face.glasses === 'shades') {
      for (const sd of [-1, 1]) {
        _a.copy(hc).addScaledVector(hr, sd * 0.042 * hs).addScaledVector(hu, 0.018 * hs).addScaledVector(hf, rz * 0.98);
        this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.03 * hs, 0.02 * hs, 0.008 * hs, COL_06_06_08).gloss = true;
      }
    }
    if (L.acc.includes('headband')) {
      _a.copy(hc).addScaledVector(hu, 0.035 * hs);
      this.ellipsoid('head', 'head', _a, hr, hu, hf, rx * 1.05, 0.025 * hs, rz * 1.05, COL_84_14_16);
    }
    if (L.acc.includes('headphones')) {
      for (const sd of [-1, 1]) {
        _a.copy(hc).addScaledVector(hr, sd * rx * 1.02);
        this.ellipsoid('head', 'head', _a, hr, hu, hf, 0.025 * hs, 0.045 * hs, 0.045 * hs, COL_15_15_18);
      }
    }
  }

  dressTorso(ax, rgt, fwd, S) {
    const L = this.look;
    if (L.apron) {
      _a.lerpVectors(this.j.hip, this.j.neck, 0.32).addScaledVector(fwd, 0.088 * this.bulk * S);
      const ap = this.ellipsoid('torso', 'chest', _a, rgt, ax, fwd, 0.13 * this.bulk * S, 0.3 * S, 0.05 * S, L.apron);
      this.clip(ap, _q.copy(fwd).negate(), this.j.hip, -0.02 * S);
    }
    if (this.carry || this.carryL) carryShapes(this, ax, rgt, fwd, S);
    if (L.acc.includes('scarf')) {
      _a.copy(this.j.neck).addScaledVector(ax, 0.01 * S);
      this.ellipsoid('torso', 'neck', _a, rgt, ax, fwd, 0.08 * S, 0.04 * S, 0.075 * S, L.top.inner || COL_8_3_3);
    }
    if (L.acc.includes('bag')) {
      _a.copy(this.j.handL).addScaledVector(ax, -0.12 * S);
      this.ellipsoid('armL', 'handL', _a, rgt, ax, fwd, 0.035 * S, 0.11 * S, 0.14 * S, L.bagColor || COL_4_26_18);
    }
    const j = this.j;
    const bagC = L.bagColor || COL_16_14_16;
    if (L.acc.includes('crossbody')) {
      // a little bag on a strap across the body, from the right shoulder to the left hip
      _a.copy(j.shoulderR).addScaledVector(fwd, 0.03 * S).addScaledVector(ax, 0.02 * S);
      _b.copy(j.hipL).addScaledVector(ax, 0.06 * S).addScaledVector(fwd, 0.1 * this.bulk * S).addScaledVector(rgt, -0.05 * S);
      this.capsule('torso', 'chest', _a, _b, 0.012 * S, bagC);
      _b.addScaledVector(ax, -0.04 * S).addScaledVector(fwd, 0.02 * S);
      this.ellipsoid('torso', 'chest', _b, rgt, ax, fwd, 0.1 * S, 0.075 * S, 0.035 * S, bagC);
    }
    if (L.acc.includes('handbag')) {
      // a handbag on the crook of the left arm
      _a.lerpVectors(j.elbowL, j.handL, 0.25).addScaledVector(ax, -0.1 * S).addScaledVector(rgt, -0.05 * S);
      this.ellipsoid('armL', 'handL', _a, rgt, ax, fwd, 0.05 * S, 0.1 * S, 0.14 * S, bagC);
      _b.copy(j.elbowL).addScaledVector(ax, 0.02 * S);
      this.capsule('armL', 'handL', _b, _a, 0.01 * S, bagC);
    }
    if (L.acc.includes('tote')) {
      // a big tote bag on the left shoulder, hanging at the hip
      _a.copy(j.shoulderL).addScaledVector(rgt, -0.04 * S);
      _b.copy(j.hipL).addScaledVector(rgt, -0.13 * S).addScaledVector(ax, 0.02 * S);
      this.capsule('torso', 'chest', _a, _b, 0.011 * S, bagC);
      this.ellipsoid('torso', 'chest', _b, rgt, ax, fwd, 0.04 * S, 0.17 * S, 0.17 * S, bagC);
    }
  }

  // ------------------------------------------------------------------ bones & holes
  updateBones() {
    const shapes = this.shapes;
    for (let si = 0; si < shapes.length; si++) {
      const s = shapes[si];
      if (this.bones[s.bone] && this.bones[s.bone].stamp === this.stampN) continue;
      let b = this.bones[s.bone];
      if (!b) {
        b = { c: new THREE.Vector3(), xn: new THREE.Vector3(), yn: new THREE.Vector3(), zn: new THREE.Vector3(), part: s.part, stamp: 0 };
        this.bones[s.bone] = b;
      }
      b.part = s.part;
      b.c.copy(s.c);
      if (s.type === 0) {
        b.yn.copy(s.y).normalize();
        if (b.yn.lengthSq() < 0.5) b.yn.copy(this.ax);
        b.xn.crossVectors(b.yn, this.bfwd);
        if (b.xn.lengthSq() < 1e-6) b.xn.copy(this.brgt);
        b.xn.normalize();
        b.zn.crossVectors(b.xn, b.yn).normalize();
      } else {
        b.xn.copy(s.x).normalize();
        b.yn.copy(s.y).normalize();
        b.zn.copy(s.z).normalize();
      }
      b.stamp = this.stampN;
    }
    this.stampN = (this.stampN || 0) + 1;
    // holes follow their bones
    const bodies = this.fr.bodies;
    bodies.setDissolve(this.owner, this.dissolve);
    for (let i = 0; i < MAX_HOLES; i++) {
      const h = this.holes[i];
      if (!h) {
        bodies.setHole(this.owner, i, 0, 0, 0, 0);
        continue;
      }
      const b = this.bones[h.bone];
      if (!b) continue;
      h.w.copy(b.c).addScaledVector(b.xn, h.l.x).addScaledVector(b.yn, h.l.y).addScaledVector(b.zn, h.l.z);
      bodies.setHole(this.owner, i, h.w.x, h.w.y, h.w.z, this.parts[b.part] > 0.5 ? h.r : 0);
    }
  }

  // distance from a point to a shape's surface (negative inside)
  surfaceDist(s, p) {
    if (s.type === 0) {
      _a.copy(s.c).sub(s.y);
      _b.copy(s.c).add(s.y);
      _c.subVectors(_b, _a);
      const t = clamp(_d.subVectors(p, _a).dot(_c) / Math.max(1e-6, _c.lengthSq()), 0, 1);
      _e.copy(_a).addScaledVector(_c, t);
      return p.distanceTo(_e) - s.x.x;
    }
    _a.subVectors(p, s.c);
    const lx = s.x.length();
    const ly = s.y.length();
    const lz = s.z.length();
    const u = _a.dot(s.x) / (lx * lx);
    const v = _a.dot(s.y) / (ly * ly);
    const w = _a.dot(s.z) / (lz * lz);
    return (Math.sqrt(u * u + v * v + w * w) - 1) * (lx + ly + lz) / 3;
  }

  inHole(p) {
    this.ensureShapes();
    for (const h of this.holes) {
      if (h && p.distanceTo(h.w) < h.r * 0.9) return true;
    }
    return false;
  }

  /** Ray against the body. Returns { t, point, part, bone } or null. Passes through holes. */
  raycast(ro, rd, maxT) {
    this.ensureShapes();
    let best = null;
    for (const s of this.shapes) {
      if (!s.solid) continue;
      let ts;
      if (s.type === 0) {
        _p.copy(s.c).sub(s.y);
        _q.copy(s.c).add(s.y);
        const t = rayCapsule(ro, rd, _p, _q, s.x.x);
        ts = [t, -1];
      } else ts = rayEllipsoid(ro, rd, s);
      for (const t of ts) {
        if (t <= 0 || t > maxT || (best && t >= best.t)) continue;
        const pt = _w.copy(ro).addScaledVector(rd, t);
        if (s.clip && pt.x * s.clip[0] + pt.y * s.clip[1] + pt.z * s.clip[2] > s.clip[3]) continue;
        if (this.inHole(pt)) continue;
        best = { t, point: pt.clone(), part: s.part, bone: s.bone };
        break;
      }
    }
    return best;
  }

  nearestShape(p) {
    this.ensureShapes();
    let best = null;
    let bd = Infinity;
    for (const s of this.shapes) {
      if (!s.solid || this.parts[s.part] < 0.5) continue;
      const d = this.surfaceDist(s, p);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  // the point of the body surface closest to p (where an eraser swung at p would rub)
  closestSurfacePoint(p, out) {
    this.ensureShapes();
    const s = this.nearestShape(p);
    if (!s) return out.copy(this.center);
    if (s.type === 0) {
      _a.copy(s.c).sub(s.y);
      _c.copy(s.y).multiplyScalar(2);
      const t = clamp(_d.subVectors(p, _a).dot(_c) / Math.max(1e-6, _c.lengthSq()), 0, 1);
      _e.copy(_a).addScaledVector(_c, t);
      _d.subVectors(p, _e);
      if (_d.lengthSq() < 1e-8) _d.copy(this.bfwd);
      return out.copy(_e).addScaledVector(_d.normalize(), s.x.x);
    }
    _d.subVectors(p, s.c);
    const lx = s.x.length();
    const ly = s.y.length();
    const lz = s.z.length();
    const u = _d.dot(s.x) / (lx * lx);
    const v = _d.dot(s.y) / (ly * ly);
    const w = _d.dot(s.z) / (lz * lz);
    const l = Math.hypot(u, v, w) || 1;
    return out.copy(s.c).addScaledVector(s.x, u / l).addScaledVector(s.y, v / l).addScaledVector(s.z, w / l);
  }

  /**
   * Erase a sphere at a world point. Returns the part that lost ink and how much of it is gone.
   */
  erase(p, r) {
    this.ensureShapes();
    const s = this.nearestShape(p);
    if (!s) return null;
    const b = this.bones[s.bone];
    if (!b) return null;
    _a.subVectors(p, b.c);
    const hole = { bone: s.bone, l: new THREE.Vector3(_a.dot(b.xn), _a.dot(b.yn), _a.dot(b.zn)), r, w: p.clone() };
    // reuse the slot of an older hole on a part that is already gone, or the oldest
    let slot = this.holes.findIndex((h) => !h || this.parts[this.bones[h.bone] ? this.bones[h.bone].part : 'torso'] < 0.5);
    if (slot < 0) slot = this.holes.length < MAX_HOLES ? this.holes.length : (this.holeNext = ((this.holeNext || 0) + 1) % MAX_HOLES);
    this.holes[slot] = hole;
    const vol = (4 / 3) * Math.PI * r * r * r * 0.7;
    const part = s.part === 'pelvis' ? 'torso' : s.part;
    this.erased[part] = Math.min(1, this.erased[part] + vol / (PART_VOL[part] * this.scale * this.scale * this.scale * (part === 'torso' ? this.bulk : 1)));
    return { part, amount: this.erased[part] };
  }

  removePart(part) {
    this.parts[part] = 0;
  }

  // ------------------------------------------------------------------ drawing
  stroke(a, b, col, w, seed, wob = null) {
    if (this.holes.length) {
      _e.addVectors(a, b).multiplyScalar(0.5);
      if (this.inHole(_e)) return;
    }
    // (the pen lines of the old notebook are thin rods in this city: a cane, the pole of an
    // umbrella, a gold chain, a tie)
    const ink = col[0] * 0.3 + col[1] * 0.55 + col[2] * 0.15 < 0.2;
    this.fr.bodies.rod(a, b, (ink ? 0.0026 : 0.0042) * w * this.scale, col, this);
    void seed;
    void wob;
  }

  // point on the head surface from a local direction (x right, y up, z forward)
  headPt(x, y, z, out, lift = 1.035) {
    this.ensureShapes();
    const l = Math.hypot(x, y, z) || 1;
    const hs = this.headScale * this.scale;
    return out.copy(this.j.headC)
      .addScaledVector(this.hr, (x / l) * 0.11 * hs * lift)
      .addScaledVector(this.hu, (y / l) * 0.125 * hs * lift)
      .addScaledVector(this.hf, (z / l) * 0.115 * hs * lift);
  }

  drawFace(camDist) {
    const L = this.look;
    const F = L.face;
    const ink = L.pen.ink;
    const w = Math.max(1.4, L.pen.width * 0.75);
    if (camDist > 60) return;
    const P = (x, y, z, out) => this.headPt(x, y, z, out);
    const masked = L.hat && L.hat.kind === 'skimask';
    // eyes
    for (const sd of [-1, 1]) {
      const ex = sd * 0.36;
      const ey = 0.12;
      if (masked) {
        // eye holes of the mask: pale ovals
        for (let i = 0; i < 6; i++) {
          const a0 = (i / 6) * Math.PI * 2;
          const a1 = ((i + 1) / 6) * Math.PI * 2;
          P(ex + Math.cos(a0) * 0.14, ey + Math.sin(a0) * 0.1, 0.92, _a);
          P(ex + Math.cos(a1) * 0.14, ey + Math.sin(a1) * 0.1, 0.92, _b);
          this.stroke(_a, _b, COL_92_88_8, w * 1.2, 40 + i + sd);
        }
        P(ex, ey, 0.95, _a);
        P(ex + 0.02, ey - 0.02, 0.95, _b);
        this.stroke(_a, _b, ink, w * 1.6, 50 + sd);
        continue;
      }
      if (F.glasses === 'shades') continue;
      const style = F.eyes;
      if (style === 'narrow' || style === 'sleepy') {
        P(ex - 0.1, ey, 0.93, _a);
        P(ex + 0.1, ey + 0.01, 0.93, _b);
        this.stroke(_a, _b, ink, w * 1.1, 1 + sd);
      } else if (style === 'oval' || style === 'lashes' || style === 'anime') {
        const big = style === 'anime' ? 1.5 : 1;
        for (let i = 0; i < 6; i++) {
          const a0 = (i / 6) * Math.PI * 2;
          const a1 = ((i + 1) / 6) * Math.PI * 2;
          P(ex + Math.cos(a0) * 0.07 * big, ey + Math.sin(a0) * 0.1 * big, 0.93, _a);
          P(ex + Math.cos(a1) * 0.07 * big, ey + Math.sin(a1) * 0.1 * big, 0.93, _b);
          this.stroke(_a, _b, ink, w * 0.8, 3 + i + sd * 7);
        }
        P(ex, ey - 0.02, 0.95, _a);
        P(ex + 0.012, ey - 0.03, 0.95, _b);
        this.stroke(_a, _b, ink, w * (style === 'anime' ? 2.6 : 1.8), 12 + sd);
        if (style === 'lashes') {
          P(ex + sd * 0.07, ey + 0.08, 0.93, _a);
          P(ex + sd * 0.15, ey + 0.14, 0.9, _b);
          this.stroke(_a, _b, ink, w * 0.8, 14 + sd);
        }
      } else {
        // dot (and angry)
        P(ex - 0.012, ey, 0.95, _a);
        P(ex + 0.012, ey - 0.012, 0.95, _b);
        this.stroke(_a, _b, ink, w * 2.2, 16 + sd);
      }
      // brows
      const br = F.brows;
      if (br !== 'none' && !masked) {
        const tilt = br === 'angry' ? -0.06 : br === 'up' ? 0.05 : 0;
        P(ex - 0.11, ey + 0.17 + (sd > 0 ? -tilt : tilt), 0.9, _a);
        P(ex + 0.11, ey + 0.17 + (sd > 0 ? tilt : -tilt), 0.9, _b);
        this.stroke(_a, _b, L.hair.style === 'none' ? ink : ink, w * 1.1, 18 + sd);
      }
    }
    if (F.glasses === 'shades') {
      P(-0.12, 0.13, 0.98, _a);
      P(0.12, 0.13, 0.98, _b);
      this.stroke(_a, _b, ink, w, 22);
    } else if (F.glasses === 'round' || F.glasses === 'square') {
      for (const sd of [-1, 1]) {
        const n = F.glasses === 'round' ? 8 : 4;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * Math.PI * 2 + (n === 4 ? Math.PI / 4 : 0);
          const a1 = ((i + 1) / n) * Math.PI * 2 + (n === 4 ? Math.PI / 4 : 0);
          P(sd * 0.36 + Math.cos(a0) * 0.17, 0.12 + Math.sin(a0) * 0.14, 1.0, _a);
          P(sd * 0.36 + Math.cos(a1) * 0.17, 0.12 + Math.sin(a1) * 0.14, 1.0, _b);
          this.stroke(_a, _b, ink, w * 0.9, 24 + i + sd * 9);
        }
      }
      P(-0.19, 0.14, 1.0, _a);
      P(0.19, 0.14, 1.0, _b);
      this.stroke(_a, _b, ink, w * 0.9, 34);
    }
    if (masked) return;
    // nose
    P(0.02, 0.02, 1.0, _a);
    P(0.07, -0.16, 1.02, _b);
    this.stroke(_a, _b, ink, w * 0.9, 36);
    P(0.07, -0.16, 1.02, _a);
    P(-0.01, -0.2, 1.0, _b);
    this.stroke(_a, _b, ink, w * 0.9, 37);
    // mouth
    if (!L.acc.includes('bandanaMouth') && F.beard !== 'full') {
      const m = F.mouth;
      const mc = F.lips || ink;
      const mw = F.lips ? w * 1.6 : w;
      if (m === 'o') {
        for (let i = 0; i < 6; i++) {
          const a0 = (i / 6) * Math.PI * 2;
          const a1 = ((i + 1) / 6) * Math.PI * 2;
          P(Math.cos(a0) * 0.06, -0.44 + Math.sin(a0) * 0.06, 0.9, _a);
          P(Math.cos(a1) * 0.06, -0.44 + Math.sin(a1) * 0.06, 0.9, _b);
          this.stroke(_a, _b, mc, mw, 38 + i);
        }
      } else if (m !== 'none') {
        const curve = m === 'smile' ? 0.06 : m === 'frown' ? -0.05 : 0;
        const skew = m === 'smirk' ? 0.05 : 0;
        P(-0.2, -0.42 + curve + skew, 0.88, _a);
        P(0, -0.46, 0.92, _b);
        this.stroke(_a, _b, mc, mw, 45);
        P(0, -0.46, 0.92, _a);
        P(0.2, -0.42 + curve - skew, 0.88, _b);
        this.stroke(_a, _b, mc, mw, 46);
      }
    }
    // beards
    const bd = F.beard;
    if (bd === 'stubble') {
      for (let i = 0; i < 7; i++) {
        const x = -0.36 + i * 0.12;
        P(x, -0.55 - Math.abs(x) * 0.2, 0.82, _a);
        P(x + 0.02, -0.6 - Math.abs(x) * 0.2, 0.8, _b);
        this.stroke(_a, _b, ink, w * 0.7, 50 + i, 0.004);
      }
    } else if (bd === 'goatee' || bd === 'mustache') {
      P(-0.16, -0.33, 0.93, _a);
      P(0, -0.3, 0.97, _b);
      this.stroke(_a, _b, L.hair.color, w * 2.2, 60);
      P(0, -0.3, 0.97, _a);
      P(0.16, -0.33, 0.93, _b);
      this.stroke(_a, _b, L.hair.color, w * 2.2, 61);
      if (bd === 'goatee') {
        P(-0.04, -0.62, 0.86, _a);
        P(0.04, -0.75, 0.8, _b);
        this.stroke(_a, _b, L.hair.color, w * 2.6, 62);
      }
    }
    // ears
    for (const sd of [-1, 1]) {
      P(sd * 1.0, 0.08, 0.05, _a);
      P(sd * 1.02, -0.12, 0.0, _b);
      this.stroke(_a, _b, ink, w * 0.9, 64 + sd);
    }
    if (L.acc.includes('earrings')) {
      for (const sd of [-1, 1]) {
        P(sd * 1.0, -0.2, 0.0, _a, 1.08);
        P(sd * 1.0, -0.26, 0.0, _b, 1.08);
        this.stroke(_a, _b, GOLD, w * 2, 66 + sd);
      }
    }
    if (L.acc.includes('cigar')) {
      P(0.12, -0.44, 0.92, _a);
      _b.copy(_a).addScaledVector(this.hf, 0.12 * this.scale).addScaledVector(this.hr, 0.03);
      this.stroke(_a, _b, COL_45_3_2, w * 2.4, 68);
    }
  }

  drawDetails() {
    const L = this.look;
    const j = this.j;
    const ink = L.pen.ink;
    const w = Math.max(1.4, L.pen.width * 0.7);
    const S = this.scale;
    const ax = this.ax;
    const rgt = this.brgt;
    const fwd = this.bfwd;
    if (this.parts.torso > 0.5) {
      const chestC = _p.lerpVectors(j.hip, j.neck, 0.7);
      const depth = (L.fem ? 0.13 : 0.12) * this.bulk * S;
      if (L.acc.includes('chain')) {
        const n = 10;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * Math.PI - Math.PI;
          const a1 = ((i + 1) / n) * Math.PI - Math.PI;
          const ring = (a, out) => out.copy(j.neck).addScaledVector(rgt, Math.cos(a) * 0.07 * S).addScaledVector(fwd, -Math.sin(a) * 0.07 * S + 0.02 * S).addScaledVector(ax, -0.05 * S + Math.sin(a) * -0.07 * S);
          ring(a0, _a);
          ring(a1, _b);
          this.stroke(_a, _b, GOLD, w * 1.8, 80 + i, 0.004);
        }
      }
      if (L.top.kind === 'hoodie') {
        for (const sd of [-1, 1]) {
          _a.copy(j.neck).addScaledVector(rgt, sd * 0.04 * S).addScaledVector(fwd, depth * 0.9).addScaledVector(ax, -0.05 * S);
          _b.copy(_a).addScaledVector(ax, -0.14 * S).addScaledVector(fwd, 0.02 * S);
          this.stroke(_a, _b, ink, w * 0.8, 90 + sd);
        }
        // the kangaroo pocket
        _a.lerpVectors(j.hip, j.neck, 0.3).addScaledVector(fwd, 0.12 * this.bulk * S).addScaledVector(rgt, -0.09 * S);
        _b.copy(_a).addScaledVector(rgt, 0.18 * S);
        this.stroke(_a, _b, ink, w * 0.8, 93);
      }
      if (false && L.top.kind === 'suit' && L.top.tie) {
        _a.copy(j.neck).addScaledVector(fwd, depth * 1.02).addScaledVector(ax, -0.06 * S);
        _b.copy(_a).addScaledVector(ax, -0.22 * S).addScaledVector(fwd, 0.02 * S);
        this.stroke(_a, _b, L.top.tie, w * 3.2, 95, 0.004);
      }
      if (L.top.kind === 'jacket' || L.top.kind === 'track') {
        _a.copy(j.neck).addScaledVector(fwd, depth * 1.05).addScaledVector(ax, -0.04 * S);
        _b.lerpVectors(j.hip, j.neck, 0.15).addScaledVector(fwd, 0.115 * this.bulk * S);
        this.stroke(_a, _b, ink, w * 0.8, 96);
      }
      if (L.acc.includes('badge')) {
        _a.copy(chestC).addScaledVector(rgt, -0.08 * S).addScaledVector(fwd, depth * 0.98).addScaledVector(ax, 0.04 * S);
        for (let i = 0; i < 5; i++) {
          const a0 = (i / 5) * Math.PI * 2;
          const a1 = ((i + 2) / 5) * Math.PI * 2;
          _b.copy(_a).addScaledVector(rgt, Math.sin(a0) * 0.03 * S).addScaledVector(ax, Math.cos(a0) * 0.03 * S);
          _c.copy(_a).addScaledVector(rgt, Math.sin(a1) * 0.03 * S).addScaledVector(ax, Math.cos(a1) * 0.03 * S);
          this.stroke(_b, _c, GOLD, w * 1.3, 100 + i, 0.003);
        }
      }
      if (L.acc.includes('belt') || L.bottom.kind === 'pants' || L.bottom.kind === 'baggy') {
        const n = 8;
        const beltC = L.acc.includes('belt') ? COL_08_08_1 : ink;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * Math.PI * 2;
          const a1 = ((i + 1) / n) * Math.PI * 2;
          const ring = (a, out) => out.copy(j.hip).addScaledVector(ax, 0.09 * S).addScaledVector(rgt, Math.cos(a) * 0.158 * this.bulk * S).addScaledVector(fwd, Math.sin(a) * 0.112 * this.bulk * S);
          ring(a0, _a);
          ring(a1, _b);
          this.stroke(_a, _b, beltC, L.acc.includes('belt') ? w * 2.2 : w * 0.7, 110 + i, 0.004);
        }
      }
    }
    // (a tattoo of the wardrobe's, on the right forearm: ROADMAP 5.7)
    const tat = L.tattoo && TATTOO_LINES[L.tattoo];
    if (tat && this.parts.armR > 0.5 && L.top.sleeves !== 'long') {
      const el = j.elbowR;
      _d.subVectors(j.handR, el);
      const len = _d.length();
      _c.crossVectors(_d, rgt).normalize();
      if (_c.dot(fwd) < 0) _c.negate();
      _e.crossVectors(_d, _c).normalize();
      for (let li = 0; li < tat.length; li++) {
        const pl = tat[li];
        for (let i = 0; i + 1 < pl.length; i++) {
          _a.copy(el).addScaledVector(_d, pl[i][0]).addScaledVector(_c, 0.042 * S).addScaledVector(_e, pl[i][1] * 0.035 * S);
          _b.copy(el).addScaledVector(_d, pl[i + 1][0]).addScaledVector(_c, 0.042 * S).addScaledVector(_e, pl[i + 1][1] * 0.035 * S);
          this.stroke(_a, _b, TATTOO_INK, w * 0.8, 140 + li * 7 + i);
        }
      }
    } else if (L.acc.includes('tattoo')) {
      for (const [part, el, hd] of [['armR', j.elbowR, j.handR], ['armL', j.elbowL, j.handL]]) {
        if (this.parts[part] < 0.5 || L.top.sleeves === 'long') continue;
        _d.subVectors(hd, el);
        for (let i = 0; i < 3; i++) {
          _a.copy(el).addScaledVector(_d, 0.2 + i * 0.2).addScaledVector(fwd, 0.044 * S);
          _b.copy(_a).addScaledVector(_d, 0.1).addScaledVector(rgt, (i % 2 ? 1 : -1) * 0.03 * S);
          this.stroke(_a, _b, COL_15_25_45, w, 120 + i + (part === 'armR' ? 0 : 5));
        }
      }
    }
    if (this.carry || this.carryL) carryStrokes(this, w);
    if (false && L.hero && this.parts.head > 0.5) {
      // the headband's tails flutter behind
      const t = this.phase * 0.5;
      _a.copy(j.headC).addScaledVector(this.hu, 0.035 * this.headScale * S).addScaledVector(this.hf, -0.12 * this.headScale * S);
      for (const sd of [-1, 1]) {
        _b.copy(_a).addScaledVector(this.hf, -0.16 * S).addScaledVector(this.hr, sd * 0.05 * S).addScaledVector(this.hu, -0.05 * S + Math.sin(t + sd) * 0.03 * S);
        this.stroke(_a, _b, COL_84_14_16, w * 2.2, 130 + sd);
      }
    }
    if (this.parts.head < 0.5) {
      // erased neck: a few smudgy strokes where the head was
      const nk = j.neck;
      _a.copy(nk).addScaledVector(ax, 0.06 * S).addScaledVector(rgt, -0.04 * S);
      _b.copy(nk).addScaledVector(ax, 0.1 * S).addScaledVector(rgt, 0.04 * S);
      this.stroke(_a, _b, ink, w, 140);
      _a.copy(nk).addScaledVector(ax, 0.1 * S).addScaledVector(rgt, -0.03 * S);
      _b.copy(nk).addScaledVector(ax, 0.05 * S).addScaledVector(rgt, 0.05 * S);
      this.stroke(_a, _b, ink, w, 141);
    }
  }

  draw(camPos, alphaMul = 1) {
    if (!this.visible || alphaMul <= 0.02) return;
    this.ensureShapes();
    const camDist = camPos.distanceTo(this.pos);
    this.fr.bodies.draw(this, camDist);
    if (camDist < 60) this.drawDetails();
  }
}
