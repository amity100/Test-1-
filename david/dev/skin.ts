// Dev-only harness for skin / eyes close-ups (src/characters/human/SkinMaterial.ts, EyeModel.ts, src/fx/SSS.ts).
// /dev/skin.html?preset=david|saul&view=front|three4|profile|eye|ref|bust&light=sun|lamp|back&sss=0|1|2&hero=0|1
//   &old=1 (the previous look: no SSS, no region/freckle/capillary/lip layers, no iris caustic)
//   &dress=0 (bald, nude)  &q=high|medium|low  &w=&h=  &frames=N (TAA settle)  &expo=  &yaw= (turn the head, rad)
import * as THREE from 'three';
import { HumanModel } from '../src/characters/human/HumanModel';
import { createGroom } from '../src/characters/hair';
import { dressDavid, dressSaul } from '../src/characters/wardrobe';
import { PostFX } from '../src/fx/PostFX';
import { SkySystem } from '../src/world/Sky';
import { shared } from '../src/core/Shared';

const P = new URLSearchParams(location.search);
const preset = (P.get('preset') ?? 'david') as 'david' | 'saul';
const view = P.get('view') ?? 'three4';
const light = P.get('light') ?? 'sun';
const old = P.get('old') === '1';
const sssLevel = old ? 0 : (Number(P.get('sss') ?? '2') as 0 | 1 | 2);
const hero = !old && P.get('hero') !== '0';
const q = (P.get('q') ?? 'high') as 'low' | 'medium' | 'high';
const dress = P.get('dress') !== '0';
const W = Number(P.get('w') ?? 720), H = Number(P.get('h') ?? 720);
const frames = Number(P.get('frames') ?? 12);
const info = document.getElementById('info')!;

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, stencil: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = Number(P.get('expo') ?? (light === 'lamp' || light === 'earlamp' ? '0.7' : '0.58'));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.02, 26000);
const sky = new SkySystem(renderer, q === 'high' ? 4096 : 2048);
scene.add(sky.group);
// warm low sun from camera-left/front (sun) or behind the head (back); a night lamp scene (lamp)
const night = light === 'lamp' || light === 'earlamp';
const sunEl = light === 'back' ? 9 : night ? -12 : 13;
const sunAz = Number(P.get('az') ?? (light === 'back' ? 200 : 60));
sky.setSun(sunEl, sunAz, scene);
{
  const sc = sky.sun.shadow.camera;
  sc.left = -1.2; sc.right = 1.2; sc.top = 1.2; sc.bottom = -1.2;
  sc.updateProjectionMatrix();
  sky.sun.shadow.bias = -0.0002;
  sky.sun.shadow.normalBias = 0.008;
  sky.sun.shadow.radius = 2;
}
const lamps: THREE.PointLight[] = [];
if (night) {
  sky.sun.intensity = 0;
  sky.hemi.intensity = 0.06;
  scene.environmentIntensity = 0.05;
}
if (light === 'lamp') {
  // oil lamp in front / side (warm, low) and one behind the head (ear glow)
  const a = new THREE.PointLight(0xff9a48, 1.3, 6, 2);
  a.position.set(0.45, 1.45, 0.55);
  a.castShadow = true;
  a.shadow.mapSize.set(1024, 1024);
  a.shadow.bias = -0.0005;
  const b = new THREE.PointLight(0xffa860, 1.2, 5, 2);
  b.position.set(-0.25, 1.62, -0.5);
  lamps.push(a, b);
  scene.add(a, b);
}


const post = new PostFX(renderer, scene, camera, sky.cubeTarget.texture, {
  msaa: 0, bloom: true, godRaySamples: 16, pixelRatio: 1, taa: 'hq', sharpen: 0.25, filmFx: false, sss: sssLevel,
});
post.setSize(W, H);
post.atmosphere.uniforms.uDensity.value = 0.00005;

