// Dev-only preview harness for src/characters/human (not part of the game build).
//
// /dev/human.html?preset=david|saul|man&pose=idle|walk|sling|rest&view=face|three4|full|profile|back|posed|...
//   &q=high|medium|low   quality tier (engine.quality.name)
//   &mode=game|studio    game: SkySystem + PostFX (sun elevation 13°, azimuth 100°); studio: neutral 3-point light
//   &mat=clay            show the geometry only (neutral clay material)
//   &sheet=face|body     render several views side by side (face: front, 3/4, profile; body: front, profile, back)
//   &expr=neutral|determined|effort|awe|smile  &seed=3 (man)  &yaw=0 (deg)  &sun=13,100  &frames=3
//   &w=900&h=900 (per view)  &fl=grip&fr=relaxed (finger poses)  &look=x,y,z  &staff=0  &live=1
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SkySystem } from '../src/world/Sky';
import { PostFX } from '../src/fx/PostFX';
import { shared } from '../src/core/Shared';
import { pose, PoseMixer, type Pose } from '../src/characters/Rig';
import { HumanModel } from '../src/characters/human/HumanModel';
import { defaultDQSFactor } from '../src/characters/human/DualQuatSkinning';
import type { Expression, FingerPose } from '../src/characters/human/HumanRig';
import rockAlbedo from '../src/assets/textures/rock_albedo.jpg';
import rockNormal from '../src/assets/textures/rock_normal.jpg';

const P = new URLSearchParams(location.search);
const preset = P.get('preset') ?? 'david';
const poseName = P.get('pose') ?? 'idle';
const view = P.get('view') ?? 'three4';
const q = (P.get('q') ?? 'high') as 'low' | 'medium' | 'high';
const mode = P.get('mode') ?? 'game';
const studio = mode === 'studio';
const expr = (P.get('expr') ?? 'neutral') as Expression;
const seed = P.has('seed') ? parseInt(P.get('seed')!, 10) : undefined;
const yawDeg = parseFloat(P.get('yaw') ?? '0');
const [sunEl, sunAz] = (P.get('sun') ?? '13,100').split(',').map(Number);
const W = parseInt(P.get('w') ?? '0', 10) || innerWidth;
const H = parseInt(P.get('h') ?? '0', 10) || innerHeight;
const sheet = P.get('sheet');
const VIEWS = sheet === 'face' ? ['face', 'three4', 'profileFace'] : sheet === 'body' ? ['full', 'profile', 'back'] : sheet ? sheet.split(',') : [view];
const info = document.getElementById('info')!;

const renderer = new THREE.WebGLRenderer({ antialias: studio, preserveDrawingBuffer: true, stencil: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = parseFloat(P.get('exposure') ?? (studio ? '1.0' : '0.58'));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.02, 26000);
let sky: SkySystem | null = null;
let post: PostFX | null = null;
const studioLights: { key: THREE.DirectionalLight; rim: THREE.DirectionalLight } | null = studio ? setupStudio() : null;
if (!studio) {
  sky = new SkySystem(renderer, q === 'high' ? 4096 : 2048);
  scene.add(sky.group);
  sky.setSun(sunEl, sunAz, scene);
  // tight shadow frustum for close-ups
  const sc = sky.sun.shadow.camera;
  sc.left = -2.5; sc.right = 2.5; sc.top = 2.5; sc.bottom = -2.5;
  sc.updateProjectionMatrix();
  sky.sun.shadow.bias = -0.0002;
  sky.sun.shadow.normalBias = 0.012;
  sky.sun.shadow.radius = 2;
  post = new PostFX(renderer, scene, camera, sky.cubeTarget.texture, { msaa: q === 'low' ? 0 : 4, bloom: true, godRaySamples: 24, pixelRatio: 1 });
  post.setSize(W, H);
  post.atmosphere.uniforms.uDensity.value = 0.00012;
}

function setupStudio() {
  scene.background = new THREE.Color(0x2e3035);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.28;
  const key = new THREE.DirectionalLight(0xfff0dc, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -1.2; sc.right = 1.2; sc.top = 1.2; sc.bottom = -1.2; sc.near = 0.1; sc.far = 12;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.01;
  key.shadow.radius = 3;
  const rim = new THREE.DirectionalLight(0xffe6c8, 2.2);
  const hemi = new THREE.HemisphereLight(0xc8d2e0, 0x3b322c, 0.55);
  scene.add(key, key.target, rim, rim.target, hemi);
  return { key, rim };
}

// ---- limestone ground
const tl = new THREE.TextureLoader();
const ra = tl.load(rockAlbedo);
ra.colorSpace = THREE.SRGBColorSpace;
const rn = tl.load(rockNormal);
for (const t of [ra, rn]) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 24);
  t.anisotropy = 8;
}
const gGeo = new THREE.PlaneGeometry(60, 60, 64, 64);
gGeo.rotateX(-Math.PI / 2);
const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ map: ra, normalMap: rn, color: studio ? 0x6a6560 : 0xe8dcc6, roughness: 0.92 }));
ground.receiveShadow = true;
scene.add(ground);

