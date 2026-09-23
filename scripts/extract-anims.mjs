// Extracts the clips THRESHOLD needs from Quaternius' Universal Animation
// Library (CC0, Rigify "DEF-*" rig) and retargets them onto the Soldier.glb
// Mixamo skeleton. Writes a compact public/assets/anims.json.
//
//   node scripts/extract-anims.mjs [--src path/to/AnimationLibrary_Godot_Standard.gltf] [--out public/assets/anims.json]
//
// Retargeting (world-space delta):
//   both rigs are posed in their bind poses in one common frame (the source is
//   turned to face the target's -Z), then every source bone's rest is swung so
//   its bone direction matches the target's (fixes small rest-pose
//   differences). For every frame:
//     targetWorld = sourceWorldAnim * inverse(sourceWorldAlignedRest) * targetWorldRest
//   and back to target locals through the target parents. The pelvis (mid
//   thighs) follows the source pelvis scaled by the leg-length ratio; the Hips
//   position is solved from it. Tracks are quantized (quaternions x1e4, hips
//   cm x100), key-reduced, constant-at-rest tracks are dropped.
import * as THREE from 'three';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const SRC = arg('--src', process.env.ANIM_SRC || '/home/user/j-ponzo/gltf-universal-animation-library/glTF/AnimationLibrary_Godot_Standard.gltf');
const TARGET = arg('--target', resolve(here, '../public/assets/Soldier.glb'));
const OUT = arg('--out', resolve(here, '../public/assets/anims.json'));
const QS = 10000; // quaternion quantization
const PS = 100; // hips position (cm) quantization
const FPS = 24;

/**
 * ClipName -> source clip. `loop` loops; `cycle` = a locomotion cycle whose
 * natural ground speed is measured from the planted foot (or given as `speed`).
 * `warp`: store a distance->time warp (gaits that always keep a foot down).
 * `from`/`to` trim (s); `lift` raises the body (m); `recenter: [t0, t1]` slides
 * the final horizontal hips offset back to the root between t0 and t1.
 */
const CLIPS = {
  idle: { src: 'Idle_Loop', loop: true },
  walk: { src: 'Walk_Loop', loop: true, cycle: true, warp: true },
  run: { src: 'Jog_Fwd_Loop', loop: true, cycle: true },
  sprint: { src: 'Sprint_Loop', loop: true, cycle: true },
  crouchIdle: { src: 'Crouch_Idle_Loop', loop: true },
  crouchWalk: { src: 'Crouch_Fwd_Loop', loop: true, cycle: true, warp: true },
  jumpStart: { src: 'Jump_Start' },
  jumpLoop: { src: 'Jump_Loop', loop: true },
  jumpLand: { src: 'Jump_Land' },
  roll: { src: 'Roll' },
  strike: { src: 'Sword_Attack' },
  punch: { src: 'Punch_Cross' },
  push: { src: 'Push_Loop', from: 0, to: 0.75 },
  hitChest: { src: 'Hit_Chest' },
  hitHead: { src: 'Hit_Head' },
  // recentred during the fall so the body ends up lying centred on the root
  death: { src: 'Death01', recenter: [0.5, 1.0] },
  aim: { src: 'Pistol_Aim_Neutral', loop: true },
  shoot: { src: 'Pistol_Shoot' },
  reload: { src: 'Pistol_Reload' },
  swimIdle: { src: 'Swim_Idle_Loop', loop: true },
  // lifted so treading and swimming share one waterline (~1.4 m above the feet/root)
  swim: { src: 'Swim_Fwd_Loop', loop: true, cycle: true, speed: 1.2, lift: 0.3 },
  interact: { src: 'Interact' },
  pickUp: { src: 'PickUp_Table' },
};

