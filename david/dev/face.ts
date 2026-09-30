// Dev-only harness for the face pass (hair length vs the reference, skin detail, eyes, face lighting).
// /dev/face.html?preset=david|saul|samuel&views=ref,front,profileR,back&light=sun|back|king|verdict&q=high|medium|low
//   &w=&h=&frames=N (TAA settle per view)  &ov={json overrides of the david scalp layer}  &ls=length scale
//   &hero=0|1  &sss=0|1|2  &dress=0  &face=goldenBack|afternoonKing|verdict (faceLight preset)  &film=1 (film look)
// Every view is captured from the canvas into window.__shots (dataURL) — one load, many angles.
import * as THREE from 'three';
import { HumanModel } from '../src/characters/human/HumanModel';
import { createGroom, type Groom } from '../src/characters/hair';
import { davidStyle } from '../src/characters/hair/styles';
import { dressDavid, dressSaul } from '../src/characters/wardrobe';
import { PostFX } from '../src/fx/PostFX';
import { SkySystem } from '../src/world/Sky';
import { shared } from '../src/core/Shared';
import { FaceLightRig, eyesMidpoint, type FaceLightPresetName } from '../src/film/cast/faceLight';

const P = new URLSearchParams(location.search);
const preset = (P.get('preset') ?? 'david') as 'david' | 'saul' | 'samuel';
const views = (P.get('views') ?? 'ref,front,profileR,back').split(',');
const light = P.get('light') ?? 'sun';
const sssLevel = Number(P.get('sss') ?? '2') as 0 | 1 | 2;
const hero = P.get('hero') !== '0';
const q = (P.get('q') ?? 'high') as 'low' | 'medium' | 'high';
const dress = P.get('dress') !== '0';
const W = Number(P.get('w') ?? 640), H = Number(P.get('h') ?? 640);
const frames = Number(P.get('frames') ?? 10);
const info = document.getElementById('info')!;

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, stencil: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = Number(P.get('expo') ?? '0.58');
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.02, 26000);
const sky = new SkySystem(renderer, q === 'high' ? 4096 : 2048);
scene.add(sky.group);
// sun: warm low sun from his front-left (the reference); back: golden-hour backlight (shot 16);
// king: late-afternoon high-side sun (shots 7/12); verdict: low sun from the side, behind Samuel (shot 11)
const sunEl = light === 'back' ? 7 : light === 'king' ? 24 : light === 'verdict' ? 11 : 13;
const sunAz = Number(P.get('az') ?? (light === 'back' ? 200 : light === 'king' ? 110 : light === 'verdict' ? 250 : 60));
sky.setSun(sunEl, sunAz, scene);
// &ws=1: keep the WORLD's shadow box (110 m, normalBias 3.5 cm — what the film's world takes use); default: a tight box
const worldShadow = P.get('ws') === '1';
if (!worldShadow) {
  const sc = sky.sun.shadow.camera;
  sc.left = -1.2; sc.right = 1.2; sc.top = 1.2; sc.bottom = -1.2;
  sc.updateProjectionMatrix();
  sky.sun.shadow.bias = -0.0002;
  sky.sun.shadow.normalBias = 0.008;
  sky.sun.shadow.radius = 2;
}

const post = new PostFX(renderer, scene, camera, sky.cubeTarget.texture, {
  msaa: 0, bloom: true, godRaySamples: 16, pixelRatio: 1, taa: 'hq', sharpen: 0.25, filmFx: P.get('film') === '1', sss: sssLevel,
});
post.setSize(W, H);
post.atmosphere.uniforms.uDensity.value = 0.00005;