// ---- poses (DavidModel conventions)
const IDLE = pose({
  hips: [0, 0, 0.03], chest: [0.02, 0, 0], head: [-0.04, 0.08, 0],
  uaL: [-0.42, 0, 0.2], faL: [-1.2, 0, 0], hdL: [-0.25, 0.457, 0.12],
  uaR: [0.04, 0, -0.1], faR: [-0.25, 0, 0], hdR: [0.0, 0, 0],
  thL: [-0.06, 0, 0.03], shinL: [0.08, 0, 0], ftL: [-0.02, 0, 0],
  thR: [0.09, 0, -0.04], shinR: [0.05, 0, 0], ftR: [-0.12, 0, 0],
});
const SPIN = pose({
  spine: [0, -0.1, 0], chest: [0.03, -0.22, 0], head: [-0.05, 0.26, 0], neck: [0, 0.06, 0],
  uaR: [-2.45, 0, -0.55], faR: [-0.75, 0, 0], hdR: [0.1, 0, 0],
  uaL: [-0.42, 0, 0.2], faL: [-1.2, 0, 0], hdL: [-0.25, 0.457, 0.12],
  thL: [-0.2, 0, 0.08], shinL: [0.15, 0, 0], ftL: [0.05, 0, 0],
  thR: [0.25, 0, -0.08], shinR: [0.1, 0, 0], ftR: [-0.3, 0, 0],
});
function walkPose(ph: number): Pose {
  const s = Math.sin(ph), c = Math.cos(ph), A = 0.42;
  const kneeL = Math.max(0, c) * 0.95 + 0.12, kneeR = Math.max(0, -c) * 0.95 + 0.12;
  return pose({
    thL: [-s * A, 0, 0.02], shinL: [kneeL, 0, 0], ftL: [-(-s * A + kneeL) * 0.55 + Math.max(0, -s) * 0.25, 0, 0],
    thR: [s * A, 0, -0.02], shinR: [kneeR, 0, 0], ftR: [-(s * A + kneeR) * 0.55 + Math.max(0, s) * 0.25, 0, 0],
    uaR: [s * 0.35, 0, -0.1], faR: [-0.3, 0, 0], uaL: [-0.42 - s * 0.12, 0, 0.2], faL: [-1.2, 0, 0],
    hips: [0, s * 0.1, 0], spine: [0.03, -s * 0.06, 0], chest: [0.02, -s * 0.1, 0], head: [-0.02, s * 0.05, 0], hdL: [-0.25, 0.457, 0.12],
  }, -Math.abs(c) * 0.025);
}
const POSES: Record<string, Pose> = { idle: IDLE, sling: SPIN, walk: walkPose(0.9), rest: pose({}) };