// target (Mixamo, without the "mixamorig:" prefix) <- source (Rigify DEF-*)
const MAP = {
  Hips: 'DEF-hips',
  Spine: 'DEF-spine.001',
  Spine1: 'DEF-spine.002',
  Spine2: 'DEF-spine.003',
  Neck: 'DEF-neck',
  Head: 'DEF-head',
};
for (const [side, s] of [['Left', 'L'], ['Right', 'R']]) {
  Object.assign(MAP, {
    [`${side}Shoulder`]: `DEF-shoulder.${s}`,
    [`${side}Arm`]: `DEF-upper_arm.${s}`,
    [`${side}ForeArm`]: `DEF-forearm.${s}`,
    [`${side}Hand`]: `DEF-hand.${s}`,
    [`${side}UpLeg`]: `DEF-thigh.${s}`,
    [`${side}Leg`]: `DEF-shin.${s}`,
    [`${side}Foot`]: `DEF-foot.${s}`,
    [`${side}ToeBase`]: `DEF-toe.${s}`,
  });
  for (let k = 1; k <= 3; k++) {
    MAP[`${side}HandThumb${k}`] = `DEF-thumb.0${k}.${s}`;
    MAP[`${side}HandIndex${k}`] = `DEF-f_index.0${k}.${s}`;
    MAP[`${side}HandMiddle${k}`] = `DEF-f_middle.0${k}.${s}`;
    MAP[`${side}HandRing${k}`] = `DEF-f_ring.0${k}.${s}`;
    MAP[`${side}HandPinky${k}`] = `DEF-f_pinky.0${k}.${s}`;
  }
}
// bone -> child whose direction is matched between the rest poses
const AIM_CHILD = { Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head' };
for (const side of ['Left', 'Right']) {
  Object.assign(AIM_CHILD, {
    [`${side}Shoulder`]: `${side}Arm`,
    [`${side}Arm`]: `${side}ForeArm`,
    [`${side}ForeArm`]: `${side}Hand`,
    [`${side}Hand`]: `${side}HandMiddle1`,
    [`${side}UpLeg`]: `${side}Leg`,
    [`${side}Leg`]: `${side}Foot`,
    [`${side}Foot`]: `${side}ToeBase`,
  });
  for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
    AIM_CHILD[`${side}Hand${f}1`] = `${side}Hand${f}2`;
    AIM_CHILD[`${side}Hand${f}2`] = `${side}Hand${f}3`;
  }
}

// ---------------------------------------------------------------------------
// glTF access
// ---------------------------------------------------------------------------

function reader(json, bin) {
  return (index) => {
    const a = json.accessors[index];
    const bv = json.bufferViews[a.bufferView];
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
    if (a.componentType !== 5126) throw new Error(`accessor ${index}: only float accessors are supported`);
    const off = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const stride = bv.byteStride || n * 4;
    const out = new Float32Array(a.count * n);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = bin.readFloatLE(off + k * stride + c * 4);
    return out;
  };
}

function readGlb(path) {
  const b = readFileSync(path);
  if (b.toString('utf8', 0, 4) !== 'glTF') throw new Error(`${path} is not a GLB`);
  let off = 12;
  let json = null;
  let bin = null;
  while (off < b.length) {
    const len = b.readUInt32LE(off);
    const type = b.readUInt32LE(off + 4);
    const chunk = b.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  return { json, bin };
}

function readGltf(path) {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const bin = readFileSync(resolve(dirname(path), json.buffers[0].uri));
  return { json, bin };
}

/** Node hierarchy with rest TRS and a world-matrix evaluator. */
function rig(json) {
  const parent = new Int32Array(json.nodes.length).fill(-1);
  json.nodes.forEach((n, i) => (n.children || []).forEach((c) => (parent[c] = i)));
  const rest = json.nodes.map((n) => ({
    t: new THREE.Vector3(...(n.translation || [0, 0, 0])),
    r: new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])),
    s: new THREE.Vector3(...(n.scale || [1, 1, 1])),
  }));
  // parents before children
  const order = [];
  const seen = new Set();
  const visit = (i) => {
    if (seen.has(i)) return;
    if (parent[i] >= 0) visit(parent[i]);
    seen.add(i);
    order.push(i);
  };
  json.nodes.forEach((_, i) => visit(i));
  const index = (name) => {
    const i = json.nodes.findIndex((n) => n.name === name);
    if (i < 0) throw new Error(`node ${name} not found`);
    return i;
  };
  /** World matrices for local TRS arrays. */
  const world = (pose) => {
    const W = new Array(json.nodes.length);
    for (const i of order) {
      const p = pose[i];
      const m = new THREE.Matrix4().compose(p.t, p.r, p.s);
      W[i] = parent[i] >= 0 ? W[parent[i]].clone().multiply(m) : m;
    }
    return W;
  };
  const clonePose = () => rest.map((p) => ({ t: p.t.clone(), r: p.r.clone(), s: p.s.clone() }));
  return { json, parent, rest, order, index, world, clonePose };
}

