/*
 * dev/crowd.html — harness of the film crowds (src/film/crowd).
 *   ?view=dust|side|roar|close|far|phil|sheet  &shot=<gilgal shot>  &t=<shot seconds>  &tier=desktop-high|mobile-low
 *   &w=&h=  &ranks=N
 * A plain late-afternoon Jordan-valley stage (low sun in the west, marl ground, haze) so the crowd can be judged on
 * its own; window.__info reports bake time, LOD counts, triangles, CPU per update.
 */
import * as THREE from 'three';
import { GilgalArmy } from '../src/film/crowd/GilgalArmy';
import { PhilistineHost } from '../src/film/crowd/PhilistineHost';
import { SAUL_HALT } from '../src/film/gilgal/gilgalLayout';
import { armyAt, saulAt, type GilgalShotName } from '../src/film/gilgal/gilgalBlocking';
import type { CrowdTier } from '../src/film/crowd/Crowd';

declare global {
  interface Window { __ready?: boolean; __error?: string; __info?: unknown }
}
const P = new URLSearchParams(location.search);
const W = +(P.get('w') || 960), H = +(P.get('h') || 540);
const view = P.get('view') || 'dust';
const tier = (P.get('tier') || 'desktop-high') as CrowdTier;
const shot = (P.get('shot') || (view.startsWith('roar') ? 'spearRaised' : view === 'part' ? 'silence' : 'dustWall')) as GilgalShotName;
const T = +(P.get('t') || (view.startsWith('roar') ? 4.2 : 3));

async function main() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const phil = view === 'phil';
  const sky = phil ? new THREE.Color(0xb9c6cf) : new THREE.Color(0xd9c7a4);
  scene.background = sky;
  scene.fog = new THREE.FogExp2(sky.getHex(), phil ? 0.0022 : 0.006);
  const hemi = new THREE.HemisphereLight(phil ? 0xbfd0e0 : 0xc9d4e0, 0x8a7458, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a8, 3.2);
  const el = THREE.MathUtils.degToRad(phil ? 22 : 12.5), az = THREE.MathUtils.degToRad(phil ? 80 : -95);
  const toSun = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = sc.bottom = -45;
  sc.right = sc.top = 45;
  sc.near = 1;
  sc.far = 300;
  scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: phil ? 0xc9b98f : 0xd8cfbb, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 5000);
  const info: Record<string, unknown> = {};
  const t0 = performance.now();
  let update: (dt: number) => void;
  let target = new THREE.Vector3();
  if (!phil) {
    const army = await GilgalArmy.create({ tier, ranks: P.get('ranks') ? +P.get('ranks')! : undefined });
    info.bakeMs = Math.round(army.anim.bakeMs);
    info.frames = army.anim.totalFrames;
    info.lodTris = army.crowd.lodTriangles;
    scene.add(army.group);
    if (P.get('mask')) for (const a of army.crowd.agents) a.mask = +P.get('mask')!;
    // a stand-in king at the head (the cast teammate's Saul goes here)
    const king = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.5, 4, 8), new THREE.MeshStandardMaterial({ color: 0x7a2020, roughness: 0.6 }));
    king.castShadow = true;
    scene.add(king);
    update = (dt) => {
      army.setBeat(shot, tSim);
      army.update(dt, camera);
      const s = saulAt(shot, tSim);
      king.position.set(s.pos.x, 0.97, s.pos.z);
    };
    const front = armyAt(shot, T).frontX;
    target.set(front - 12, 1.4, 0.4);
    switch (view) {
      case 'dust': camera.position.set(front + 9, 0.9, 2.5); camera.lookAt(front - 18, 2.2, -0.5); camera.fov = 38; break;
      case 'side': camera.position.set(front - 20, 1.7, 26); camera.lookAt(front - 20, 1.2, 0); break;
      case 'close': camera.position.set(front - 3.5, 1.65, 7.5); camera.lookAt(front - 8.5, 1.2, 0); camera.fov = 34; break;
      case 'roar': camera.position.set(SAUL_HALT.x - 1, 1.3, 9.5); camera.lookAt(SAUL_HALT.x - 17, 2.6, -1); camera.fov = 42; break;
      case 'roarwide': camera.position.set(SAUL_HALT.x + 6, 3.0, 9); camera.lookAt(SAUL_HALT.x - 30, 1.2, -2); camera.fov = 44; break;
      case 'part': camera.position.set(SAUL_HALT.x + 20, 1.7, 1.2); camera.lookAt(SAUL_HALT.x - 10, 1.4, 0.4); camera.fov = 36; break;
      case 'far': camera.position.set(front + 50, 22, 60); camera.lookAt(front - 40, 0, 0); break;
      case 'one': camera.position.set(front - 5.5 + 3.2, 1.2, 0.4); camera.lookAt(front - 5.5, 1.0, 0.4); camera.fov = 45; break;
      case 'sheet': camera.position.set(front - 6.5, 1.3, 4.2); camera.lookAt(front - 6.5, 1.0, 0); camera.fov = 45; break;
    }
    sun.position.copy(target).addScaledVector(toSun, 150);
    sun.target.position.copy(target);
  } else {
    const host = await PhilistineHost.create({ tier, count: +(P.get('count') || 1400) });
    info.bakeMs = Math.round(host.anim.bakeMs);
    info.lodTris = host.crowd.lodTriangles;
    scene.add(host.group);
    update = (dt) => host.update(dt, camera);
    const c = host.center;
    camera.position.set(c.x + 60, 14, c.z + 140);
    camera.lookAt(c.x - 10, 0, c.z);
    target = c.clone();
    sun.position.copy(target).addScaledVector(toSun, 150);
    sun.target.position.copy(target);
    sc.left = sc.bottom = -120;
    sc.right = sc.top = 120;
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  info.loadMs = Math.round(performance.now() - t0);
  // simulate up to T (CPU only), render the last frame
  let tSim = 0;
  const dt = 1 / 30;
  let cpu = 0, nUp = 0;
  while (tSim < T) {
    const a = performance.now();
    update(Math.min(dt, T - tSim) || dt);
    cpu += performance.now() - a;
    nUp++;
    tSim += dt;
  }
  update(0);
  info.cpuMsPerUpdate = +(cpu / Math.max(1, nUp)).toFixed(3);
  renderer.render(scene, camera);
  const a = performance.now();
  renderer.render(scene, camera);
  info.renderMs = Math.round(performance.now() - a);
  info.calls = renderer.info.render.calls;
  info.triangles = renderer.info.render.triangles;
  window.__info = info;
  (document.getElementById('info') as HTMLElement).textContent = `${view} ${shot} t=${T} ${tier}`;
  window.__ready = true;
}
main().catch((e) => {
  console.error(e);
  window.__error = String(e?.stack ?? e);
});
