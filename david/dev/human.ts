// Dev-only preview harness for src/characters/human (not part of the game build).
// /dev/human.html?preset=david|saul|man&pose=idle|walk|sling|rest&view=face|three4|full|profile|back|hands|posed
//               &q=high|medium|low&expr=neutral|determined|effort|awe|smile&seed=3&yaw=0&sun=13,100&frames=4
import * as THREE from 'three';
import { SkySystem } from '../src/world/Sky';
import { PostFX } from '../src/fx/PostFX';
import { shared } from '../src/core/Shared';
import { pose, PoseMixer, type Pose } from '../src/characters/Rig';
import { HumanModel } from '../src/characters/human/HumanModel';
import type { Expression, FingerPose } from '../src/characters/human/HumanRig';
import rockAlbedo from '../src/assets/textures/rock_albedo.jpg';
import rockNormal from '../src/assets/textures/rock_normal.jpg';

const P = new URLSearchParams(location.search);
const preset = P.get('preset') ?? 'david';
const poseName = P.get('pose') ?? 'idle';
const view = P.get('view') ?? 'three4';
const q = (P.get('q') ?? 'high') as 'low' | 'medium' | 'high';
const expr = (P.get('expr') ?? 'neutral') as Expression;
const seed = P.has('seed') ? parseInt(P.get('seed')!, 10) : undefined;
const yawDeg = parseFloat(P.get('yaw') ?? '0');
const [sunEl, sunAz] = (P.get('sun') ?? '13,100').split(',').map(Number);
const W = parseInt(P.get('w') ?? '0', 10) || innerWidth;
const H = parseInt(P.get('h') ?? '0', 10) || innerHeight;
const info = document.getElementById('info')!;

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, stencil: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = parseFloat(P.get('exposure') ?? '0.58');
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.02, 26000);
const sky = new SkySystem(renderer, q === 'high' ? 4096 : 2048);
scene.add(sky.group);
sky.setSun(sunEl, sunAz, scene);
// tight shadow frustum for close-ups
const sc = sky.sun.shadow.camera;
sc.left = -2.5; sc.right = 2.5; sc.top = 2.5; sc.bottom = -2.5;
sc.updateProjectionMatrix();
sky.sun.shadow.bias = -0.0002;
sky.sun.shadow.normalBias = 0.012;
sky.sun.shadow.radius = 2;

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
const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ map: ra, normalMap: rn, color: 0xe8dcc6, roughness: 0.92 }));
ground.receiveShadow = true;
scene.add(ground);

const post = new PostFX(renderer, scene, camera, sky.cubeTarget.texture, { msaa: q === 'low' ? 0 : 4, bloom: true, godRaySamples: 24, pixelRatio: 1 });
post.setSize(W, H);
post.atmosphere.uniforms.uDensity.value = 0.00012;

// ---- poses (DavidModel conventions)
const IDLE = pose({
  hips: [0, 0, 0.03], chest: [0.02, 0, 0], head: [-0.04, 0.08, 0],
  uaL: [-0.42, 0, 0.2], faL: [-1.2, 0, 0], hdL: [0.15, 0, 0],
  uaR: [0.04, 0, -0.1], faR: [-0.25, 0, 0], hdR: [0.0, 0, 0],
  thL: [-0.06, 0, 0.03], shinL: [0.08, 0, 0], ftL: [-0.02, 0, 0],
  thR: [0.09, 0, -0.04], shinR: [0.05, 0, 0], ftR: [-0.12, 0, 0],
});
const SPIN = pose({
  spine: [0, -0.12, 0], chest: [0.02, -0.3, 0], head: [0, 0.32, 0], neck: [0, 0.05, 0],
  uaR: [-2.75, 0, -0.35], faR: [-0.35, 0, 0], hdR: [0, 0, 0],
  uaL: [-1.25, 0, 0.3], faL: [-0.25, 0, 0], hdL: [0.1, 0, 0],
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
    hips: [0, s * 0.1, 0], spine: [0.03, -s * 0.06, 0], chest: [0.02, -s * 0.1, 0], head: [-0.02, s * 0.05, 0], hdL: [0.15, 0, 0],
  }, -Math.abs(c) * 0.025);
}
const POSES: Record<string, Pose> = { idle: IDLE, sling: SPIN, walk: walkPose(0.9), rest: pose({}) };

