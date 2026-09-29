// Dev-only preview harness for src/characters/hair (not part of the game build).
//
// /dev/hair.html?preset=david|saul|man&views=face,three4,profile&q=high|medium|low&w=720&h=900
//   &seed=3&beard=none|short|full&band=1 (placeholder diadem + headband compression; default on for saul)
//   &sun=13,100 (elevation, azimuth)  &yaw=0  &hair=0 (bald)  &sim=0  &motion=1 (shake the head for N frames)
//   &men=1,2,3 (one view per seeded man)  &frames=2  &msaa=4  &exposure=0.58
import * as THREE from 'three';
import { SkySystem } from '../src/world/Sky';
import { PostFX } from '../src/fx/PostFX';
import { shared } from '../src/core/Shared';
import { pose, PoseMixer } from '../src/characters/Rig';
import { HumanModel } from '../src/characters/human/HumanModel';
import { createGroom, type Groom, type GroomStyleSpec } from '../src/characters/hair';
import rockAlbedo from '../src/assets/textures/rock_albedo.jpg';
import rockNormal from '../src/assets/textures/rock_normal.jpg';

const P = new URLSearchParams(location.search);
const preset = P.get('preset') ?? 'david';
const q = (P.get('q') ?? 'high') as 'low' | 'medium' | 'high';
const W = parseInt(P.get('w') ?? '720', 10);
const H = parseInt(P.get('h') ?? '900', 10);
const men = P.get('men')?.split(',').map(Number) ?? null;
const VIEWS = men ? men.map(() => P.get('views') ?? 'three4') : (P.get('views') ?? 'three4').split(',');
const [sunEl, sunAz] = (P.get('sun') ?? '13,100').split(',').map(Number);
const msaa = parseInt(P.get('msaa') ?? (q === 'low' ? '0' : '4'), 10);
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
const camera = new THREE.PerspectiveCamera(26, W / H, 0.02, 26000);
const sky = new SkySystem(renderer, q === 'high' ? 4096 : 2048);
scene.add(sky.group);
sky.setSun(sunEl, sunAz, scene);
const sc = sky.sun.shadow.camera;
sc.left = -1.2; sc.right = 1.2; sc.top = 1.2; sc.bottom = -1.2;
sc.updateProjectionMatrix();
sky.sun.shadow.bias = -0.0002;
sky.sun.shadow.normalBias = 0.01;
sky.sun.shadow.radius = 2;
const post = new PostFX(renderer, scene, camera, sky.cubeTarget.texture, { msaa, bloom: true, godRaySamples: 24, pixelRatio: 1 });
post.setSize(W, H);
post.atmosphere.uniforms.uDensity.value = 0.00012;

const tl = new THREE.TextureLoader();
const ra = tl.load(rockAlbedo);
ra.colorSpace = THREE.SRGBColorSpace;
const rn = tl.load(rockNormal);
for (const t of [ra, rn]) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 24);
}
const gGeo = new THREE.PlaneGeometry(60, 60, 8, 8);
gGeo.rotateX(-Math.PI / 2);
const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ map: ra, normalMap: rn, color: 0xe8dcc6, roughness: 0.92 }));
ground.receiveShadow = true;
scene.add(ground);

const IDLE = pose({
  hips: [0, 0, 0.03], chest: [0.02, 0, 0], head: [-0.04, 0.08, 0],
  uaL: [0.02, 0, 0.1], faL: [-0.2, 0, 0], uaR: [0.04, 0, -0.1], faR: [-0.25, 0, 0],
  thL: [-0.06, 0, 0.03], shinL: [0.08, 0, 0], thR: [0.09, 0, -0.04], shinR: [0.05, 0, 0],
});

interface Actor { human: HumanModel; groom: Groom | null; mixer: PoseMixer }
const actors: Actor[] = [];

