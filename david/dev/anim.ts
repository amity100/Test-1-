// dev/anim.html — the anim teammate's motion harness (CUT v2): the film's performances on flat ground, plain lights, no
// set and no post chain (fast under the software renderer), so the MOTION can be judged from filmstrips.
//
//   ?mode=gilgal|army|ramah   ?q=low|medium|high (actors)   ?tier=mobile-low|mobile-high|desktop-medium|desktop-high (army)
//   ?bearer=1 (the armour-bearer)   ?heroes=0 (no hero soldiers)   ?w=&h= (canvas size)
//
// window.__anim:
//   shot(name, t, cam)   Gilgal performance / army: simulate shot `name` from 0 to t (continues forward when the shot
//                        and t go on), set the camera, render; returns the canvas as a JPEG data URL
//   ramah(t, cam)        the elders and Samuel (P5)
//   cam presets: 'side' 'sideN' 'samFace' 'saul' 'saulFist' 'saulBack' 'tearClose' 'front' 'roar' 'inside' 'wide', or
//   [px,py,pz, lx,ly,lz, fov]
import * as THREE from 'three';
import { FilmActor, GilgalPerformance, RamahPerformance, GILGAL_CLIPS, RAMAH_CLIPS } from '../src/film/cast';
import { MocapLibrary } from '../src/characters/mocap';
import { saulAt, samuelAt, type GilgalShotName } from '../src/film/gilgal/gilgalBlocking';
import { SAUL_HALT, ARMY } from '../src/film/gilgal/gilgalLayout';
import type { GilgalArmy } from '../src/film/crowd/GilgalArmy';
import type { CrowdTier } from '../src/film/crowd/Crowd';

const P = new URLSearchParams(location.search);
const mode = P.get('mode') ?? 'gilgal';
const q = (P.get('q') ?? 'low') as 'low' | 'medium' | 'high';
const W = +(P.get('w') ?? 480), H = +(P.get('h') ?? 270);
const w = window as unknown as Record<string, unknown>;
const info = document.getElementById('info')!;

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc9b99b);
scene.fog = new THREE.Fog(0xc9b99b, 60, 260);
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 2000);
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x8a6a48, 1.4));
const sun = new THREE.DirectionalLight(0xffe0b8, 3.2);
// the Gilgal sun: low in the west behind the army (16 deg)
sun.position.set(-100, 30, 5);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xbfd0ff, 0.9);
fill.position.set(60, 40, 40);
scene.add(fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: 0xb49a74, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
// a grid of pebbles so the feet can be judged against the ground (sliding)
{
  const g = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshStandardMaterial({ color: 0x6e5a44 }), 1600);
  const m = new THREE.Matrix4();
  let i = 0;
  for (let x = -60; x < 40; x += 2.5) for (let z = -25; z < 25; z += 2.5) if (i < 1600) g.setMatrixAt(i++, m.makeTranslation(x + ((i * 7) % 5) * 0.2, 0, z + ((i * 3) % 5) * 0.2));
  g.count = i;
  scene.add(g);
}
const flat = () => 0;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

let saul: FilmActor | null = null, samuel: FilmActor | null = null, bearer: FilmActor | null = null;
let perf: GilgalPerformance | null = null;
let army: GilgalArmy | null = null;
let ramahPerf: RamahPerformance | null = null;
const elders: FilmActor[] = [];
let cur: { name: string; t: number } | null = null;
const dt = 1 / 30;