const pos = (m) => new THREE.Vector3().setFromMatrixPosition(m);
const rot = (m) => {
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  m.decompose(p, q, s);
  return q;
};

// ---------------------------------------------------------------------------
// Load both rigs
// ---------------------------------------------------------------------------

const srcFile = readGltf(SRC);
const S = rig(srcFile.json);
const sAcc = reader(srcFile.json, srcFile.bin);
const tgtFile = readGlb(TARGET);
const T = rig(tgtFile.json);
const tAcc = reader(tgtFile.json, tgtFile.bin);

const tName = (short) => `mixamorig:${short}`;
const bodySkin = tgtFile.json.skins.reduce((a, b) => (b.joints.length > a.joints.length ? b : a));
const skinJoints = new Set(bodySkin.joints.map((j) => tgtFile.json.nodes[j].name));
// bones we animate: mapped + skinned (fingertips etc. carry no weights)
const BONES = Object.keys(MAP).filter((b) => skinJoints.has(tName(b)));
const tIdx = Object.fromEntries(Object.keys(MAP).map((b) => [b, T.index(tName(b))]));
const sIdx = Object.fromEntries(Object.entries(MAP).map(([b, s]) => [b, S.index(s)]));

// Sanity: bind pose == node rest pose on the target (so node TRS is the bind).
{
  const W = T.world(T.rest);
  const ibm = tAcc(bodySkin.inverseBindMatrices);
  const meshNode = tgtFile.json.nodes.findIndex((n) => n.skin === tgtFile.json.skins.indexOf(bodySkin));
  let maxd = 0;
  bodySkin.joints.forEach((j, k) => {
    const bw = W[meshNode].clone().multiply(new THREE.Matrix4().fromArray(ibm, k * 16).invert());
    maxd = Math.max(maxd, ...bw.elements.map((v, i) => Math.abs(v - W[j].elements[i])));
  });
  if (maxd > 1e-3) console.warn(`warning: target rest pose differs from bind pose by ${maxd}`);
}

const sRestW = S.world(S.rest);
const tRestW = T.world(T.rest);

// Facing: a rig faces the way its toes point from its ankles.
const facing = (W, foot, toe) => {
  const d = pos(W[toe]).sub(pos(W[foot]));
  return Math.sign(d.z) || 1;
};
const sFace = facing(sRestW, sIdx.LeftFoot, sIdx.LeftToeBase);
const tFace = facing(tRestW, tIdx.LeftFoot, tIdx.LeftToeBase);
// Common frame: the target's native frame. F turns the source to face the same way.
const F = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sFace === tFace ? 0 : Math.PI);
const FM = new THREE.Matrix4().makeRotationFromQuaternion(F);
const sWorld = (W) => W.map((m) => FM.clone().multiply(m));

