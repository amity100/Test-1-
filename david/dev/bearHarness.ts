// Dev-only motion harness for the bear (bear1, gameplay v2 §4): drives BearActor / BearModel through scripted
// scenarios that reproduce how the game drives it (Story's speeds, holds, faces and actions), renders from a
// side / gameplay / front / close camera, and measures foot sliding while a paw is planted.
//   /dev/bear.html?q=medium&w=640&h=360[&post=1][&fur=0]
//   window.__setup(name) -> duration (s)   window.__step(sec)   window.__render(cam)   window.__metrics()
//   scenarios: see SCENARIOS below          cams: side | game | front | close | rear3q | top
import * as THREE from 'three';
import { SkySystem } from '../src/world/Sky';
import { PostFX } from '../src/fx/PostFX';
import { shared } from '../src/core/Shared';
import { Colliders } from '../src/core/Colliders';
import { BearActor } from '../src/gameplay/BearActor';
import type { Terrain } from '../src/world/Terrain';
import { Flock } from '../src/characters/Flock';
import soilAlbedo from '../src/assets/textures/soil_albedo.jpg';
import soilNormal from '../src/assets/textures/soil_normal.jpg';
import rockAlbedo from '../src/assets/textures/rock_albedo.jpg';
import rockNormal from '../src/assets/textures/rock_normal.jpg';

const P = new URLSearchParams(location.search);
const q = (P.get('q') ?? 'medium') as 'low' | 'medium' | 'high';
const W = parseInt(P.get('w') ?? '0', 10) || innerWidth;
const H = parseInt(P.get('h') ?? '0', 10) || innerHeight;
const usePost = P.get('post') === '1';
const info = document.getElementById('info')!;
const win = window as unknown as Record<string, unknown>;

const renderer = new THREE.WebGLRenderer({ antialias: !usePost, preserveDrawingBuffer: true, stencil: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = parseFloat(P.get('exposure') ?? '0.58');
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 26000);
const sky = new SkySystem(renderer, 2048);
scene.add(sky.group);
sky.setSun(...((P.get('sun') ?? '22,120').split(',').map(Number) as [number, number]), scene);
const sc = sky.sun.shadow.camera;
sc.left = -5; sc.right = 5; sc.top = 5; sc.bottom = -5;
sc.updateProjectionMatrix();
sky.sun.shadow.bias = -0.0002;
sky.sun.shadow.normalBias = 0.02;

// ---- ground: gently rolling terra rossa (a slope the paws must follow) + a grid of pale pebbles to read sliding against
const flat = P.get('ground') === 'flat';
const groundH = (x: number, z: number) => (flat ? 0 : 0.22 * Math.sin(x * 0.13) * Math.cos(z * 0.11) + 0.07 * Math.sin(x * 0.41 + z * 0.29));
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
const gGeo = new THREE.PlaneGeometry(300, 300, 300, 300);
gGeo.rotateX(-Math.PI / 2);
const gp = gGeo.attributes.position as THREE.BufferAttribute;
for (let i = 0; i < gp.count; i++) gp.setY(i, groundH(gp.getX(i), gp.getZ(i)));
gGeo.computeVertexNormals();
const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ map: tex(soilAlbedo, true, 110), normalMap: tex(soilNormal, false, 110), color: 0xcdb8a0, roughness: 0.95 }));
ground.receiveShadow = true;
scene.add(ground);
// reference stones every 2 m (sliding paws read against them)
{
  const g = new THREE.IcosahedronGeometry(0.06, 0);
  const m = new THREE.MeshStandardMaterial({ color: 0xd9cdb6, roughness: 0.9 });
  const n = 60 * 60;
  const inst = new THREE.InstancedMesh(g, m, n);
  const mt = new THREE.Matrix4();
  let k = 0;
  for (let i = 0; i < 60; i++) for (let j = 0; j < 60; j++) {
    const x = -60 + i * 2 + ((j * 7) % 5) * 0.13, z = -60 + j * 2 + ((i * 3) % 5) * 0.11;
    mt.makeTranslation(x, groundH(x, z) + 0.01, z);
    inst.setMatrixAt(k++, mt);
  }
  inst.receiveShadow = true;
  scene.add(inst);
}
const rockMat = new THREE.MeshStandardMaterial({ map: tex(rockAlbedo, true, 1), normalMap: tex(rockNormal, false, 1), color: 0xe6dccb, roughness: 0.9 });
const rng = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
for (let i = 0; i < 30; i++) {
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
  const a = rng() * Math.PI * 2, r = 9 + rng() * 40;
  m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  m.position.y = groundH(m.position.x, m.position.z) - 0.1;
  m.rotation.y = rng() * 6;
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}