function setCam(c: string | number[]) {
  if (Array.isArray(c)) {
    camera.position.set(c[0], c[1], c[2]);
    camera.lookAt(c[3], c[4], c[5]);
    camera.fov = c[6] ?? 40;
    camera.updateProjectionMatrix();
    return;
  }
  const e = new THREE.Vector3(), f = new THREE.Vector3();
  const set = (p: THREE.Vector3, l: THREE.Vector3, fov: number) => {
    camera.position.copy(p);
    camera.lookAt(l);
    camera.fov = fov;
    camera.updateProjectionMatrix();
  };
  if (c === 'side' || c === 'sideN') {
    // profile of the two men (the tear): south (or north) of the line between them
    saul!.root.getWorldPosition(e);
    samuel!.root.getWorldPosition(f);
    const mid = e.clone().lerp(f, 0.5);
    set(V(mid.x, 1.15, mid.z + (c === 'side' ? 5.2 : -5.2)), V(mid.x, 1.0, mid.z), 36);
  } else if (c === 'tearClose') {
    const p = perf!.tearFocus(new THREE.Vector3());
    set(V(p.x + 0.6, p.y + 0.15, p.z + 1.6), p, 34);
  } else if (c === 'samFace') {
    samuel!.eyesWorld(e);
    saul!.eyesWorld(f);
    const d = f.clone().sub(e).setY(0).normalize();
    set(e.clone().addScaledVector(d, 1.05).add(V(0.62 * -d.z, 0.06, 0.62 * d.x)), e.clone().add(V(0, -0.05, 0)), 26);
  } else if (c === 'saulFist') {
    perf!.fistFocus(f);
    saul!.eyesWorld(e);
    const fwd = V(Math.sin(saul!.yaw), 0, Math.cos(saul!.yaw));
    set(f.clone().addScaledVector(fwd, 1.3).add(V(0.35, 0.05, 0.3)), f.clone().lerp(e, 0.45), 34);
  } else if (c === 'saul' || c === 'saulBack') {
    saul!.root.getWorldPosition(e);
    const fwd = V(Math.sin(saul!.yaw), 0, Math.cos(saul!.yaw));
    const s = c === 'saul' ? 1 : -1;
    set(e.clone().addScaledVector(fwd, 4.2 * s).add(V(0.9, 0.8, 0.9)), e.clone().add(V(0, 1.2, 0)), 40);
  } else if (c === 'front') {
    // G1: low in front of the front rank, looking back along the column
    const x = saul ? saul.root.position.x : SAUL_HALT.x;
    set(V(x - 2.2, 0.7, 1.4), V(x - 16, 1.4, 0), 44);
  } else if (c === 'roar') {
    const x = SAUL_HALT.x;
    set(V(x + 7, 1.0, 3.6), V(x - 8, 1.8, 0), 44);
  } else if (c === 'inside') {
    // G4: inside the column at rank ~6, looking east down the road
    const x = SAUL_HALT.x - ARMY.leadGap - 6.5 * ARMY.rankSpacing;
    set(V(x, 1.7, 0.9), V(x + 30, 1.3, 0.4), 30);
  } else if (c === 'wide') {
    const x = saul ? saul.root.position.x : SAUL_HALT.x;
    set(V(x + 4, 6, 26), V(x - 12, 1, 0), 45);
  } else if (c === 'elders') {
    set(V(-6.2, 1.55, 2.4), V(-0.5, 1.2, 0), 42);
  } else if (c === 'eldersSam') {
    samuel!.eyesWorld(e);
    set(V(-2.0, 1.75, 1.3), e, 32);
  }
}

function frame() {
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/jpeg', 0.82);
}

