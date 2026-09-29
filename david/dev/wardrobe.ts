// Dev-only preview harness for src/characters/wardrobe (not part of the game build).
//
// /dev/wardrobe.html?who=david|saul|guard|runner|servant|abner&q=high|medium|low&seed=3&mode=game|studio&sun=13,100
// Scripted use (Playwright): window.__W.shot({ pose, view, w, h, frames, yaw }) renders one frame into the canvas.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SkySystem } from '../src/world/Sky';
import { PostFX } from '../src/fx/PostFX';
import { shared } from '../src/core/Shared';
import { pose, PoseMixer, type Pose } from '../src/characters/Rig';
import { HumanModel } from '../src/characters/human/HumanModel';
import { dressDavid, dressSaul, dressMan, attachProp, type Outfit } from '../src/characters/wardrobe';
import { createGroom, type Groom, type Headband } from '../src/characters/hair';
import rockAlbedo from '../src/assets/textures/rock_albedo.jpg';
import rockNormal from '../src/assets/textures/rock_normal.jpg';

const P = new URLSearchParams(location.search);
const who = P.get('who') ?? 'david';
const q = (P.get('q') ?? 'high') as 'low' | 'medium' | 'high';
const mode = P.get('mode') ?? 'game';
const studio = mode === 'studio';
const seed = parseInt(P.get('seed') ?? '1', 10);
const [sunEl, sunAz] = (P.get('sun') ?? '14,110').split(',').map(Number);
let W = parseInt(P.get('w') ?? '720', 10);
let H = parseInt(P.get('h') ?? '900', 10);
const info = document.getElementById('info')!;

const renderer = new THREE.WebGLRenderer({ antialias: studio, preserveDrawingBuffer: true, stencil: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = parseFloat(P.get('exposure') ?? (studio ? '1.0' : '0.6'));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.02, 26000);
let sky: SkySystem | null = null;
let post: PostFX | null = null;
if (!studio) {
  sky = new SkySystem(renderer, q === 'high' ? 4096 : 2048);
  scene.add(sky.group);
  sky.setSun(sunEl, sunAz, scene);
  const sc = sky.sun.shadow.camera;
  sc.left = -2.2; sc.right = 2.2; sc.top = 2.4; sc.bottom = -1.6;
  sc.updateProjectionMatrix();
  sky.sun.shadow.bias = -0.0002;
  sky.sun.shadow.normalBias = 0.01;
  sky.sun.shadow.radius = 2;
  post = new PostFX(renderer, scene, camera, sky.cubeTarget.texture, { msaa: q === 'low' ? 0 : 4, bloom: true, godRaySamples: 16, pixelRatio: 1 });
  post.setSize(W, H);
  post.atmosphere.uniforms.uDensity.value = 0.00012;
} else {
  scene.background = new THREE.Color(0x2e3035);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  const key = new THREE.DirectionalLight(0xfff0dc, 3.0);
  key.position.set(-2, 3, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const kc = key.shadow.camera;
  kc.left = -1.3; kc.right = 1.3; kc.top = 2.2; kc.bottom = -0.2;
  scene.add(key, new THREE.HemisphereLight(0xc8d2e0, 0x3b322c, 0.6));
}

// ground
const tl = new THREE.TextureLoader();
const ra = tl.load(rockAlbedo);
ra.colorSpace = THREE.SRGBColorSpace;
const rn = tl.load(rockNormal);
for (const t of [ra, rn]) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 24);
  t.anisotropy = 8;
}
const gGeo = new THREE.PlaneGeometry(60, 60, 8, 8);
gGeo.rotateX(-Math.PI / 2);
const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ map: ra, normalMap: rn, color: studio ? 0x6a6560 : 0xe8dcc6, roughness: 0.92 }));
ground.receiveShadow = true;
scene.add(ground);

