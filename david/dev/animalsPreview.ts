// Dev-only preview harness for the animals (BearModel / BearActor / Flock) in the game's lighting.
// /dev/animals.html?scene=bear&anim=walk&t=3&cam=60,8,4.2,0.7&q=high
//   scene: bear | flock | sheep | ram | goat | lamb
//   anim (bear): idle | walk | trot | gallop | rear | rearwalk | roar | quadroar | carry | carrywalk | swipe | swipeHigh | hurt | death
//   at: seconds into the action (swipe / swipeHigh / hurt / death)      cam: azimuth°, elevation°, distance, target height[, target fwd]
//   sun: elevation°,azimuth°    q: low|medium|high    fur=0: no shells    fov    w,h    shots=json list of cams (multi capture)
import * as THREE from 'three';
import { SkySystem } from '../src/world/Sky';
import { PostFX } from '../src/fx/PostFX';
import { shared } from '../src/core/Shared';
import { Colliders } from '../src/core/Colliders';
import { BearActor } from '../src/gameplay/BearActor';
import type { Terrain } from '../src/world/Terrain';
import { Flock, type Animal } from '../src/characters/Flock';
import soilAlbedo from '../src/assets/textures/soil_albedo.jpg';
import soilNormal from '../src/assets/textures/soil_normal.jpg';
import rockAlbedo from '../src/assets/textures/rock_albedo.jpg';
import rockNormal from '../src/assets/textures/rock_normal.jpg';

const P = new URLSearchParams(location.search);
const sceneName = P.get('scene') ?? 'bear';
const anim = P.get('anim') ?? 'idle';
const simT = parseFloat(P.get('t') ?? '2.5');
const at = parseFloat(P.get('at') ?? '0.3');
const q = (P.get('q') ?? 'high') as 'low' | 'medium' | 'high';
const [sunEl, sunAz] = (P.get('sun') ?? '13,100').split(',').map(Number);
const W = parseInt(P.get('w') ?? '0', 10) || innerWidth;
const H = parseInt(P.get('h') ?? '0', 10) || innerHeight;
const info = document.getElementById('info')!;
const win = window as unknown as Record<string, unknown>;

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
const camera = new THREE.PerspectiveCamera(parseFloat(P.get('fov') ?? '32'), W / H, 0.05, 26000);
const sky = new SkySystem(renderer, q === 'high' ? 4096 : 2048);
scene.add(sky.group);
sky.setSun(sunEl, sunAz, scene);
const sc = sky.sun.shadow.camera;
const shadowExt = sceneName === 'flock' ? 22 : 4;
sc.left = -shadowExt; sc.right = shadowExt; sc.top = shadowExt; sc.bottom = -shadowExt;
sc.updateProjectionMatrix();
sky.sun.shadow.bias = -0.0002;
sky.sun.shadow.normalBias = 0.02;

// ---- ground: gently rolling terra rossa with limestone patches
const groundH = (x: number, z: number) => 0.18 * Math.sin(x * 0.11) * Math.cos(z * 0.09) + 0.06 * Math.sin(x * 0.37 + z * 0.23);
const tl = new THREE.TextureLoader();
const texLoads: Promise<unknown>[] = [];
const tex = (u: string, srgb: boolean, rep: number) => {
  const t = tl.load(u);
  texLoads.push(new Promise((res) => { const im = new Image(); im.onload = im.onerror = res; im.src = u; }));
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  t.anisotropy = 8;
  return t;
};
const gGeo = new THREE.PlaneGeometry(240, 240, 240, 240);
gGeo.rotateX(-Math.PI / 2);
const gp = gGeo.attributes.position as THREE.BufferAttribute;
for (let i = 0; i < gp.count; i++) gp.setY(i, groundH(gp.getX(i), gp.getZ(i)));
gGeo.computeVertexNormals();
const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ map: tex(soilAlbedo, true, 90), normalMap: tex(soilNormal, false, 90), color: 0xcdb8a0, roughness: 0.95 }));
ground.receiveShadow = true;
scene.add(ground);
// a few limestone boulders for scale
const rockMat = new THREE.MeshStandardMaterial({ map: tex(rockAlbedo, true, 1), normalMap: tex(rockNormal, false, 1), color: 0xe6dccb, roughness: 0.9 });
const rng = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
for (let i = 0; i < 26; i++) {
  const g = new THREE.IcosahedronGeometry(0.3 + rng() * 0.7, 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < p.count; k++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, k);
    v.multiplyScalar(0.8 + 0.4 * Math.sin(v.x * 7 + v.y * 5) * Math.cos(v.z * 6));
    v.y *= 0.6;
    p.setXYZ(k, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, rockMat);
  const a = rng() * Math.PI * 2, r = 6 + rng() * 30;
  m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  m.position.y = groundH(m.position.x, m.position.z) - 0.1;
  m.rotation.y = rng() * 6;
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}

