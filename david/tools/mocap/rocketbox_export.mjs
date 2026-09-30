#!/usr/bin/env node
/*
 * Microsoft Rocketbox (MIT, https://github.com/microsoft/Microsoft-Rocketbox) animation FBX -> world-space joint
 * tracks for the DAVID retarget pipeline (tools/mocap/rocketbox.py reads the JSON this writes).
 *
 *   node tools/mocap/rocketbox_export.mjs <avatar.fbx> <out_dir> <anim.fbx>...
 *
 * The Rocketbox clips use the 3ds Max biped skeleton ("Bip01 ..."). three's FBXLoader parses them in Node with three
 * tiny DOM shims; the loader already converts the file into three's frame (+Y up, the character faces +Z, its left is
 * +X — exactly the pipeline's character space), units cm. Every frame (30 fps) is posed with an AnimationMixer and the
 * WORLD rotation + position of the body joints is written out. Frame 0 of the output is the REFERENCE pose: the bind
 * pose of a Rocketbox avatar (Male_Adult_01, the A-pose the skeleton was built in) — the retarget measures every
 * joint's rotation as a delta from it (like the T-pose frame of the CMU BVH takes).
 */
import fs from 'node:fs';
import path from 'node:path';

globalThis.self = globalThis;
globalThis.window = globalThis;
globalThis.document = { createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {} }) };
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const THREE = await import(path.join(ROOT, 'node_modules/three/build/three.module.js'));
const { FBXLoader } = await import(path.join(ROOT, 'node_modules/three/examples/jsm/loaders/FBXLoader.js'));

/** exported joints: pipeline (CMU-style) name <- Rocketbox biped bone */
const MAP = {
  Hips: 'Bip01_Pelvis',
  LowerBack: 'Bip01_Spine',
  Spine: 'Bip01_Spine1',
  Spine1: 'Bip01_Spine2',
  Neck: 'Bip01_Neck',
  Head: 'Bip01_Head',
  HeadEnd: 'Bip01_HeadNub',
  Root: 'Bip01',
};
for (const [s, S] of [['L', 'Left'], ['R', 'Right']]) {
  Object.assign(MAP, {
    [`${S}Shoulder`]: `Bip01_${s}_Clavicle`,
    [`${S}Arm`]: `Bip01_${s}_UpperArm`,
    [`${S}ForeArm`]: `Bip01_${s}_Forearm`,
    [`${S}Hand`]: `Bip01_${s}_Hand`,
    [`${S}HandMiddle`]: `Bip01_${s}_Finger2`,
    [`${S}HandIndex`]: `Bip01_${s}_Finger1`,
    [`${S}HandPinky`]: `Bip01_${s}_Finger4`,
    [`${S}UpLeg`]: `Bip01_${s}_Thigh`,
    [`${S}Leg`]: `Bip01_${s}_Calf`,
    [`${S}Foot`]: `Bip01_${s}_Foot`,
    [`${S}ToeBase`]: `Bip01_${s}_Toe0`,
    [`${S}ToeEnd`]: `Bip01_${s}_Toe0Nub`,
  });
}
const NAMES = Object.keys(MAP);

function parse(file) {
  const buf = fs.readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const obj = new FBXLoader().parse(ab, '');
  obj.updateMatrixWorld(true);
  const bones = {};
  obj.traverse((o) => { if (o.name) bones[o.name] = bones[o.name] ?? o; });
  return { obj, bones };
}

/**
 * world rotation + position of every exported joint. `nubs` (reference only): the avatars carry no end nubs (HeadNub,
 * Toe0Nub) — their local offset is taken from an animation file's skeleton and hung off the avatar's parent bone.
 */
function grab(bones, nubs = null) {
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const out = [];
  for (const n of NAMES) {
    const b = bones[MAP[n]];
    if (!b) {
      const nub = nubs?.[MAP[n]];
      const parent = nub && bones[nub.parent];
      if (!parent) throw new Error(`missing bone ${MAP[n]}`);
      parent.getWorldQuaternion(q);
      p.copy(nub.local).applyMatrix4(parent.matrixWorld);
      out.push(q.x, q.y, q.z, q.w, p.x, p.y, p.z);
      continue;
    }
    b.getWorldQuaternion(q);
    b.getWorldPosition(p);
    out.push(q.x, q.y, q.z, q.w, p.x, p.y, p.z);
  }
  return out;
}

const [avatar, outDir, ...anims] = process.argv.slice(2);
if (!avatar || !outDir || !anims.length) {
  console.error('usage: rocketbox_export.mjs <avatar.fbx> <out_dir> <anim.fbx>...');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });
// the end nubs' local offsets (fixed bone lengths of the biped) from the first animation file
const first = parse(anims[0]).bones;
const nubs = {};
for (const n of NAMES) {
  const b = first[MAP[n]];
  if (b && /Nub$/.test(MAP[n]) && b.parent) nubs[MAP[n]] = { parent: b.parent.name, local: b.position.clone() };
}
const ref = grab(parse(avatar).bones, nubs);
for (const f of anims) {
  const name = path.basename(f).replace(/\.max\.fbx$|\.fbx$/, '');
  const { obj, bones } = parse(f);
  const clip = obj.animations[0];
  if (!clip) {
    console.error(`${name}: no animation`);
    continue;
  }
  // the keyed frame rate (Rocketbox: 30 fps); frame times from the densest track
  let times = clip.tracks[0].times;
  for (const t of clip.tracks) if (t.times.length > times.length) times = t.times;
  const dt = times.length > 1 ? times[1] - times[0] : 1 / 30;
  const fps = Math.round(1 / dt);
  const n = Math.max(1, Math.round(clip.duration * fps) + 1);
  const mixer = new THREE.AnimationMixer(obj);
  const action = mixer.clipAction(clip);
  action.play();
  const frames = [ref];
  for (let i = 0; i < n; i++) {
    mixer.setTime(Math.min(clip.duration, i / fps));
    obj.updateMatrixWorld(true);
    frames.push(grab(bones));
  }
  const data = new Float32Array(frames.length * frames[0].length);
  frames.forEach((fr, i) => data.set(fr, i * fr.length));
  const tmp = path.join(outDir, `${name}.json.part`);
  fs.writeFileSync(tmp, JSON.stringify({ name, fps, frames: frames.length, joints: NAMES, stride: 7, units: 'cm', data: Buffer.from(data.buffer).toString('base64') }));
  fs.renameSync(tmp, path.join(outDir, `${name}.json`));
  console.log(`${name}: ${n} frames @ ${fps} fps (${clip.duration.toFixed(2)} s)`);
}