const post = usePost ? new PostFX(renderer, scene, camera, sky.cubeTarget.texture, { msaa: 0, bloom: true, godRaySamples: 16, pixelRatio: 1, aa: 'fxaa', sharpen: 0.2, filmFx: false }) : null;
post?.setSize(W, H);
if (post) post.atmosphere.uniforms.uDensity.value = 0.00012;

// ---- the bear, a stand-in for David (a post with a head) and the lamb
const terrain = { heightAt: groundH } as unknown as Terrain;
const DT = 1 / 60;
let actor: BearActor;
let flock: Flock | null = null;
const david = new THREE.Group();
{
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 1.4, 10), mat);
  body.position.y = 0.7;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: 0xb08060, roughness: 0.8 }));
  head.position.y = 1.55;
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.7, 6), mat);
  staff.position.set(0.28, 0.85, 0.1);
  david.add(body, head, staff);
  for (const o of david.children) o.castShadow = true;
  david.visible = false;
  scene.add(david);
}
const davidPos = new THREE.Vector3();

type Driver = (t: number, dt: number) => void;
interface Scenario { dur: number; setup: () => Driver }
let driver: Driver = () => {};
let simT = 0;
let heading0 = 0;
const start = new THREE.Vector3();
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const fwd0 = () => V(Math.sin(heading0), 0, Math.cos(heading0));
const right0 = () => V(-Math.cos(heading0), 0, Math.sin(heading0));
const ahead = (d: number, side = 0) => start.clone().addScaledVector(fwd0(), d).addScaledVector(right0(), side);
const M = () => actor.model;
/** call a model method only if this build of BearModel has it (the harness also runs on the old model) */
const call = (name: string, ...args: unknown[]) => {
  const f = (M() as unknown as Record<string, unknown>)[name];
  if (typeof f === 'function') return (f as (...a: unknown[]) => unknown).apply(M(), args);
  console.warn('[bear harness] no method', name);
  return undefined;
};
const setProp = (name: string, v: unknown) => { (M() as unknown as Record<string, unknown>)[name] = v; };
const placeDavid = (d: number, side = 0) => { davidPos.copy(ahead(d, side)); davidPos.y = groundH(davidPos.x, davidPos.z); david.position.copy(davidPos); david.visible = true; };
const once = () => { const done = new Set<string>(); return (k: string, t: number, at: number, fn: () => void) => { if (t >= at && !done.has(k)) { done.add(k); fn(); } }; };

function carryLamb() {
  if (!flock) {
    flock = new Flock({ ground: groundH, pastureCenter: V(80, 0, 80), pastureRadius: 8, seed: 7, quality: q } as ConstructorParameters<typeof Flock>[0]);
    scene.add(flock.group);
    let i = 0;
    for (const a of flock.animals) {
      if (a === flock.lamb) continue;
      a.aiEnabled = false; a.manualSpeed = 0;
      a.position.set(90 + (i % 6) * 3, 0, 90 + Math.floor(i / 6) * 3);
      i++;
    }
    flock.update(DT, 0, { shepherd: V(100, 0, 100), threats: [] });
  }
  const m = M();
  const lamb = flock.lamb;
  m.root.updateMatrixWorld(true);
  lamb.object.updateMatrixWorld(true);
  const grip = lamb.object.worldToLocal(lamb.backGrip.getWorldPosition(new THREE.Vector3()));
  m.mouthSocket.add(lamb.object);
  lamb.setCarried('mouth');
  lamb.object.rotation.set(0, Math.PI / 2, 0);
  lamb.object.position.copy(grip.applyEuler(lamb.object.rotation).multiplyScalar(-1));
  m.hold = 'carry';
}