const post = new PostFX(renderer, scene, camera, sky.cubeTarget.texture, { msaa: q === 'low' ? 0 : 4, bloom: true, godRaySamples: 24, pixelRatio: 1, aa: 'fxaa', sharpen: 0.2, filmFx: q !== 'low' });
post.setSize(W, H);
post.atmosphere.uniforms.uDensity.value = 0.00012;

// ---- actors
const terrain = { heightAt: groundH } as unknown as Terrain;
const dt = 1 / 30;
let focus = new THREE.Vector3(0, 0.8, 0);
let heading = 0;
let actor: BearActor | null = null;
let flock: Flock | null = null;
let stepper: ((sec: number) => void) | null = null;
const shepherd = new THREE.Vector3(30, 0, 30);

function makeFlock() {
  flock = new Flock({ ground: groundH, pastureCenter: new THREE.Vector3(0, groundH(0, 0), 0), pastureRadius: 18, seed: 7, ...(q ? { quality: q } : {}) } as ConstructorParameters<typeof Flock>[0]);
  scene.add(flock.group);
  return flock;
}

function isolate(f: Flock, subject: Animal | null) {
  let i = 0;
  for (const a of f.animals) {
    if (a === subject) continue;
    a.aiEnabled = false;
    a.manualSpeed = 0;
    a.position.set(60 + (i % 6) * 3, 0, 60 + Math.floor(i / 6) * 3);
    i++;
  }
}