async function loadActor(pr: string, seed: number | undefined, spec: GroomStyleSpec | null, x: number): Promise<Actor> {
  const human = await HumanModel.load({ preset: pr, quality: q, seed });
  human.root.position.x = x;
  human.root.rotation.y = THREE.MathUtils.degToRad(parseFloat(P.get('yaw') ?? '0'));
  scene.add(human.root);
  const mixer = new PoseMixer(human.joints);
  mixer.reset();
  mixer.layer(IDLE, 1);
  mixer.apply();
  human.joints.hips.position.y = human.rig.hipHeight;
  human.joints.hips.position.z = human.rig.pelvis.z;
  human.rig.blinkEnabled = false;
  human.rig.lookTarget = null;
  if (P.has('look')) human.rig.setGaze(...(P.get('look')!.split(',').map(Number) as [number, number]));
  human.setPupil(0.2);
  for (let i = 0; i < 60; i++) human.update(1 / 30, camera, H);
  let groom: Groom | null = null;
  const band = P.has('band') ? P.get('band') === '1' : pr === 'saul';
  if (spec && P.get('hair') !== '0') {
    const cr = human.metrics.crownRadius;
    const t0 = performance.now();
    groom = await createGroom(human, spec, {
      quality: q, msaa,
      headband: band ? { height: parseFloat(P.get('bandH') ?? '0.0'), radius: [cr[0] + 0.006, cr[1] + 0.006] } : undefined,
      simulate: P.get('sim') !== '0',
    });
    console.log(`groom ${JSON.stringify(groom.stats)} total ${(performance.now() - t0).toFixed(0)}ms`);
  }
  if (band) {
    // placeholder diadem (the wardrobe teammate makes the real one): thin gold band at the crown anchor
    const cr = human.metrics.crownRadius;
    const bandGeo = new THREE.CylinderGeometry(1, 1, 0.014, 96, 1, true);
    bandGeo.scale(cr[0] + 0.0075, 1, cr[1] + 0.0075);
    const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.28, side: THREE.DoubleSide });
    const m = new THREE.Mesh(bandGeo, gold);
    m.position.y = parseFloat(P.get('bandH') ?? '0.0');
    m.castShadow = true;
    human.sockets.crownAnchor.add(m);
  }
  return { human, groom, mixer };
}

function frame(a: Actor, v: string) {
  const human = a.human;
  const r = human.root;
  r.updateMatrixWorld(true);
  const head = new THREE.Vector3(), eR = new THREE.Vector3();
  human.sockets.eyeL.getWorldPosition(head);
  human.sockets.eyeR.getWorldPosition(eR);
  head.add(eR).multiplyScalar(0.5);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(r.quaternion);
  const left = new THREE.Vector3(1, 0, 0).applyQuaternion(r.quaternion);
  const up = new THREE.Vector3(0, 1, 0);
  const at = (target: THREE.Vector3, d: THREE.Vector3, dist: number, fov: number) => {
    camera.fov = fov;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    camera.position.copy(target).addScaledVector(d.normalize(), dist);
    camera.lookAt(target);
  };
  const h = human.metrics.height;
  switch (v) {
    case 'face': at(head.clone().add(new THREE.Vector3(0, 0.0, 0)), fwd.clone().addScaledVector(left, 0.25).addScaledVector(up, 0.03), 0.75, 26); break;
    case 'front': at(head.clone(), fwd.clone(), 0.8, 26); break;
    case 'three4': at(head.clone().add(new THREE.Vector3(0, -0.04, 0)), fwd.clone().addScaledVector(left, 0.85).addScaledVector(up, 0.05), 1.05, 26); break;
    case 'three4r': at(head.clone().add(new THREE.Vector3(0, -0.04, 0)), fwd.clone().addScaledVector(left, -0.85).addScaledVector(up, 0.05), 1.05, 26); break;
    case 'profile': at(head.clone().add(new THREE.Vector3(0, -0.01, 0)), left.clone(), 0.85, 26); break;
    case 'back': at(head.clone().add(new THREE.Vector3(0, -0.02, 0)), fwd.clone().negate().addScaledVector(left, 0.5), 0.9, 26); break;
    case 'top': at(head.clone().add(new THREE.Vector3(0, 0.04, 0)), fwd.clone().addScaledVector(up, 1.4), 0.8, 26); break;
    case 'low': at(head.clone().add(new THREE.Vector3(0, -0.08, 0)), fwd.clone().addScaledVector(left, 0.45).addScaledVector(up, -0.45), 1.35, 28); break;
    case 'bust': at(head.clone().add(new THREE.Vector3(0, -0.2, 0)), fwd.clone().addScaledVector(left, 0.6), 1.9, 26); break;
    case 'game': at(new THREE.Vector3(0, h * 0.62, 0).add(r.position), fwd.clone().addScaledVector(left, 0.5).addScaledVector(up, 0.08), 4.2, 40); break;
    case 'far': at(new THREE.Vector3(0, h * 0.55, 0).add(r.position), fwd.clone().addScaledVector(left, 0.7).addScaledVector(up, 0.12), 8, 40); break;
    default: at(head, fwd, 0.9, 26);
  }
  shared.uCamPos.value.copy(camera.position);
}