const SCENARIOS: Record<string, Scenario> = {
  // Story.bearAttack: the stalk at 1.4 m/s, then a turn while walking
  walk: { dur: 7, setup: () => (t, dt) => { actor.moveTo(t < 3.2 ? ahead(200) : ahead(3.5, 60), 1.4, dt); } },
  // a slow amble / the carry away speed (3.5 m/s)
  trot: { dur: 5, setup: () => (t, dt) => { actor.moveTo(ahead(400), 3.5, dt); } },
  // the chase's near speed (4.9 m/s)
  chase: { dur: 5, setup: () => (t, dt) => { actor.moveTo(t < 2.6 ? ahead(400) : ahead(12, -60), 4.9, dt); } },
  // the charge at the lamb (8.5 m/s)
  gallop: { dur: 4, setup: () => (t, dt) => { actor.moveTo(ahead(600), 8.5, dt); } },
  // from a standstill to a full charge and a hard stop (bluff)
  accel: { dur: 5, setup: () => (t, dt) => { if (t < 3.0) actor.moveTo(ahead(600), t < 0.4 ? 0 : 8.5, dt); else actor.stop(dt); } },
  // standing, turning to face David behind it (Story: bear.face(player, dt, 3) + stop)
  turn: { dur: 5, setup: () => { placeDavid(-4, 3); return (t, dt) => { actor.stop(dt); if (t > 0.6) actor.face(davidPos, dt, 3); M().lookTarget = t > 0.6 ? davidPos : null; }; } },
  // carrying the lamb in its jaws, running off to the thicket (Story: 3.5 m/s)
  carry: { dur: 5, setup: () => { carryLamb(); return (t, dt) => { actor.moveTo(ahead(400), t < 0.5 ? 1.0 : 3.5, dt); }; } },
  // Story.rise + fight: rears (hold rear), roars 1.0-3.6, then lumbers after David on its hind legs (1.2 m/s), drops to
  // all fours to close the distance (3.4), slows again
  rear: { dur: 9, setup: () => { placeDavid(4.5); const o = once(); return (t, dt) => {
    o('rear', t, 0.3, () => { M().hold = 'rear'; });
    M().lookTarget = davidPos;
    M().roar = t > 1.3 && t < 3.6 ? Math.min(1, (t - 1.3) * 2) : Math.max(0, M().roar - dt * 3);
    if (t < 4.2) { actor.stop(dt); actor.face(davidPos, dt, 3); }
    else if (t < 6.0) { davidPos.copy(ahead(8)); david.position.copy(davidPos); actor.moveTo(davidPos, 1.2, dt, 2.2); }
    else if (t < 7.6) { davidPos.copy(ahead(16)); david.position.copy(davidPos); actor.moveTo(davidPos, 3.4, dt, 2.2); }
    else actor.stop(dt);
  }; } },
  // at bay on all fours: the warning swipe, a flinch, another swipe (Story.chase atBay)
  swipe: { dur: 4.6, setup: () => { placeDavid(2.3, 0.4); const o = once(); return (t, dt) => {
    actor.stop(dt); actor.face(davidPos, dt, 3); M().lookTarget = davidPos;
    o('s1', t, 0.6, () => M().play('swipe'));
    o('h1', t, 2.0, () => M().play('hurt'));
    o('s2', t, 3.0, () => M().play('swipe'));
  }; } },
  // the fight: standing swipes
  swipeHigh: { dur: 5.2, setup: () => { placeDavid(2.6, 0.3); const o = once(); M().hold = 'rear'; return (t, dt) => {
    actor.stop(dt); actor.face(davidPos, dt, 2.5); M().lookTarget = davidPos;
    o('s1', t, 1.6, () => M().play('swipeHigh'));
    o('h', t, 2.9, () => M().play('hurt'));
    o('s2', t, 3.7, () => M().play('swipeHigh'));
  }; } },
  // death (Story.clinch: from 'rear' to 'down')
  down: { dur: 5, setup: () => { placeDavid(1.6); const o = once(); M().hold = 'rear'; return (t, dt) => {
    actor.stop(dt); M().lookTarget = t < 1 ? davidPos : null;
    o('d', t, 1.0, () => { actor.alive = false; M().roar = 0; M().hold = 'down'; });
  }; } },
  // ---- the fight's new moves (BearModel v2 API; the harness skips what an older model lacks)
  warn: { dur: 6, setup: () => { placeDavid(5); const o = once(); return (t, dt) => {
    actor.stop(dt); actor.face(davidPos, dt, 3); M().lookTarget = davidPos;
    o('w', t, 0.5, () => call('play', 'huff'));
    o('w2', t, 3.2, () => call('play', 'stomp'));
  }; } },
  bite: { dur: 4.5, setup: () => { placeDavid(2.6); const o = once(); return (t, dt) => {
    actor.stop(dt); actor.face(davidPos, dt, 3); M().lookTarget = davidPos;
    o('b', t, 0.6, () => call('play', 'bite'));
    o('b2', t, 2.6, () => call('play', 'bite'));
  }; } },
  slam: { dur: 5, setup: () => { placeDavid(3.0); const o = once(); return (t, dt) => {
    actor.stop(dt); actor.face(davidPos, dt, 3); M().lookTarget = davidPos;
    o('s', t, 0.6, () => call('play', 'rearSlam'));
  }; } },
  stagger: { dur: 4.5, setup: () => { placeDavid(4); const o = once(); return (t, dt) => {
    actor.stop(dt); M().lookTarget = davidPos;
    o('s', t, 0.6, () => call('play', 'stagger'));
    o('s2', t, 2.6, () => call('play', 'stagger', -1));
  }; } },
  bluff: { dur: 5, setup: () => { placeDavid(16); const o = once(); return (t, dt) => {
    M().lookTarget = davidPos;
    const d = actor.pos.distanceTo(davidPos);
    if (t < 0.3) actor.stop(dt);
    else if (t < 3.6 && d > 4.2) actor.moveTo(davidPos, 9, dt, 4.0);
    else { o('b', t, 0, () => call('play', 'brake')); actor.stop(dt); actor.face(davidPos, dt, 3); }
  }; } },
  tired: { dur: 6, setup: () => { placeDavid(4); setProp('fatigue', 1); return (t, dt) => {
    M().lookTarget = davidPos;
    if (t < 2.5) actor.stop(dt); else actor.moveTo(ahead(400, 30), 1.3, dt);
  }; } },
  held: { dur: 5, setup: () => { placeDavid(1.1, 0.25); const o = once(); M().hold = 'rear'; return (t, dt) => {
    actor.stop(dt); M().lookTarget = davidPos;
    o('h', t, 0.8, () => { M().hold = 'held' as never; });
    const g = M() as unknown as { gripPull?: THREE.Vector3 | null; struggle?: number };
    if (t > 0.8) {
      g.gripPull = davidPos.clone().add(V(0, 1.25, 0)).addScaledVector(right0(), 0.35);
      g.struggle = 0.5 + 0.5 * Math.sin(t * 2.1);
    }
  }; } },
};