let human: HumanModel;
let mixer: PoseMixer;
const staff = new THREE.Group();

async function main() {
  const t0 = performance.now();
  human = await HumanModel.load({ preset, quality: q, seed, geometry: (P.get('geo') as 'base' | 'sub1') ?? undefined, textureSize: P.has('tex') ? (parseInt(P.get('tex')!, 10) as 1024 | 2048) : undefined });
  if (P.get('unlit')) {
    const which = P.get('unlit')!;
    const t = which === 'albedo' ? human.skin.map : which === 'normal' ? human.skin.normalMap : human.skin.skinUniforms.uMaskMap.value;
    human.body.material = new THREE.MeshBasicMaterial({ map: t });
  }
  const loadMs = performance.now() - t0;
  scene.add(human.root);
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
  // settle (fingers / expressions cross-fade)
  for (let i = 0; i < 90; i++) human.update(1 / 30, camera, H);
  frameCamera();
  info.textContent = `${preset} q=${q} verts=${human.metrics.vertices} tris=${human.metrics.triangles} load=${loadMs.toFixed(0)}ms`;
  (window as unknown as { __info: unknown }).__info = { loadMs, verts: human.metrics.vertices, tris: human.metrics.triangles, metrics: human.metrics };
  const frames = parseInt(P.get('frames') ?? '3', 10);
  for (let i = 0; i < frames; i++) renderOnce();
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

function frameCamera() {
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
  switch (view) {
    case 'face': at(head.clone().add(new THREE.Vector3(0, -0.035, 0)), fwd.clone().addScaledVector(left, 0.18).addScaledVector(up, 0.02), 0.62, 24); break;
    case 'eye': at(head.clone(), fwd.clone().addScaledVector(left, 0.25), 0.22, 22); break;
    case 'three4': at(head.clone().add(new THREE.Vector3(0, -0.16, 0)), fwd.clone().addScaledVector(left, 0.75).addScaledVector(up, 0.05), 1.25, 28); break;
    case 'profile': at(new THREE.Vector3(0, h * 0.52, 0).add(r.position), left.clone(), 5.2, 28); break;
    case 'profileFace': at(head.clone().add(new THREE.Vector3(0, -0.03, 0)), left.clone(), 0.7, 24); break;
    case 'back': at(new THREE.Vector3(0, h * 0.52, 0).add(r.position), fwd.clone().negate(), 5.2, 28); break;
    case 'hands': {
      const hp = new THREE.Vector3();
      human.bones['wrist.L'].getWorldPosition(hp);
      at(hp, fwd.clone().addScaledVector(left, 1.2), 0.55, 28);
      break;
    }
    case 'posed': at(new THREE.Vector3(0, h * 0.58, 0).add(r.position), fwd.clone().addScaledVector(left, 0.55), 4.6, 32); break;
    default: at(new THREE.Vector3(0, h * 0.52, 0).add(r.position), fwd.clone(), 5.2, 28);
  }
  shared.uCamPos.value.copy(camera.position);
}

function renderOnce(dt = 1 / 60) {
  shared.uTime.value += dt;
  shared.uCamPos.value.copy(camera.position);
  sky.update(camera, human.root.position.clone().add(new THREE.Vector3(0, 1, 0)));
  post.render(dt);
}

(window as unknown as { __render: (n: number) => void }).__render = (n: number) => {
  for (let i = 0; i < n; i++) renderOnce();
};

main().catch((e) => {
  info.textContent = 'ERROR ' + (e?.stack ?? e);
  console.error(e);
  (window as unknown as { __error: string }).__error = String(e?.stack ?? e);
});