// ---- poses (DavidModel conventions: x<0 swings a limb forward; left arm z>0 = out, right arm z<0 = out)
const POSES: Record<string, Pose> = {
  rest: pose({}),
  // the reference still: staff planted in the right hand, sling hanging from the left, weight on the left leg
  ref: pose({
    hips: [0, 0.05, 0.02], chest: [0.02, -0.05, 0], neck: [0, 0.1, 0], head: [-0.06, 0.28, 0],
    uaR: [-0.3, 0, -0.42], faR: [-1.25, 0, 0], hdR: [0.05, 0, -0.35],
    uaL: [-0.12, 0, 0.12], faL: [-0.55, 0, 0], hdL: [0.1, 0, 0],
    thL: [-0.05, 0, 0.03], shinL: [0.06, 0, 0], ftL: [0, 0, 0],
    thR: [0.1, 0, -0.08], shinR: [0.12, 0, 0], ftR: [-0.12, 0, 0],
  }),
  walk: walkPose(Math.PI / 2),
  walk2: walkPose(0.6),
  run: runPose(Math.PI / 2),
  crouch: pose({
    hips: [0.35, 0, 0], spine: [0.3, 0, 0], chest: [0.2, 0, 0], head: [0.15, 0, 0],
    thL: [-1.75, 0, 0.15], shinL: [2.25, 0, 0], ftL: [-0.45, 0, 0],
    thR: [-1.05, 0, -0.1], shinR: [2.4, 0, 0], ftR: [-1.2, 0, 0],
    uaR: [-0.95, 0, -0.12], faR: [-0.35, 0, 0], hdR: [0.2, 0, 0],
    uaL: [-0.5, 0, 0.35], faL: [-1.2, 0, 0],
  }, -0.5, -0.06),
  kneel: pose({
    hips: [0.05, 0, 0], spine: [0.05, 0, 0],
    thL: [-1.5, 0, 0.1], shinL: [1.55, 0, 0], ftL: [0.0, 0, 0],
    thR: [0.05, 0, -0.05], shinR: [1.62, 0, 0], ftR: [0.6, 0, 0],
    uaL: [-0.4, 0, 0.1], faL: [-0.9, 0, 0], uaR: [-0.2, 0, -0.1], faR: [-0.5, 0, 0],
  }, -0.47, 0),
  sling: pose({
    spine: [0, -0.1, 0], chest: [0.03, -0.22, 0], head: [-0.05, 0.26, 0], neck: [0, 0.06, 0],
    uaR: [-2.45, 0, -0.55], faR: [-0.75, 0, 0], hdR: [0.1, 0, 0],
    uaL: [-0.42, 0, 0.2], faL: [-1.2, 0, 0], hdL: [0.15, 0, 0],
    thL: [-0.2, 0, 0.08], shinL: [0.15, 0, 0], ftL: [0.05, 0, 0],
    thR: [0.25, 0, -0.08], shinR: [0.1, 0, 0], ftR: [-0.3, 0, 0],
  }),
  // Saul: standing with the spear grounded at his right side
  king: pose({
    chest: [-0.03, 0, 0], head: [-0.04, 0.12, 0],
    uaR: [-0.22, 0, -0.3], faR: [-1.15, 0, 0], hdR: [0.0, 0, -0.25],
    uaL: [0.05, 0, 0.1], faL: [-0.2, 0, 0],
    thL: [-0.04, 0, 0.05], shinL: [0.05, 0, 0], thR: [0.05, 0, -0.06], shinR: [0.06, 0, 0], ftR: [-0.06, 0, 0],
  }),
};
function walkPose(ph: number): Pose {
  const s = Math.sin(ph), c = Math.cos(ph), A = 0.46;
  const kneeL = Math.max(0, c) * 0.95 + 0.12, kneeR = Math.max(0, -c) * 0.95 + 0.12;
  return pose({
    thL: [-s * A, 0, 0.02], shinL: [kneeL, 0, 0], ftL: [-(-s * A + kneeL) * 0.55 + Math.max(0, -s) * 0.25, 0, 0],
    thR: [s * A, 0, -0.02], shinR: [kneeR, 0, 0], ftR: [-(s * A + kneeR) * 0.55 + Math.max(0, s) * 0.25, 0, 0],
    uaR: [s * 0.35, 0, -0.1], faR: [-0.3, 0, 0], uaL: [-s * 0.35, 0, 0.1], faL: [-0.3, 0, 0],
    hips: [0, s * 0.1, 0], spine: [0.03, -s * 0.06, 0], chest: [0.02, -s * 0.1, 0], head: [-0.02, s * 0.05, 0],
  }, -Math.abs(c) * 0.025);
}
function runPose(ph: number): Pose {
  const s = Math.sin(ph), A = 0.85;
  return pose({
    thL: [-s * A - 0.2, 0, 0.03], shinL: [0.6 + Math.max(0, s) * 0.9, 0, 0], ftL: [-0.3, 0, 0],
    thR: [s * A * 0.6 + 0.1, 0, -0.03], shinR: [1.2, 0, 0], ftR: [0.3, 0, 0],
    uaR: [s * 0.8, 0, -0.15], faR: [-1.3, 0, 0], uaL: [-s * 0.8, 0, 0.15], faL: [-1.3, 0, 0],
    hips: [0.12, s * 0.12, 0], spine: [0.12, 0, 0], chest: [0.06, -s * 0.15, 0],
  }, -0.06);
}