function setup(name: string) {
  const s = SCENARIOS[name];
  if (!s) throw new Error('no scenario ' + name);
  // a fresh bear state each scenario (same model, reset holds / actions by re-placing)
  const m = actor.model;
  if (flock && flock.lamb.object.parent !== flock.group) { flock.group.attach(flock.lamb.object); flock.lamb.setCarried('none'); }
  m.hold = 'none';
  m.roar = 0;
  m.lookTarget = null;
  actor.alive = true;
  setProp('fatigue', 0);
  (m as unknown as { gripPull?: unknown }).gripPull = null;
  heading0 = parseFloat(P.get('heading') ?? '0');
  start.set(0, groundH(0, 0), 0);
  actor.place(0, 0, heading0);
  david.visible = false;
  // settle into the idle (holds blend, legs plant)
  for (let i = 0; i < 90; i++) { actor.stop(DT); actor.update(DT); }
  call('resetMotion');
  simT = 0;
  driver = s.setup();
  metrics = { slide: [0, 0, 0, 0], contactT: [0, 0, 0, 0], maxPen: 0, float: 0 };
  return s.dur;
}

// ---- foot metrics: horizontal slip of each paw's ball while it is on the ground (contact = within 4 cm)
const PAWS = ['toesL', 'toesR', 'htoesL', 'htoesR'];
const prevPaw = PAWS.map(() => new THREE.Vector3());
let metrics = { slide: [0, 0, 0, 0], contactT: [0, 0, 0, 0], maxPen: 0, float: 0 };
const pw = new THREE.Vector3();
function measure(dt: number, first: boolean) {
  const m = actor.model;
  PAWS.forEach((n, i) => {
    m.j[n].getWorldPosition(pw);
    const gy = groundH(pw.x, pw.z);
    const h = pw.y - gy;
    metrics.maxPen = Math.max(metrics.maxPen, -h);
    if (!first && h < 0.045 && dt > 0) {
      metrics.slide[i] += Math.hypot(pw.x - prevPaw[i].x, pw.z - prevPaw[i].z);
      metrics.contactT[i] += dt;
    }
    prevPaw[i].copy(pw);
  });
}