async function main() {
  await Promise.all(texLoads);
  await new Promise((r) => setTimeout(r, 50));
  const t0 = performance.now();
  if (sceneName === 'bear') {
    actor = new BearActor(terrain, new Colliders(), scene, { quality: q });
    await actor.model.ready;
    actor.model.furEnabled = P.get('fur') !== '0';
    actor.visible = true;
    heading = parseFloat(P.get('heading') ?? '0');
    actor.place(0, 0, heading);
    const m = actor.model;
    const speed = anim === 'walk' ? 1.3 : anim === 'trot' ? 3.0 : anim === 'gallop' ? 7.5 : anim === 'rearwalk' ? 1.0 : anim === 'carrywalk' ? 1.4 : parseFloat(P.get('speed') ?? '0');
    const hold = anim.startsWith('rear') || anim === 'roar' || anim === 'swipeHigh' ? 'rear' : anim.startsWith('carry') ? 'carry' : 'none';
    m.hold = hold;
    if (anim.startsWith('carry')) {
      const f = makeFlock();
      isolate(f, f.lamb);
      f.update(dt, 0, { shepherd, threats: [] });
      const lamb = f.lamb;
      m.root.updateMatrixWorld(true);
      lamb.object.updateMatrixWorld(true);
      const grip = lamb.object.worldToLocal(lamb.backGrip.getWorldPosition(new THREE.Vector3()));
      m.mouthSocket.add(lamb.object);
      lamb.setCarried('mouth');
      lamb.object.rotation.set(0, Math.PI / 2, 0);
      lamb.object.position.copy(grip.applyEuler(lamb.object.rotation).multiplyScalar(-1));
    }
    const target = new THREE.Vector3(Math.sin(heading) * 500, 0, Math.cos(heading) * 500);
    let time = 0;
    const steps = Math.round(simT / dt);
    const a0 = actor;
    let i = 0;
    const tick = () => {
      time += dt;
      if (speed > 0) a0.moveTo(target, speed, dt);
      if (anim === 'roar' || anim === 'quadroar') m.roar = time > simT - 1.2 ? Math.min(1, (time - (simT - 1.2)) * 2.5) : 0;
      if (i === steps - Math.round(at / dt) - 1) {
        if (anim === 'swipe') m.play('swipe');
        if (anim === 'swipeHigh') m.play('swipeHigh');
        if (anim === 'hurt') m.play('hurt');
        if (anim === 'death') m.hold = 'down';
      }
      a0.update(dt);
      flock?.update(dt, time, { shepherd, threats: [] });
      i++;
    };
    for (let k = 0; k < steps; k++) tick();
    stepper = (sec: number) => {
      for (let k = 0; k < Math.round(sec / dt); k++) tick();
      focus = a0.pos.clone();
      heading = a0.heading;
    };
    focus = actor.pos.clone();
    heading = actor.heading;
  } else {
    const f = makeFlock();
    let subject: Animal | null = null;
    if (sceneName !== 'flock') {
      subject = sceneName === 'sheep' ? f.animals.find((a) => a.kind === 'sheep')! : f.animals.find((a) => a.kind === sceneName)!;
      isolate(f, subject);
      subject.aiEnabled = false;
      subject.position.set(0, groundH(0, 0), 0);
      subject.heading = parseFloat(P.get('heading') ?? '0');
      subject.state = (P.get('state') as 'graze') ?? 'walk';
      subject.graze = P.get('state') === 'graze' ? 1 : 0;
      subject.manualSpeed = parseFloat(P.get('speed') ?? '0');
    }
    let time = 0;
    const steps = Math.round(simT / dt);
    for (let i = 0; i < steps; i++) {
      time += dt;
      f.update(dt, time, { shepherd, threats: [], camera });
    }
    if (subject) {
      focus = subject.position.clone();
      heading = subject.heading;
    } else focus = f.centroid.clone();
  }
  const buildMs = performance.now() - t0;
  let shots = P.get('shots') ? (JSON.parse(P.get('shots')!) as number[][]) : [(P.get('cam') ?? '35,10,4.6,0.75').split(',').map(Number)];
  // seq=n,dt: n frames of the same camera, dt seconds apart
  const seq = P.get('seq') ? P.get('seq')!.split(',').map(Number) : null;
  if (seq) shots = Array.from({ length: seq[0] }, () => shots[0]);
  setCam(shots[0]);
  if (actor && P.get('only') === 'fur') for (const o of actor.model.root.children) if ((o as THREE.Mesh).isMesh && o.name !== 'bear-fur') o.visible = false;
  if (actor && P.get('only') === 'body') for (const o of actor.model.root.children) if ((o as THREE.Mesh).isMesh && o.name === 'bear-fur') o.visible = false;
  renderOnce();
  renderer.info.autoReset = false;
  renderer.info.reset();
  renderOnce();
  renderer.info.autoReset = true;
  const ri = renderer.info.render;
  info.textContent = P.has('hud') ? `${sceneName} ${anim} q=${q} tris=${ri.triangles} calls=${ri.calls} build=${buildMs.toFixed(0)}ms` : '';
  win.__info = { tris: ri.triangles, calls: ri.calls, buildMs };
  if (flock) {
    // per-kind triangle budget: [LOD0, LOD1, LOD2] body + fur shells (all layers) + how many cast shadows now
    const tri = (g: THREE.BufferGeometry | undefined) => (g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0);
    const kinds: Record<string, unknown> = {};
    for (const k of ['sheep', 'ram', 'goat', 'lamb']) {
      const a = flock.animals.find((x) => x.kind === k);
      if (a) kinds[k] = { lods: a.lods.map(tri), shells: tri(a.shellMesh?.geometry as THREE.BufferGeometry | undefined) };
    }
    const casters = flock.animals.filter((a) => a.bodyMesh.castShadow).length;
    win.__info = { ...(win.__info as object), q, flock: kinds, animals: flock.animals.length, casters };
  }
  win.__shots = shots.length;
  win.__shot = (i: number) => {
    if (seq && stepper) stepper(seq[1]);
    setCam(shots[i]);
    renderOnce();
    renderOnce();
    return true;
  };
  win.__ready = true;
}

function setCam(c: number[]) {
  setCamOnly(c);
  // refresh the flock's distance LODs for the new viewpoint
  if (flock) {
    flock.update(1e-3, 100, { shepherd, threats: [], camera });
    setCamOnly(c);
  }
}

function setCamOnly(c: number[]) {
  const [az, el, dist, ty, tz = 0] = c;
  const A = THREE.MathUtils.degToRad(az) + heading, E = THREE.MathUtils.degToRad(el);
  const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  const tgt = focus.clone().add(new THREE.Vector3(0, ty, 0)).addScaledVector(fwd, tz);
  camera.position.set(tgt.x + Math.sin(A) * Math.cos(E) * dist, tgt.y + Math.sin(E) * dist, tgt.z + Math.cos(A) * Math.cos(E) * dist);
  camera.lookAt(tgt);
  camera.updateMatrixWorld();
  shared.uCamPos.value.copy(camera.position);
  sky.update(camera, tgt);
}

function renderOnce(d = 1 / 60) {
  shared.uTime.value += d;
  shared.uCamPos.value.copy(camera.position);
  post.render(d);
}

main().catch((e) => {
  info.textContent = 'ERROR ' + (e?.stack ?? e);
  console.error(e);
  win.__error = String(e?.stack ?? e);
});