let human: HumanModel;
let outfit: Outfit;
let slingGroup: THREE.Group | null = null;
let groom: Groom | null = null;
let mixer: PoseMixer;
const velocity = new THREE.Vector3();
const wind = new THREE.Vector3(0.6, 0, 0.2);

function applyPose(name: string) {
  mixer.reset();
  mixer.layer(POSES[name] ?? POSES.rest, 1);
  mixer.apply();
  human.joints.hips.position.y = human.rig.hipHeight + (mixer.cur.hipsY ?? 0);
  human.joints.hips.position.z = human.rig.pelvis.z + (mixer.cur.hipsZ ?? 0);
}

async function main() {
  const t0 = performance.now();
  const preset = who === 'david' ? 'david' : who === 'saul' ? 'saul' : 'man';
  human = await HumanModel.load({ preset, quality: q, seed: preset === 'man' ? seed : undefined });
  const t1 = performance.now();
  if (who === 'david') outfit = await dressDavid(human, { quality: q });
  else if (who === 'saul') outfit = await dressSaul(human, { quality: q });
  else outfit = await dressMan(human, { quality: q, role: who as 'guard' | 'runner' | 'servant' | 'abner', seed });
  const t2 = performance.now();
  if (P.get('hair') !== '0') {
    // strand hair / beard (same headband numbers as the court cast / DavidModel)
    const [rx, rz] = human.metrics.crownRadius;
    let headband: Headband | undefined;
    if (who === 'saul') headband = { height: 0, radius: [rx + 0.0078, rz + 0.0078], width: 0.017, tilt: 0.008 };
    else if (who !== 'david' && who !== 'servant') headband = { height: 0, radius: [rx + 0.007, rz + 0.007], width: who === 'abner' ? 0.022 : 0.02 };
    const style = who === 'david' ? 'david' as const : who === 'saul' ? 'saul' as const : { kind: 'man' as const, seed, beard: (P.get('beard') ?? 'full') as 'none' | 'short' | 'full', headband: !!headband };
    groom = await createGroom(human, style, { quality: q, msaa: q === 'low' ? 0 : 4, headband });
    groom.setSimulation(false);
  }
  scene.add(human.root);
  human.root.position.y = outfit.groundOffset;
  mixer = new PoseMixer(human.joints);
  human.rig.blinkEnabled = false;
  human.setPupil(0.2);
  // props in hands
  const pr = outfit.props;
  if (pr.staff) {
    attachProp(pr.staff, human.sockets.handGripR);
    human.setGripRadius(pr.staff.object.userData.radiusAtGrip ?? 0.02);
    human.rig.setFingers('R', 'grip');
  }
  if (pr.spear) {
    attachProp(pr.spear, human.sockets.handGripR);
    human.setGripRadius(pr.spear.object.userData.radiusAtGrip ?? 0.016);
    human.rig.setFingers('R', 'grip');
  }
  if (pr.slingPouch && pr.slingCordMaterial) {
    // sling hanging from the left hand: two cords (static polyline tubes for the preview)
    const pouch = pr.slingPouch;
    const grp = new THREE.Group();
    scene.add(grp);
    slingGroup = grp;
    pouch.position.set(0.0, -0.5, 0.03);
    pouch.rotation.set(0, 0, Math.PI / 2);
    grp.add(pouch);
    for (const dz of [-0.03, 0.03]) {
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.004, -0.25, dz * 0.4), new THREE.Vector3(0, -0.5 + 0.045, dz * 0.15 + 0.03)];
      const c = new THREE.CatmullRomCurve3(pts);
      const g = new THREE.TubeGeometry(c, 40, 0.0028, 6, false);
      const m = new THREE.Mesh(g, pr.slingCordMaterial);
      m.castShadow = true;
      grp.add(m);
    }
    human.rig.setFingers('L', 'fist');
  }
  if (pr.shield) {
    human.sockets.palmL.add(pr.shield);
    pr.shield.position.set(0.02, 0, 0.08);
    pr.shield.rotation.set(0, -Math.PI / 2, 0);
  }
  applyPose('rest');
  for (let i = 0; i < 60; i++) human.update(1 / 30, camera, H);
  (window as unknown as { __W: unknown }).__W = api;
  const st = outfit.stats;
  const s = `${who} q=${q} human ${(t1 - t0).toFixed(0)}ms dress ${(t2 - t1).toFixed(0)}ms tris=${st.triangles} calls=${st.drawCalls}`;
  info.textContent = P.has('hud') ? s : '';
  (window as unknown as { __info: unknown }).__info = { humanMs: t1 - t0, dressMs: t2 - t1, stats: st, bodyTris: human.metrics.triangles };
  (window as unknown as { __ready: boolean }).__ready = true;
}