function step(sec: number) {
  const n = Math.max(1, Math.round(sec / DT));
  for (let i = 0; i < n; i++) {
    simT += DT;
    driver(simT, DT);
    actor.update(DT);
    flock?.update(DT, simT, { shepherd: V(100, 0, 100), threats: [] });
    measure(DT, i === 0 && simT < 2 * DT);
  }
  return simT;
}

// ---- cameras (world-fixed directions around the scenario's start heading; they translate with the bear)
const camTarget = new THREE.Vector3();
function setCam(name: string) {
  const b = actor.pos;
  const F = fwd0(), R = right0();
  let pos: THREE.Vector3, look: THREE.Vector3, fov = 40;
  const tgt = camTarget.copy(b).add(V(0, 0.65, 0));
  if (name === 'side') { pos = tgt.clone().addScaledVector(R, -4.9).add(V(0, 0.3, 0)); look = tgt.clone().add(V(0, -0.05, 0)); fov = 34; }
  else if (name === 'game') {
    // the gameplay follow camera: 3.6 m behind David at 1.55 m + a little, fov 52 — David ~4 m from the bear
    const toB = b.clone().sub(davidPos); toB.y = 0;
    const d = david.visible && toB.length() > 0.5 ? toB.normalize() : F.clone();
    const dp = david.visible ? davidPos : b.clone().addScaledVector(d, -4);
    pos = dp.clone().addScaledVector(d, -3.6).add(V(0, 1.55 + 0.75, 0));
    look = dp.clone().addScaledVector(d, 4).add(V(0, 1.0, 0));
    fov = 52;
  } else if (name === 'front') { pos = tgt.clone().addScaledVector(F, 6.5).addScaledVector(R, 1.8).add(V(0, 0.7, 0)); look = tgt.clone().add(V(0, 0.25, 0)); fov = 38; }
  else if (name === 'close') { pos = tgt.clone().addScaledVector(F, 2.9).addScaledVector(R, -1.6).add(V(0, 0.45, 0)); look = tgt.clone().add(V(0, 0.15, 0)).addScaledVector(F, 0.5); fov = 40; }
  else if (name === 'rear3q') { pos = tgt.clone().addScaledVector(F, -5.2).addScaledVector(R, -2.6).add(V(0, 1.2, 0)); look = tgt; fov = 40; }
  else { pos = tgt.clone().add(V(0.01, 9, 0)); look = tgt; fov = 40; }
  pos.y = Math.max(pos.y, groundH(pos.x, pos.z) + 0.3);
  camera.fov = fov;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  camera.position.copy(pos);
  camera.lookAt(look);
  camera.updateMatrixWorld();
  shared.uCamPos.value.copy(camera.position);
  sky.update(camera, tgt);
}

function render(cam: string) {
  setCam(cam);
  shared.uTime.value = simT;
  if (post) post.render(1 / 60);
  else renderer.render(scene, camera);
  return true;
}

async function main() {
  await Promise.all(texLoads);
  const t0 = performance.now();
  actor = new BearActor(terrain, new Colliders(), scene, { quality: q });
  await actor.model.ready;
  actor.model.furEnabled = P.get('fur') !== '0';
  actor.visible = true;
  const buildMs = performance.now() - t0;
  setup('walk');
  render('side');
  renderer.info.autoReset = false;
  renderer.info.reset();
  render('side');
  renderer.info.autoReset = true;
  const ri = renderer.info.render;
  win.__info = { tris: ri.triangles, calls: ri.calls, buildMs, q };
  win.__setup = setup;
  win.__step = step;
  win.__render = render;
  win.__metrics = () => {
    const r = metrics.slide.map((s, i) => (metrics.contactT[i] > 0 ? s / metrics.contactT[i] : 0));
    return { slip: r.map((x) => +x.toFixed(3)), contact: metrics.contactT.map((x) => +x.toFixed(2)), maxPen: +metrics.maxPen.toFixed(3), t: +simT.toFixed(2), pos: actor.pos.toArray().map((x) => +x.toFixed(2)), heading: +actor.heading.toFixed(3), speed: +actor.speed.toFixed(2) };
  };
  win.__scenarios = Object.keys(SCENARIOS);
  win.__actor = actor;
  info.textContent = '';
  win.__ready = true;
}

main().catch((e) => {
  info.textContent = 'ERROR ' + (e?.stack ?? e);
  console.error(e);
  win.__error = String(e?.stack ?? e);
});