let human: HumanModel;
let mixer: PoseMixer;
const staff = new THREE.Group();

async function main() {
  const t0 = performance.now();
  human = await HumanModel.load({ preset, quality: q, seed, geometry: (P.get('geo') as 'base' | 'sub1') ?? undefined, textureSize: P.has('tex') ? (parseInt(P.get('tex')!, 10) as 1024 | 2048) : undefined });
  const matMode = P.get('mat');
  if (matMode === 'clay') {
    human.body.material = new THREE.MeshStandardMaterial({ color: 0xb9aea4, roughness: 0.62, metalness: 0 });
  } else if (matMode === 'grey') {
    // skin shader (normal map, detail, SSS) on a flat grey albedo: judge the relief only
    const grey = new THREE.DataTexture(new Uint8Array([176, 166, 158, 255]), 1, 1);
    grey.colorSpace = THREE.SRGBColorSpace;
    grey.needsUpdate = true;
    human.skin.map = grey; // keep USE_MAP (the mask shares its uv)
  } else if (matMode) {
    const t = matMode === 'albedo' ? human.skin.map : matMode === 'normal' ? human.skin.normalMap : human.skin.skinUniforms.uMaskMap.value;
    human.body.material = new THREE.MeshBasicMaterial({ map: t });
  }
  const loadMs = performance.now() - t0;
  scene.add(human.root);
  // ?crowd=N: load N extra seeded 'man' instances (same quality) to measure the cached per-preset CPU work
  if (P.has('crowd')) {
    const n = parseInt(P.get('crowd')!, 10) || 3;
    const times: string[] = [];
    for (let i = 0; i < n; i++) {
      const t1 = performance.now();
      const m = await HumanModel.load({ preset: 'man', quality: q, seed: 20 + i });
      times.push((performance.now() - t1).toFixed(0));
      m.root.position.set((i - (n - 1) / 2) * 0.8, 0, -1.6 - (i % 2) * 0.6);
      m.update(0, camera, H);
      scene.add(m.root);
    }
    console.log(`crowd: ${n} x man (${q}) load ms = ${times.join(', ')}`);
  }
  (window as unknown as { __human: HumanModel }).__human = human;
  human.root.rotation.y = THREE.MathUtils.degToRad(yawDeg);
  mixer = new PoseMixer(human.joints);
  const pz = POSES[poseName] ?? IDLE;
  mixer.reset();
  mixer.layer(pz, 1);
  mixer.apply();
  human.joints.hips.position.y = human.rig.hipHeight + (mixer.cur.hipsY ?? 0);
  human.joints.hips.position.z = human.rig.pelvis.z + (mixer.cur.hipsZ ?? 0);
  const fingersL = (P.get('fl') ?? (poseName === 'sling' || poseName === 'idle' || poseName === 'walk' ? 'grip' : 'relaxed')) as FingerPose;
  const fingersR = (P.get('fr') ?? (poseName === 'sling' ? 'fist' : 'relaxed')) as FingerPose;
  human.rig.setFingers('L', fingersL);
  human.rig.setFingers('R', fingersR);
  human.rig.setExpression(expr, 1);
  human.rig.blinkEnabled = false;
  human.setPupil(0.2);
  if (P.has('dqs')) human.dqs.enabled = parseFloat(P.get('dqs')!);
  if (P.has('dqf')) {
    // tuning: dqf=clavicle,shoulder01,upperarm,spine
    const [fc, fs, fu, fsp] = P.get('dqf')!.split(',').map(Number);
    human.dqs.setFactors((n) => (/^clavicle/.test(n) ? fc : /^shoulder01/.test(n) ? fs : /^upperarm0[12]/.test(n) ? fu : /^spine0/.test(n) && fsp !== undefined ? fsp : defaultDQSFactor(n)));
  }
  if (P.get('shadow') === '0') human.root.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  if (P.has('lids')) {
    // resting lid bias: upper-lid closure, lower-lid raise
    const [uc, lu] = P.get('lids')!.split(',').map(Number);
    const fb = human.rig.faceBias;
    fb.LeftUpperLidClosed = fb.RightUpperLidClosed = uc;
    fb.LeftLowerLidUp = fb.RightLowerLidUp = lu;
  }
  if (P.has('face')) {
    // direct pose units, e.g. face=JawDrop:0.2,LeftCheekUp:0.3
    for (const kv of P.get('face')!.split(',')) {
      const [k, v] = kv.split(':');
      human.rig.faceUnits[k] = parseFloat(v);
    }
  }
  if (P.has('look')) {
    const [x, y, z] = P.get('look')!.split(',').map(Number);
    human.rig.lookTarget = new THREE.Vector3(x, y, z);
  }
  // staff in the left hand (grip socket: staff along ±Y)
  if (fingersL === 'grip' && P.get('staff') !== '0') {
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.7 });
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.02, 1.7, 16), wood);
    cyl.position.y = -0.35;
    cyl.castShadow = true;
    staff.add(cyl);
    human.sockets.handGripL.add(staff);
  }
  // clothing API smoke test: a simple tube "skirt" modelled around the rest pose
  if (P.has('cloth')) {
    const tube = new THREE.CylinderGeometry(0.19, 0.25, 0.5, 48, 16, true);
    tube.scale(1, 1, 0.78);
    tube.translate(0, 0.8, 0.0);
    const cloth = human.skinAttachment(tube, new THREE.MeshStandardMaterial({ color: 0xd8cbb0, roughness: 0.95, side: THREE.DoubleSide }), {
      space: 'rest', boneFilter: (b) => !/arm|wrist|finger|metacarpal|shoulder|clavicle/.test(b),
    });
    cloth.name = 'testSkirt';
    human.hideSkin((p, bone) => p.y > 0.64 && p.y < 0.98 && /^(root|spine0[45]|pelvis|upperleg)/.test(bone));
  }
  // settle (fingers / expressions cross-fade)
  for (let i = 0; i < 90; i++) human.update(1 / 30, camera, H);
  // staff held upright (default with the grip): rotate the left hand proxy by the smallest rotation that makes the
  // staff vertical, and log the resulting hdL Euler (character axes) — the value to put into the game's poses
  if (fingersL === 'grip' && P.get('staff') !== '0' && P.get('staffUp') !== '0') {
    const hd = human.joints.hdL;
    const down = new THREE.Vector3(0, -1, 0);
    for (let it = 0; it < 3; it++) {
      human.root.updateMatrixWorld(true);
      const d = down.clone().applyQuaternion(human.sockets.handGripL.getWorldQuaternion(new THREE.Quaternion()));
      const qc = new THREE.Quaternion().setFromUnitVectors(d, down);
      const pq = hd.parent!.getWorldQuaternion(new THREE.Quaternion());
      hd.quaternion.premultiply(pq.clone().invert().multiply(qc).multiply(pq));
      for (let i = 0; i < 3; i++) human.update(1 / 30, camera, H);
    }
    const e = hd.rotation;
    console.log(`staff upright: hdL = [${e.x.toFixed(3)}, ${e.y.toFixed(3)}, ${e.z.toFixed(3)}] (${e.order}) for pose ${poseName}`);
    (window as unknown as { __staffHand: number[] }).__staffHand = [e.x, e.y, e.z];
  }
  const frames = parseInt(P.get('frames') ?? '3', 10);
  let out: HTMLCanvasElement | null = null;
  if (VIEWS.length > 1) {
    out = document.createElement('canvas');
    out.width = W * VIEWS.length;
    out.height = H;
    renderer.domElement.style.display = 'none';
    document.body.appendChild(out);
  }
  for (let v = 0; v < VIEWS.length; v++) {
    frameCamera(VIEWS[v]);
    for (let i = 0; i < frames; i++) renderOnce();
    if (out) out.getContext('2d')!.drawImage(renderer.domElement, v * W, 0);
  }
  info.textContent = `${preset} q=${q} verts=${human.metrics.vertices} tris=${human.metrics.triangles} load=${loadMs.toFixed(0)}ms`;
  (window as unknown as { __info: unknown }).__info = { loadMs, verts: human.metrics.vertices, tris: human.metrics.triangles, metrics: human.metrics };
  (window as unknown as { __ready: boolean }).__ready = true;
  if (P.has('live')) {
    const clock = new THREE.Clock();
    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      if (poseName === 'walk') {
        mixer.reset();
        mixer.layer(walkPose(performance.now() / 1000 * 4), 1);
        mixer.apply();
      }
      human.update(dt, camera, H);
      renderOnce(dt);
      requestAnimationFrame(loop);
    };
    human.rig.blinkEnabled = true;
    loop();
  }
}