const sRest = sWorld(sRestW);
const sRestQ = {};
const tRestQ = {};
const alignQ = {};
for (const b of Object.keys(MAP)) {
  sRestQ[b] = rot(sRest[sIdx[b]]);
  tRestQ[b] = rot(tRestW[tIdx[b]]);
  alignQ[b] = new THREE.Quaternion();
  const c = AIM_CHILD[b];
  if (c) {
    const ds = pos(sRest[sIdx[c]]).sub(pos(sRest[sIdx[b]])).normalize();
    const dt = pos(tRestW[tIdx[c]]).sub(pos(tRestW[tIdx[b]])).normalize();
    alignQ[b].setFromUnitVectors(ds, dt);
  }
}
// leaf bones follow their parent's alignment
for (const b of Object.keys(MAP)) if (!AIM_CHILD[b] && /Hand\w+3$/.test(b)) alignQ[b].copy(alignQ[b.replace(/3$/, '2')]);
// sourceAlignedRest^-1 * targetRest, per bone
const restFix = {};
for (const b of Object.keys(MAP)) {
  const sAligned = alignQ[b].clone().multiply(sRestQ[b]);
  restFix[b] = sAligned.invert().multiply(tRestQ[b]);
}

const pelvis = (W, l, r) => pos(W[l]).add(pos(W[r])).multiplyScalar(0.5);
const sPelvis0 = pelvis(sRest, sIdx.LeftUpLeg, sIdx.RightUpLeg);
const tPelvis0 = pelvis(tRestW, tIdx.LeftUpLeg, tIdx.RightUpLeg);
// leg length ratio: pelvis height over the ankle-to-ground offset is similar on both
const legRatio = tPelvis0.y / sPelvis0.y;
const tHips0 = pos(tRestW[tIdx.Hips]);
const hipsToPelvis0 = tPelvis0.clone().sub(tHips0); // world, rest
const tHipsParent = T.parent[tIdx.Hips];
const tHipsParentW = tRestW[tHipsParent];
const tHipsParentInv = tHipsParentW.clone().invert();
const tHipsParentQ = rot(tHipsParentW);

console.log(`source faces ${sFace > 0 ? '+Z' : '-Z'}, target faces ${tFace > 0 ? '+Z' : '-Z'}; leg ratio ${legRatio.toFixed(3)}; ${BONES.length} bones`);

// ---------------------------------------------------------------------------
// Source sampling
// ---------------------------------------------------------------------------

function sampleChannel(times, values, n, interp, t, out) {
  const last = times.length - 1;
  if (t <= times[0] || last === 0) {
    for (let c = 0; c < n; c++) out[c] = values[c];
    return out;
  }
  if (t >= times[last]) {
    for (let c = 0; c < n; c++) out[c] = values[last * n + c];
    return out;
  }
  let k = 0;
  while (k < last - 1 && times[k + 1] <= t) k++;
  const a = (t - times[k]) / (times[k + 1] - times[k]);
  if (interp === 'STEP') {
    for (let c = 0; c < n; c++) out[c] = values[k * n + c];
    return out;
  }
  if (n === 4) {
    const qa = new THREE.Quaternion().fromArray(values, k * 4);
    const qb = new THREE.Quaternion().fromArray(values, (k + 1) * 4);
    qa.slerp(qb, a);
    out[0] = qa.x;
    out[1] = qa.y;
    out[2] = qa.z;
    out[3] = qa.w;
    return out;
  }
  for (let c = 0; c < n; c++) out[c] = values[k * n + c] * (1 - a) + values[(k + 1) * n + c] * a;
  return out;
}

function sourceClip(name) {
  const anim = srcFile.json.animations.find((a) => a.name === name);
  if (!anim) throw new Error(`source clip ${name} missing`);
  const chans = anim.channels.map((c) => {
    const smp = anim.samplers[c.sampler];
    return { node: c.target.node, path: c.target.path, interp: smp.interpolation, times: sAcc(smp.input), values: sAcc(smp.output) };
  });
  let end = 0;
  for (const c of chans) end = Math.max(end, c.times[c.times.length - 1]);
  // a pure STEP pose (2 keys) is a static pose
  const animated = chans.some((c) => c.interp !== 'STEP' && c.times.length > 2);
  const pose = (t) => {
    const p = S.clonePose();
    const tmp = [0, 0, 0, 0];
    for (const c of chans) {
      if (c.path === 'weights') continue;
      const n = c.path === 'rotation' ? 4 : 3;
      sampleChannel(c.times, c.values, n, c.interp, t, tmp);
      if (c.path === 'rotation') p[c.node].r.set(tmp[0], tmp[1], tmp[2], tmp[3]).normalize();
      else if (c.path === 'translation') p[c.node].t.set(tmp[0], tmp[1], tmp[2]);
      else p[c.node].s.set(tmp[0], tmp[1], tmp[2]);
    }
    return p;
  };
  return { end: animated ? end : 0, pose };
}