function frameCamera(v: string, yawDeg = 0) {
  const r = human.root;
  r.updateMatrixWorld(true);
  const h = human.metrics.height;
  const ang = THREE.MathUtils.degToRad(yawDeg);
  const fwd = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
  const left = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang));
  const up = new THREE.Vector3(0, 1, 0);
  const at = (target: THREE.Vector3, dir: THREE.Vector3, dist: number, fov: number) => {
    camera.fov = fov;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    camera.position.copy(target).addScaledVector(dir.normalize(), dist);
    camera.lookAt(target);
  };
  const bone = (n: string) => human.bones[n].getWorldPosition(new THREE.Vector3());
  const head = bone('head');
  switch (v) {
    case 'front': at(new THREE.Vector3(0, h * 0.5, 0), fwd.clone().addScaledVector(up, 0.04), 5.0, 26); break;
    case 'three4': at(new THREE.Vector3(0, h * 0.5, 0), fwd.clone().addScaledVector(left, 0.7).addScaledVector(up, 0.04), 5.0, 26); break;
    case 'three4r': at(new THREE.Vector3(0, h * 0.5, 0), fwd.clone().addScaledVector(left, -0.7).addScaledVector(up, 0.04), 5.0, 26); break;
    case 'back': at(new THREE.Vector3(0, h * 0.5, 0), fwd.clone().negate().addScaledVector(up, 0.04), 5.0, 26); break;
    case 'profile': at(new THREE.Vector3(0, h * 0.5, 0), left.clone().addScaledVector(up, 0.04), 5.0, 26); break;
    case 'profileR': at(new THREE.Vector3(0, h * 0.5, 0), left.clone().negate().addScaledVector(up, 0.04), 5.0, 26); break;
    case 'low': at(new THREE.Vector3(0, h * 0.62, 0), fwd.clone().addScaledVector(left, 0.45).addScaledVector(up, -0.28), 4.2, 34); break;
    case 'posed': at(new THREE.Vector3(0, h * 0.42, 0), fwd.clone().addScaledVector(left, 0.8).addScaledVector(up, 0.12), 4.2, 30); break;
    case 'posedR': at(new THREE.Vector3(0, h * 0.42, 0), fwd.clone().addScaledVector(left, -0.8).addScaledVector(up, 0.12), 4.2, 30); break;
    case 'vneck': at(head.clone().add(new THREE.Vector3(0, -0.2, 0.05)), fwd.clone().addScaledVector(left, 0.25).addScaledVector(up, 0.1), 0.85, 30); break;
    case 'torso': at(new THREE.Vector3(0, h * 0.68, 0.02), fwd.clone().addScaledVector(left, 0.35).addScaledVector(up, 0.05), 1.6, 30); break;
    case 'sash': at(bone('spine04').add(new THREE.Vector3(0.02, -0.08, 0.1)), fwd.clone().addScaledVector(left, 0.3), 0.95, 30); break;
    case 'satchel': at(bone('pelvis.L').add(new THREE.Vector3(0.12, -0.05, 0.05)), fwd.clone().addScaledVector(left, 1.3).addScaledVector(up, 0.12), 0.95, 30); break;
    case 'sandals': at(new THREE.Vector3(0, 0.1, 0.05), fwd.clone().addScaledVector(left, 0.45).addScaledVector(up, 0.35), 0.95, 30); break;
    case 'hem': at(new THREE.Vector3(0, h * 0.33, 0.05), fwd.clone().addScaledVector(left, -0.35).addScaledVector(up, 0.05), 1.1, 30); break;
    case 'portrait': at(head.clone().add(new THREE.Vector3(0, -0.12, 0.02)), fwd.clone().addScaledVector(left, 0.35).addScaledVector(up, -0.05), 1.25, 30); break;
    case 'bust': at(head.clone().add(new THREE.Vector3(0, -0.3, 0.02)), fwd.clone().addScaledVector(left, 0.2).addScaledVector(up, 0.02), 2.0, 30); break;
    case 'head': at(head.clone().add(new THREE.Vector3(0, 0.05, 0.02)), fwd.clone().addScaledVector(left, 0.5).addScaledVector(up, 0.08), 0.8, 30); break;
    case 'arm': at(bone('upperarm02.L').add(new THREE.Vector3(0, 0, 0)), left.clone().addScaledVector(fwd, 0.6).addScaledVector(up, 0.1), 0.9, 30); break;
    case 'belt': at(bone('spine04').add(new THREE.Vector3(0.05, -0.1, 0.05)), fwd.clone().addScaledVector(left, 0.7), 1.1, 30); break;
    case 'prop': {
      const o = (outfit.props.spear ?? outfit.props.staff)?.tip;
      const p = o ? o.getWorldPosition(new THREE.Vector3()) : head;
      at(p.add(new THREE.Vector3(0, -0.12, 0)), fwd.clone().addScaledVector(left, 0.5), 0.8, 30);
      break;
    }
    default: at(new THREE.Vector3(0, h * 0.5, 0), fwd.clone(), 5.0, 26);
  }
  shared.uCamPos.value.copy(camera.position);
}