function frameCamera(v: string) {
  const r = human.root;
  r.updateMatrixWorld(true);
  const head = new THREE.Vector3();
  human.sockets.eyeL.getWorldPosition(head);
  const eyeR = new THREE.Vector3();
  human.sockets.eyeR.getWorldPosition(eyeR);
  head.add(eyeR).multiplyScalar(0.5);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(r.quaternion);
  const left = new THREE.Vector3(1, 0, 0).applyQuaternion(r.quaternion);
  const h = human.metrics.height;
  const at = (target: THREE.Vector3, dir: THREE.Vector3, dist: number, fov: number) => {
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.position.copy(target).addScaledVector(dir.normalize(), dist);
    camera.lookAt(target);
  };
  const up = new THREE.Vector3(0, 1, 0);
  switch (v) {
    case 'face': at(head.clone().add(new THREE.Vector3(0, -0.035, 0)), fwd.clone().addScaledVector(left, 0.18).addScaledVector(up, 0.02), 0.62, 24); break;
    case 'front': at(head.clone().add(new THREE.Vector3(0, -0.035, 0)), fwd.clone(), 0.62, 24); break;
    case 'eye': at(head.clone(), fwd.clone().addScaledVector(left, 0.25), 0.22, 22); break;
    case 'three4': at(head.clone().add(new THREE.Vector3(0, -0.07, 0)), fwd.clone().addScaledVector(left, 0.8).addScaledVector(up, 0.06), 0.95, 26); break;
    case 'three4r': at(head.clone().add(new THREE.Vector3(0, -0.07, 0)), fwd.clone().addScaledVector(left, -0.8).addScaledVector(up, 0.06), 0.95, 26); break;
    case 'profile': at(new THREE.Vector3(0, h * 0.52, 0).add(r.position), left.clone(), 5.2, 28); break;
    case 'profileFace': at(head.clone().add(new THREE.Vector3(0, -0.03, 0)), left.clone(), 0.7, 24); break;
    case 'back': at(new THREE.Vector3(0, h * 0.52, 0).add(r.position), fwd.clone().negate(), 5.2, 28); break;
    case 'legs': at(new THREE.Vector3(0, h * 0.2, 0).add(r.position), fwd.clone().addScaledVector(left, 0.6).addScaledVector(up, 0.1), 1.9, 30); break;
    case 'feet': at(new THREE.Vector3(0, 0.08, 0.04).add(r.position), fwd.clone().addScaledVector(left, 0.5).addScaledVector(up, 0.5), 0.9, 30); break;
    case 'arm': { const ap = new THREE.Vector3(); human.bones['lowerarm02.L'].getWorldPosition(ap); at(ap, fwd.clone().addScaledVector(left, 1.4).addScaledVector(up, 0.1), 0.75, 30); break; }
    case 'shoulderF': { const sp = new THREE.Vector3(); human.bones['upperarm01.R'].getWorldPosition(sp); at(sp, fwd.clone().addScaledVector(left, -0.3).addScaledVector(up, 0.05), 1.0, 34); break; }
    case 'shoulderR': { const sp = new THREE.Vector3(); human.bones['upperarm01.R'].getWorldPosition(sp); at(sp, fwd.clone().addScaledVector(left, -0.9).addScaledVector(up, 0.2), 1.0, 30); break; }
    case 'torso': at(new THREE.Vector3(0, h * 0.7, 0).add(r.position), fwd.clone().addScaledVector(left, 0.35), 2.0, 30); break;
    case 'hands': {
      const hp = new THREE.Vector3();
      const side = P.get('hand') ?? 'L';
      human.bones[`wrist.${side}`].getWorldPosition(hp);
      hp.y -= 0.06;
      at(hp, fwd.clone().addScaledVector(left, side === 'L' ? 1.2 : -1.2), 0.42, 28);
      break;
    }
    case 'grip': {
      const hp = new THREE.Vector3();
      human.sockets.handGripL.getWorldPosition(hp);
      const az = THREE.MathUtils.degToRad(parseFloat(P.get('az') ?? '60'));
      const dir = fwd.clone().multiplyScalar(Math.cos(az)).addScaledVector(left, Math.sin(az)).addScaledVector(up, parseFloat(P.get('el') ?? '0.2'));
      at(hp, dir, 0.32, 30);
      break;
    }
    case 'posed': at(new THREE.Vector3(0, h * 0.58, 0).add(r.position), fwd.clone().addScaledVector(left, 0.55), 4.6, 32); break;
    default: at(new THREE.Vector3(0, h * 0.52, 0).add(r.position), fwd.clone(), 5.2, 28);
  }
  shared.uCamPos.value.copy(camera.position);
  if (studioLights) {
    // key: camera-left, above; rim: behind, camera-right (fixed relative to the view)
    const f = new THREE.Vector3().subVectors(camera.position, head).setY(0).normalize();
    const side = new THREE.Vector3(f.z, 0, -f.x); // camera right
    const tgt = v === 'full' || v === 'profile' || v === 'back' || v === 'posed' || v === 'legs' || v === 'feet' || v === 'arm' ? new THREE.Vector3(0, v === 'legs' || v === 'feet' ? h * 0.15 : h * 0.5, 0) : head;
    studioLights.key.position.copy(tgt).addScaledVector(f, 2.2).addScaledVector(side, -2.0).add(new THREE.Vector3(0, 1.9, 0));
    studioLights.key.target.position.copy(tgt);
    studioLights.rim.position.copy(tgt).addScaledVector(f, -2.5).addScaledVector(side, 1.8).add(new THREE.Vector3(0, 1.2, 0));
    studioLights.rim.target.position.copy(tgt);
    const sc = studioLights.key.shadow.camera;
    const ext = v === 'full' || v === 'profile' || v === 'back' || v === 'posed' || v === 'legs' || v === 'arm' ? 1.3 : v === 'feet' ? 0.5 : 0.35;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
    sc.updateProjectionMatrix();
    studioLights.key.target.updateMatrixWorld();
    studioLights.rim.target.updateMatrixWorld();
  }
}

function renderOnce(dt = 1 / 60) {
  shared.uTime.value += dt;
  shared.uCamPos.value.copy(camera.position);
  if (sky && post) {
    sky.update(camera, human.root.position.clone().add(new THREE.Vector3(0, 1, 0)));
    post.render(dt);
  } else renderer.render(scene, camera);
}

(window as unknown as { __render: (n: number) => void }).__render = (n: number) => {
  for (let i = 0; i < n; i++) renderOnce();
};

main().catch((e) => {
  info.textContent = 'ERROR ' + (e?.stack ?? e);
  console.error(e);
  (window as unknown as { __error: string }).__error = String(e?.stack ?? e);
});