// ---------------------------------------------------------------------------
// Retarget one frame
// ---------------------------------------------------------------------------

/** Returns target local quaternions per bone and the Hips local position. */
function retargetFrame(srcPose, lift = 0) {
  const W = sWorld(S.world(srcPose));
  const tw = {};
  for (const b of Object.keys(MAP)) tw[b] = rot(W[sIdx[b]]).multiply(restFix[b]);
  const local = {};
  for (const b of Object.keys(MAP)) {
    const pi = T.parent[tIdx[b]];
    const pShort = tgtFile.json.nodes[pi].name.replace('mixamorig:', '');
    const pq = tw[pShort] ? tw[pShort] : pi === tHipsParent ? tHipsParentQ : null;
    if (!pq) throw new Error(`parent of ${b} not mapped`);
    local[b] = pq.clone().invert().multiply(tw[b]).normalize();
  }
  // pelvis anchor -> Hips position
  const sp = pelvis(W, sIdx.LeftUpLeg, sIdx.RightUpLeg);
  const tp = tPelvis0.clone().add(sp.sub(sPelvis0).multiplyScalar(legRatio));
  tp.y += lift;
  const delta = tw.Hips.clone().multiply(tRestQ.Hips.clone().invert());
  const hipsW = tp.sub(hipsToPelvis0.clone().applyQuaternion(delta));
  const hipsLocal = hipsW.applyMatrix4(tHipsParentInv);
  return { local, hipsLocal };
}

/** Target FK (world positions) for measuring feet. */
function targetWorld(local, hipsLocal) {
  const p = T.clonePose();
  for (const b of Object.keys(MAP)) p[tIdx[b]].r.copy(local[b]);
  p[tIdx.Hips].t.copy(hipsLocal);
  return T.world(p);
}

// ---------------------------------------------------------------------------
// Tracks: sign continuity, quantization, key reduction
// ---------------------------------------------------------------------------

function reduce(frames, n, tol) {
  // frames: array of n-tuples (ints). Keeps keys so that linear interpolation
  // between kept keys stays within tol of every dropped key.
  const keep = [0];
  let a = 0;
  while (a < frames.length - 1) {
    let b = a + 1;
    while (b + 1 < frames.length) {
      const c = b + 1;
      let ok = true;
      for (let k = a + 1; k < c && ok; k++) {
        const u = (k - a) / (c - a);
        for (let i = 0; i < n; i++) {
          const v = frames[a][i] * (1 - u) + frames[c][i] * u;
          if (Math.abs(v - frames[k][i]) > tol) {
            ok = false;
            break;
          }
        }
      }
      if (!ok) break;
      b = c;
    }
    keep.push(b);
    a = b;
  }
  return keep;
}