function renderOnce(dt = 1 / 60) {
  shared.uTime.value += dt;
  shared.uCamPos.value.copy(camera.position);
  sky.update(camera, actors[0].human.root.position.clone().add(new THREE.Vector3(0, 1, 0)));
  post.render(dt);
}

async function main() {
  const t0 = performance.now();
  if (men) {
    for (let i = 0; i < men.length; i++) {
      const s = men[i];
      const beard = (P.get('beard') as 'none' | 'short' | 'full' | null) ?? undefined;
      actors.push(await loadActor('man', s, { kind: 'man', seed: s, beard, headband: P.get('band') === '1' }, i * 3));
    }
  } else {
    const spec: GroomStyleSpec = preset === 'man' ? { kind: 'man', seed: parseInt(P.get('seed') ?? '1', 10), beard: (P.get('beard') as 'none' | 'short' | 'full' | null) ?? undefined } : (preset as 'david' | 'saul');
    actors.push(await loadActor(preset, preset === 'man' ? parseInt(P.get('seed') ?? '1', 10) : undefined, spec, 0));
  }
  const loadMs = performance.now() - t0;
  const wind = new THREE.Vector3(0.8, 0, 0.4);
  // optional head motion to exercise the dynamics
  const motion = parseInt(P.get('motion') ?? '0', 10);
  for (let i = 0; i < motion; i++) {
    for (const a of actors) {
      a.human.joints.head.rotation.y = 0.35 * Math.sin(i * 0.25);
      a.human.joints.neck.rotation.x = 0.12 * Math.sin(i * 0.4);
      a.human.update(1 / 30, camera, H);
      a.groom?.update(1 / 30, wind);
    }
  }
  for (const a of actors) {
    a.human.update(1 / 30, camera, H);
    a.groom?.update(1 / 30, wind);
    if (a.groom && P.get('nojaw') === '1') a.groom.uniforms.uJaw.value.identity();
  }
  const frames = parseInt(P.get('frames') ?? '2', 10);
  let out: HTMLCanvasElement | null = null;
  if (VIEWS.length > 1) {
    out = document.createElement('canvas');
    out.width = W * VIEWS.length;
    out.height = H;
    renderer.domElement.style.display = 'none';
    document.body.appendChild(out);
  }
  for (let v = 0; v < VIEWS.length; v++) {
    const a = men ? actors[v] : actors[0];
    for (const b of actors) b.human.root.visible = !men || b === a;
    frame(a, VIEWS[v]);
    for (let i = 0; i < frames; i++) renderOnce();
    if (out) out.getContext('2d')!.drawImage(renderer.domElement, v * W, 0);
  }
  const st = actors.map((a) => a.groom?.stats);
  info.textContent = `${preset} q=${q} load=${loadMs.toFixed(0)}ms ` + st.map((s) => (s ? `strands=${s.strands} build=${s.buildMs.toFixed(0)}ms` : '')).join(' | ');
  if (P.get('info') === '0') info.textContent = '';
  (window as unknown as { __info: unknown }).__info = { loadMs, stats: st, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  (window as unknown as { __ready: boolean }).__ready = true;
}

main().catch((e) => {
  info.textContent = 'ERROR ' + (e?.stack ?? e);
  console.error(e);
  (window as unknown as { __error: string }).__error = String(e?.stack ?? e);
});