const t0 = performance.now();
const human = await HumanModel.load({ preset, quality: q });
scene.add(human.root);
let groom: Groom | null = null;
if (dress) {
  if (preset === 'saul') await dressSaul(human, { quality: q });
  else if (preset === 'david') await dressDavid(human, { quality: q });
}
if (P.get('hair') !== '0') {
  try {
    if (preset === 'david') {
      const style = davidStyle();
      const ov = P.get('ov');
      const L = style.layers[0];
      if (ov) Object.assign(L, JSON.parse(ov));
      const ls = Number(P.get('ls') ?? '1');
      if (ls !== 1) {
        const base = L.length;
        L.length = (f, n, R) => base(f, n, R) * ls;
      }
      groom = await createGroom(human, { kind: 'custom', style, seed: 1201 }, { quality: q, msaa: 0, simulate: false });
    } else if (preset === 'saul') {
      const [rx, rz] = human.metrics.crownRadius;
      groom = await createGroom(human, 'saul', { quality: q, msaa: 0, simulate: false, headband: { height: 0, radius: [rx + 0.0078, rz + 0.0078], width: 0.017, tilt: 0.008 } });
    } else {
      groom = await createGroom(human, 'samuel', { quality: q, msaa: 0, simulate: false });
    }
  } catch (e) {
    console.warn('groom failed', e);
  }
}
const loadMs = performance.now() - t0;
const faceP = P.get('face') as FaceLightPresetName | null;
const rig = faceP ? new FaceLightRig({ quality: q }).addTo(scene) : null;
rig?.setPreset(faceP!, Number(P.get('fl') ?? '1'));
const _eyes = new THREE.Vector3();
human.rig.blinkEnabled = false;
if (P.get('nolash') === '1' && human.lashes) human.lashes.visible = false;
if (P.get('lashdbg') && human.lashes) {
  const m = human.lashes.material as THREE.MeshStandardMaterial;
  const ob = m.onBeforeCompile;
  const mode = P.get('lashdbg');
  m.onBeforeCompile = (sh, r) => {
    ob.call(m, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', mode === 'albedo' ? 'gl_FragColor = vec4( diffuseColor.rgb * 4.0, 1.0 );' : mode === 'normal' ? 'gl_FragColor = vec4( normal * 0.5 + 0.5, 1.0 );' : 'gl_FragColor = vec4( outgoingLight, 1.0 );');
  };
  m.customProgramCacheKey = () => 'lashdbg-' + mode;
  m.needsUpdate = true;
}
if (P.get('notear') === '1' && human.tearLines) human.tearLines.visible = false;
if (P.get('nobrow') === '1' && human.brows) human.brows.visible = false;
human.rig.lipSeal = 0.35;
human.setPupil(0.25);
human.setHero(hero ? 1 : 0);
const yaw = Number(P.get('yaw') ?? '0');
human.joints.head.rotation.y = yaw;
human.update(0.016, camera, H);


function frameCamera(view: string) {
  human.root.updateMatrixWorld(true);
  const head = new THREE.Vector3(), eR = new THREE.Vector3();
  human.sockets.eyeL.getWorldPosition(head);
  human.sockets.eyeR.getWorldPosition(eR);
  head.add(eR).multiplyScalar(0.5);
  const fwd = new THREE.Vector3(0, 0, 1), left = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3(0, 1, 0);
  const at = (target: THREE.Vector3, d: THREE.Vector3, dist: number, fov: number) => {
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.position.copy(target).addScaledVector(d.normalize(), dist);
    camera.lookAt(target);
  };
  const c = head.clone().add(new THREE.Vector3(0, -0.02, -0.03));
  switch (view) {
    case 'front': at(c, fwd.clone().addScaledVector(up, 0.03), 0.95, 24); break;
    case 'profileR': at(c, left.clone().negate().addScaledVector(fwd, 0.05), 0.95, 24); break;
    case 'profile': at(c, left.clone().addScaledVector(fwd, 0.05), 0.95, 24); break;
    case 'back': at(c, fwd.clone().negate().addScaledVector(up, 0.08), 0.95, 24); break;
    case 'back3': at(c, fwd.clone().negate().addScaledVector(left, -0.9).addScaledVector(up, 0.1), 0.95, 24); break;
    case 'eye': case 'blink': at(head.clone().add(new THREE.Vector3(0.032, 0.0, 0)), fwd.clone().addScaledVector(left, 0.3), 0.2, 22); break;
    case 'eyes': at(head.clone(), fwd.clone().addScaledVector(up, 0.02), 0.34, 22); break;
    case 'close': at(head.clone().add(new THREE.Vector3(0, -0.035, 0)), fwd.clone().addScaledVector(left, -0.3).addScaledVector(up, 0.02), 0.5, 24); break;
    case 'bust': at(head.clone().add(new THREE.Vector3(0, -0.2, 0)), fwd.clone().addScaledVector(left, -0.4), 2.0, 24); break;
    // the reference: his face turned toward his left, the camera at his right-front, slightly low
    default: at(c, fwd.clone().addScaledVector(left, -0.55).addScaledVector(up, -0.02), 0.95, 24);
  }
}

// &variants=base,nohs,noss,sss0,nocap,nosun — diagnostic toggles rendered from ONE load (key = view or view~variant)
const variants = (P.get('variants') ?? 'base').split(',');
function applyVariant(v: string) {
  const on = (k: string) => v.split('+').includes(k);
  if (groom) {
    groom.strands.castShadow = !on('nohs');
    if (groom.cap) {
      groom.cap.visible = !on('nocap');
    }
  }
  human.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== groom?.strands && o !== groom?.cap && !(groom && isUnder(o, groom.root))) o.castShadow = !on('noss');
  });
  if (post.sss) post.sss.enabled = !on('sss0');
  sky.sun.intensity = on('nosun') ? 0 : sunI;
}
function isUnder(o: THREE.Object3D, r: THREE.Object3D) {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === r) return true;
  return false;
}
const sunI = sky.sun.intensity;
const shots: Record<string, string> = {};
const times: number[] = [];
for (const va of variants) for (const v of views) {
  applyVariant(va);
  frameCamera(v);
  post.resetHistory();
  for (let i = 0; i < frames; i++) {
    const dt = 1 / 60;
    // 'blink': the lids closed at the capture (the blink closes in 0.07 s and holds 0.03 s) — the lashes must follow
    if (v === 'blink' && i === frames - 5) human.rig.blink();
    shared.uTime.value += dt;
    shared.uCamPos.value.copy(camera.position);
    human.update(dt, camera, H);
    groom?.update(dt);
    if (rig) rig.update(eyesMidpoint(human.sockets, _eyes), camera);
    sky.update(camera, human.root.position.clone().add(new THREE.Vector3(0, 1, 0)));
    const a = performance.now();
    post.render(dt);
    times.push(performance.now() - a);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
  renderer.getContext().finish();
  shots[variants.length > 1 ? `${v}~${va}` : v] = renderer.domElement.toDataURL('image/png');
}
info.textContent = '';
const w = window as unknown as Record<string, unknown>;
w.__shots = shots;
w.__stats = {
  preset, light, q, hero, loadMs: Math.round(loadMs), frameMs: times.slice(-3).map((t) => t.toFixed(1)),
  tris: renderer.info.render.triangles, calls: renderer.info.render.calls, groom: groom?.stats ? { strands: groom.stats.strands, tris: groom.stats.trianglesFull, layers: groom.stats.layers } : null,
};
w.__ready = true;