function buildTracks(frames) {
  const tracks = [];
  BONES.forEach((b, bi) => {
    // quaternion track
    const qs = [];
    let prev = null;
    for (const f of frames) {
      const q = f.local[b].clone();
      if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      prev = q;
      qs.push([Math.round(q.x * QS), Math.round(q.y * QS), Math.round(q.z * QS), Math.round(q.w * QS)]);
    }
    const rq = T.rest[tIdx[b]].r;
    const restI = [rq.x, rq.y, rq.z, rq.w].map((v) => Math.round(v * QS));
    const constant = qs.every((q) => q.every((v, i) => Math.abs(v - qs[0][i]) <= 2));
    const atRest = constant && (qs[0].every((v, i) => Math.abs(v - restI[i]) <= 3) || qs[0].every((v, i) => Math.abs(-v - restI[i]) <= 3));
    if (!atRest) {
      const keys = constant ? [0] : reduce(qs, 4, 12);
      tracks.push({ b: bi, p: 'q', k: keys, v: keys.flatMap((k) => qs[k]) });
    }
    if (b === 'Hips') {
      const ps = frames.map((f) => [Math.round(f.hipsLocal.x * PS), Math.round(f.hipsLocal.y * PS), Math.round(f.hipsLocal.z * PS)]);
      const keys = ps.every((p) => p.every((v, i) => Math.abs(v - ps[0][i]) <= 2)) ? [0] : reduce(ps, 3, 15);
      tracks.push({ b: bi, p: 'p', k: keys, v: keys.flatMap((k) => ps[k]) });
    }
  });
  return tracks;
}

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

const out = {
  version: 1,
  source: 'Quaternius Universal Animation Library (CC0 1.0), retargeted to Soldier.glb by scripts/extract-anims.mjs',
  fps: FPS,
  qScale: QS,
  pScale: PS,
  bonePrefix: 'mixamorig',
  bones: BONES,
  clips: {},
};

const toeL = tIdx.LeftToeBase;
const toeR = tIdx.RightToeBase;
const footL = tIdx.LeftFoot;
const footR = tIdx.RightFoot;