const t0 = performance.now();
const human = await HumanModel.load({ preset, quality: q });
scene.add(human.root);
let groom: Awaited<ReturnType<typeof createGroom>> | null = null;
if (dress) {
  if (preset === 'saul') await dressSaul(human, { quality: q });
  else await dressDavid(human, { quality: q });
  const [rx, rz] = human.metrics.crownRadius;
  const headband = preset === 'saul' ? { height: 0, radius: [rx + 0.0078, rz + 0.0078] as [number, number], width: 0.017, tilt: 0.008 } : undefined;
  try {
    groom = await createGroom(human, preset, { quality: q, msaa: 0, headband, simulate: false });
  } catch (e) {
    console.warn('groom failed', e);
  }
}
const loadMs = performance.now() - t0;
human.rig.blinkEnabled = false;
human.rig.lipSeal = 0.35;
human.setPupil(light === 'lamp' ? 0.75 : 0.25);
let heroGeoMs = 0;
if (hero && P.get('heroGeo') === '1') {
  const t = performance.now();
  human.prepareHeroGeometry();
  heroGeoMs = Math.round(performance.now() - t);
}
human.setHero(hero ? 1 : 0);
if (old) {
  const u = human.skin.skinUniforms;
  u.uFreckles.value = 0;
  u.uSunSpots.value = 0;
  u.uRuddy.value = 0;
  u.uLipWet.value = 0;
  for (const S of ['L', 'R'] as const) human.eyes[S].material.eyeUniforms.uCaustic.value = 0;
}
if (light === 'earlamp') {
  // a lamp just behind the left ear (the ear flap is between it and a side-front camera): transmission test
  human.root.updateMatrixWorld(true);
  const e = new THREE.Vector3();
  human.sockets.eyeL.getWorldPosition(e);
  const b = new THREE.PointLight(0xffb070, 0.9, 3, 2);
  b.position.set(e.x + 0.1, e.y - 0.01, e.z - 0.22);
  const f = new THREE.PointLight(0xff9a50, 0.25, 4, 2);
  f.position.set(e.x + 0.5, e.y + 0.1, e.z + 0.5);
  scene.add(b, f);
}
const yaw = Number(P.get('yaw') ?? '0');
human.joints.head.rotation.y = yaw;
human.update(0.016, camera, H);

function frameCamera() {
  human.root.updateMatrixWorld(true);
  const head = new THREE.Vector3(), eR = new THREE.Vector3();
  human.sockets.eyeL.getWorldPosition(head);
  human.sockets.eyeR.getWorldPosition(eR);
  head.add(eR).multiplyScalar(0.5);
  const fwd = new THREE.Vector3(0, 0, 1), left = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3(0, 1, 0);
  const at = (target: THREE.Vector3, dir: THREE.Vector3, dist: number, fov: number) => {
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.position.copy(target).addScaledVector(dir.normalize(), dist);
    camera.lookAt(target);
  };
  switch (view) {
    case 'front': at(head.clone().add(new THREE.Vector3(0, -0.03, 0)), fwd.clone().addScaledVector(up, 0.02), 0.62, 24); break;
    case 'profile': at(head.clone().add(new THREE.Vector3(0.0, -0.03, 0.0)), left.clone().addScaledVector(fwd, 0.08), 0.62, 24); break;
    case 'profileR': at(head.clone().add(new THREE.Vector3(0.0, -0.03, 0.0)), left.clone().negate().addScaledVector(fwd, 0.08), 0.62, 24); break;
    case 'eye': at(head.clone().add(new THREE.Vector3(0.032, 0.0, 0)), fwd.clone().addScaledVector(left, 0.3), 0.2, 22); break;
    case 'ref': at(head.clone().add(new THREE.Vector3(0, -0.1, 0)), fwd.clone().addScaledVector(left, -0.35).addScaledVector(up, 0.03), 1.05, 26); break;
    case 'bust': at(head.clone().add(new THREE.Vector3(0, -0.16, 0)), fwd.clone().addScaledVector(left, 0.5), 1.6, 26); break;
    case 'back3': at(head.clone().add(new THREE.Vector3(0, -0.03, 0)), fwd.clone().negate().addScaledVector(left, 1.4), 0.7, 24); break;
    default: at(head.clone().add(new THREE.Vector3(0, -0.04, 0)), fwd.clone().addScaledVector(left, 0.75).addScaledVector(up, 0.05), 0.72, 24);
  }
}
frameCamera();
await renderer.compileAsync(scene, camera);

let n = 0;
const times: number[] = [];
function frame() {
  const dt = 1 / 60;
  shared.uTime.value += dt;
  shared.uCamPos.value.copy(camera.position);
  human.update(dt, camera, H);
  groom?.update(dt);
  sky.update(camera, human.root.position.clone().add(new THREE.Vector3(0, 1, 0)));
  const a = performance.now();
  post.render(dt);
  times.push(performance.now() - a);
  n++;
  if (n < frames) requestAnimationFrame(frame);
  else {
    const gl = renderer.getContext();
    gl.finish();
    info.textContent = '';
    const w = window as unknown as Record<string, unknown>;
    w.__stats = {
      preset, view, light, sss: sssLevel, hero, old, loadMs: Math.round(loadMs),
      frameMs: times.slice(-4).map((t) => t.toFixed(1)),
      tris: renderer.info.render.triangles, calls: renderer.info.render.calls,
      sssBytes: post.sss?.bytes ?? 0, postBytes: post.bytes, heroGeoMs, heroTris: human.heroTriangles,
      bodyTris: (human.body.geometry.getIndex()?.count ?? 0) / 3,
    };
    w.__ready = true;
  }
}
requestAnimationFrame(frame);