function renderOnce(dt = 1 / 60) {
  shared.uTime.value += dt;
  shared.uCamPos.value.copy(camera.position);
  if (sky && post) {
    sky.update(camera, human.root.position.clone().add(new THREE.Vector3(0, 1, 0)));
    post.render(dt);
  } else renderer.render(scene, camera);
}

const api = {
  renderer,
  get outfit() { return outfit; },
  get human() { return human; },
  shot(o: { pose?: string; view?: string; w?: number; h?: number; frames?: number; yaw?: number; settle?: number; vel?: [number, number, number] }) {
    if (o.w && o.h && (o.w !== W || o.h !== H)) {
      W = o.w;
      H = o.h;
      renderer.setSize(W, H);
      post?.setSize(W, H);
    }
    applyPose(o.pose ?? 'rest');
    velocity.set(...(o.vel ?? [0, 0, 0]));
    outfit.resetDynamics();
    const n = o.settle ?? 45;
    for (let i = 0; i < n; i++) {
      human.update(1 / 30, camera, H);
      outfit.update(1 / 30, { velocity, wind });
      groom?.update(1 / 30, wind);
    }
    if (slingGroup) {
      human.sockets.palmL.getWorldPosition(slingGroup.position);
      slingGroup.position.y -= 0.02;
    }
    frameCamera(o.view ?? 'front', o.yaw ?? 0);
    for (let i = 0; i < (o.frames ?? 2); i++) renderOnce();
    return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  },
};

main().catch((e) => {
  info.textContent = 'ERROR ' + (e?.stack ?? e);
  console.error(e);
  (window as unknown as { __error: string }).__error = String(e?.stack ?? e);
});