for (const [name, def] of Object.entries(CLIPS)) {
  const src = sourceClip(def.src);
  const from = def.from ?? 0;
  const to = Math.min(def.to ?? src.end, src.end);
  const n = Math.max(1, Math.round((to - from) * FPS) + 1);
  const frames = [];
  for (let i = 0; i < n; i++) frames.push(retargetFrame(src.pose(from + i / FPS), def.lift ?? 0));
  // loops: remove any horizontal drift so the cycle closes (keep the bob)
  if (def.loop && n > 2) {
    const a = frames[0].hipsLocal;
    const b = frames[n - 1].hipsLocal;
    // Hips local frame: parent is Z-up; x/y are horizontal in it
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      frames[i].hipsLocal.x -= (b.x - a.x) * u;
      frames[i].hipsLocal.y -= (b.y - a.y) * u;
    }
  }
  if (def.recenter && n > 2) {
    const [t0, t1] = def.recenter;
    const end = frames[n - 1].hipsLocal;
    const rest = T.rest[tIdx.Hips].t;
    const dx = end.x - rest.x;
    const dy = end.y - rest.y;
    for (let i = 0; i < n; i++) {
      const u = Math.min(1, Math.max(0, (i / FPS - t0) / (t1 - t0)));
      const k = u * u * (3 - 2 * u);
      frames[i].hipsLocal.x -= dx * k;
      frames[i].hipsLocal.y -= dy * k;
    }
  }
  // measure feet
  let minFoot = Infinity;
  let headY = 0;
  const feet = [];
  for (const f of frames) {
    const W = targetWorld(f.local, f.hipsLocal);
    headY += pos(W[tIdx.Head]).y / n;
    const l = pos(W[toeL]);
    const r = pos(W[toeR]);
    const fl = pos(W[footL]);
    const fr = pos(W[footR]);
    minFoot = Math.min(minFoot, l.y, r.y, fl.y, fr.y);
    feet.push({ l, r, fl, fr });
  }
  // natural speed: a planted toe (within 3 cm of the lowest toe height) slides
  // backwards at ground speed
  let speed = def.speed ?? 0;
  if (def.cycle && !def.speed && n > 3) {
    const minToe = Math.min(...feet.map((f) => Math.min(f.l.y, f.r.y)));
    const v = [];
    for (let i = 0; i < n - 1; i++) {
      for (const side of ['l', 'r']) {
        const p0 = feet[i][side];
        const p1 = feet[i + 1][side];
        // target faces -Z: a planted foot moves toward +Z relative to the body
        if (p0.y < minToe + 0.03 && p1.y < minToe + 0.03) v.push((p1.z - p0.z) * FPS * -tFace);
      }
    }
    v.sort((x, y) => x - y);
    speed = v.length ? v[Math.floor(v.length / 2)] : 0;
  }
  // distance warp for gaits that always keep a foot down: cumulative travel of
  // the lowest toe (backwards, body frame) per frame, normalised to 0..1. The
  // runtime samples these cycles by distance so lurching gaits don't skate.
  let warp = null;
  if (def.warp && n > 3) {
    // contact point of a foot: heel (ankle) or ball (toe), whichever is lower
    // relative to its flat-foot rest height
    const ankle0 = pos(tRestW[footL]).y;
    const toe0 = pos(tRestW[toeL]).y;
    const contact = (f, side, kind) => {
      const toe = side === 'l' ? f.l : f.r;
      const ank = side === 'l' ? f.fl : f.fr;
      const th = toe.y - toe0;
      const ah = ank.y - ankle0;
      const useToe = kind ? kind === 'toe' : th < ah;
      return useToe ? { h: th, z: toe.z, kind: 'toe' } : { h: ah, z: ank.z, kind: 'heel' };
    };
    const inc = [];
    for (let i = 0; i < n - 1; i++) {
      // feet on the ground (within 1.5 cm of the lower one): the fastest backwards one sets the pace
      const c0 = { l: contact(feet[i], 'l'), r: contact(feet[i], 'r') };
      const low = Math.min(c0.l.h, c0.r.h);
      let d = 0;
      for (const side of ['l', 'r']) {
        if (c0[side].h > low + 0.015) continue;
        d = Math.max(d, (contact(feet[i + 1], side, c0[side].kind).z - c0[side].z) * -tFace);
      }
      inc.push(d);
    }
    const mean = inc.reduce((a, b) => a + b, 0) / inc.length;
    const floor = mean * 0.2;
    let acc = 0;
    const cum = [0];
    for (const d of inc) cum.push((acc += Math.max(floor, d)));
    warp = cum.map((c) => Math.round((c / acc) * 10000));
    speed = acc / ((n - 1) / FPS);
  }
  if (process.env.ANIM_DEBUG === name) {
    for (let i = 0; i < n; i++) {
      const W = sWorld(S.world(src.pose(from + i / FPS)));
      const l = pos(W[sIdx.LeftToeBase]);
      const h = pos(W[sIdx.Hips]);
      console.log(i, 'src L toe', l.y.toFixed(3), l.z.toFixed(3), 'hips', h.y.toFixed(3), h.z.toFixed(3));
    }
    feet.forEach((f, i) =>
      console.log(i, 'L toe', f.l.y.toFixed(3), f.l.z.toFixed(3), 'ankle', f.fl.y.toFixed(3), f.fl.z.toFixed(3), '| R toe', f.r.y.toFixed(3), f.r.z.toFixed(3), 'ankle', f.fr.y.toFixed(3), f.fr.z.toFixed(3)),
    );
  }
  const tracks = buildTracks(frames);
  out.clips[name] = {
    src: def.src,
    duration: +((n - 1) / FPS).toFixed(3),
    frames: n,
    loop: !!def.loop,
    speed: +speed.toFixed(3),
    ...(warp ? { warp } : {}),
    tracks,
  };
  const keys = tracks.reduce((s, t) => s + t.k.length, 0);
  console.log(`${name.padEnd(10)} ${def.src.padEnd(20)} ${String(n).padStart(3)}f ${((n - 1) / FPS).toFixed(2)}s tracks ${String(tracks.length).padStart(2)} keys ${String(keys).padStart(4)} minFoot ${minFoot.toFixed(3)} head ${headY.toFixed(2)}${speed ? ` speed ${speed.toFixed(2)} m/s` : ''}`);
}

const text = JSON.stringify(out);
writeFileSync(OUT, text);
console.log(`wrote ${OUT} (${(text.length / 1024).toFixed(1)} KB)`);