async function boot() {
  await MocapLibrary.shared.preload([...new Set([...GILGAL_CLIPS, ...RAMAH_CLIPS, 'walk', 'idle_n1'])]);
  if (mode === 'gilgal' || mode === 'army') {
    saul = await FilmActor.create({ role: 'saul', quality: q, ground: flat });
    samuel = await FilmActor.create({ role: 'samuel', quality: q, ground: flat });
    saul.addTo(scene);
    samuel.addTo(scene);
    if (P.get('bearer') === '1') {
      bearer = await FilmActor.create({ role: 'armourBearer', quality: q, seed: 3, lod: 'near', ground: flat });
      bearer.addTo(scene);
    }
    perf = new GilgalPerformance({ saul, samuel, armourBearer: bearer ?? undefined }, flat);
  }
  if (mode === 'army') {
    const { GilgalArmy } = await import('../src/film/crowd/GilgalArmy');
    const tier = (P.get('tier') ?? 'mobile-high') as CrowdTier;
    army = await GilgalArmy.create({ tier, ground: flat, impostors: 20, herds: false, heroes: P.get('heroes') === '0' ? false : undefined });
    scene.add(army.group);
    army.crowd.viewportHeight = H;
  }
  if (mode === 'ramah') {
    samuel = await FilmActor.create({ role: 'samuel', quality: q, lod: 'near', ground: flat });
    samuel.addTo(scene);
    const n = +(P.get('elders') ?? 4);
    for (let i = 0; i < n; i++) {
      const e = await FilmActor.create({ role: 'elder', quality: q, seed: i + 1, lod: i < 2 ? 'near' : 'crowd', ground: flat });
      e.addTo(scene);
      elders.push(e);
    }
    // benches: the seated elder faces Samuel across 2.6 m
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 1.6), new THREE.MeshStandardMaterial({ color: 0x8c7a62 }));
    bench.position.set(-2.75, 0.225, 0.4);
    scene.add(bench);
    const marks = [
      { pos: V(-2.62, 0.45, 0.35), yaw: Math.PI / 2, seated: true },
      { pos: V(-3.1, 0, -1.25), yaw: Math.PI / 2 - 0.25 },
      { pos: V(-3.35, 0, 1.55), yaw: Math.PI / 2 + 0.3 },
      { pos: V(-4.2, 0, -0.2), yaw: Math.PI / 2 },
      { pos: V(-4.6, 0, 1.2), yaw: Math.PI / 2 + 0.2 },
      { pos: V(-4.4, 0, -1.6), yaw: Math.PI / 2 - 0.3 },
    ];
    ramahPerf = new RamahPerformance(samuel, elders, { pos: V(0, 0, 0), yaw: -Math.PI / 2 }, marks, flat);
  }
  w.__ready = true;
}

/** simulate a Gilgal shot to time t (sequential) and render */
function shot(name: GilgalShotName, t: number, cam: string | number[] = 'side') {
  if (!perf) throw new Error('mode');
  if (!cur || cur.name !== name || t < cur.t - 1e-6) {
    perf.enter(name);
    samuel!.groom?.setSimulation(P.get('hairsim') === '1' || !(name === 'tear' || name === 'verdict'));
    saul!.groom?.sim?.reset?.();
    samuel!.groom?.sim?.reset?.();
    cur = { name, t: 0 };
    perf.update(0, 0, camera, H);
    army?.setBeat(name, 0);
    army?.update(0, camera);
  }
  setCam(cam);
  while (cur.t < t - 1e-6) {
    const step = Math.min(dt, t - cur.t);
    cur.t += step;
    army?.setBeat(name, cur.t);
    army?.update(step, camera);
    perf.update(cur.t, step, camera, H);
    setCam(cam);
  }
  const s = saulAt(name, t), m = samuelAt(name, t);
  info.textContent = `${name} t=${t.toFixed(2)}  saul ${s.action}  |  samuel ${m.action}`;
  return frame();
}

let ramahT = -1;
function ramah(t: number, cam: string | number[] = 'elders') {
  if (!ramahPerf) throw new Error('mode');
  if (t < ramahT) ramahT = -1;
  if (ramahT < 0) {
    ramahPerf.update(0, 0, camera, H);
    ramahT = 0;
  }
  setCam(cam);
  while (ramahT < t - 1e-6) {
    const step = Math.min(dt, t - ramahT);
    ramahT += step;
    ramahPerf.update(ramahT, step, camera, H);
    setCam(cam);
  }
  info.textContent = `ramah t=${t.toFixed(2)}`;
  return frame();
}

w.__anim = { shot, ramah, frame, setCam, get saul() { return saul; }, get samuel() { return samuel; }, get perf() { return perf; }, get army() { return army; }, THREE };
boot().catch((e) => {
  console.error(e);
  w.__error = String((e && e.stack) || e);
});
