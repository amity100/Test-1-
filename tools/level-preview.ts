/**
 * Level preview: renders buildTower() with the golden-hour sky, skyline and a
 * lighting rig like the game's. `?view=<name>` picks a camera; `?orbit=1`
 * lets you fly around with the mouse. Sets window.__ready after the frame is
 * drawn (used by tools/level-shots.mjs).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildTower } from '../src/world/tower';
import { createSky, createSkyline, createSkyEnvMap, LampSystem } from '../src/render/fx';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const VIEWS: Record<string, { pos: THREE.Vector3; look: THREE.Vector3; fov?: number }> = {
  start: { pos: V(26, 3.2, -66.5), look: V(4, 22, 20), fov: 62 },
  aerial: { pos: V(-120, 75, -115), look: V(0, 28, 15), fov: 50 },
  pier: { pos: V(-2, 9.5, -52), look: V(-6, 0, -30), fov: 62 },
  arena: { pos: V(-24, 6.8, -13.7), look: V(10, 2, -6), fov: 62 },
  yard: { pos: V(6, 13.5, 14), look: V(27, 8, 8), fov: 62 },
  tower: { pos: V(-2, 2.5, -8), look: V(0, 48, 40), fov: 62 },
  skeleton: { pos: V(-8.4, 31.7, 23.6), look: V(6, 31, 44), fov: 62 },
  shaft: { pos: V(3.1, 44.5, 36.4), look: V(3.2, 24, 37.6), fov: 70 },
  lab: { pos: V(-3.5, 61.8, 23.2), look: V(2, 61, 42), fov: 62 },
  crown: { pos: V(11, 92.2, 57), look: V(-6, 91, 34), fov: 62 },
  leap: { pos: V(-20, 92.8, 43), look: V(-60, 50, 40), fov: 62 },
  sunset: { pos: V(-6, 3.2, -28), look: V(-100, 12, -52), fov: 62 },
  east: { pos: V(75, 22, 30), look: V(0, 40, 35), fov: 55 },
};

const params = new URLSearchParams(location.search);
const viewName = params.get('view') ?? 'aerial';
const view = VIEWS[viewName] ?? VIEWS.aerial;
const mobile = params.get('mobile') === '1';
const hud = document.getElementById('hud')!;

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(view.fov ?? 60, window.innerWidth / window.innerHeight, 0.1, 1400);
camera.position.copy(view.pos);
camera.lookAt(view.look);

const t0 = performance.now();
const envMap = createSkyEnvMap(renderer);
const level = buildTower(envMap, mobile);
const tBuild = performance.now() - t0;
scene.add(level.root);
scene.environment = envMap;
scene.environmentIntensity = level.atmosphere.environmentIntensity;
for (const p of level.props) scene.add(level.propMesh(p));

const sky = createSky();
(sky.material as THREE.ShaderMaterial).uniforms.uSunDir.value.copy(level.sunDir);
scene.add(sky);
scene.add(createSkyline({ mobile, sunDir: level.sunDir }));
const A = level.atmosphere;
scene.fog = new THREE.FogExp2(new THREE.Color(A.fogColor), A.fogDensity);
renderer.toneMappingExposure = A.exposure;
const hemi = new THREE.HemisphereLight(A.hemiSky, A.hemiGround, A.hemiIntensity);
scene.add(hemi);
const sun = new THREE.DirectionalLight(A.sunColor, A.sunIntensity);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
const sc = sun.shadow.camera;
sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
scene.add(sun, sun.target);
const focus = view.look.clone();
if (viewName === 'aerial' || viewName === 'east') focus.set(0, 25, 10);
sun.position.copy(focus).addScaledVector(level.sunDir, 180);
sun.target.position.copy(focus);
const lamps = new LampSystem(level.lamps, 6, false);
scene.add(lamps.group);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.45, 0.5, 0.95));
composer.addPass(new OutputPass());
composer.setSize(window.innerWidth, window.innerHeight);

let draws = 0;
renderer.info.autoReset = false;
const frame = (t: number) => {
  renderer.info.reset();
  for (const f of level.animated) f(t);
  (sky.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
  sky.position.copy(camera.position);
  lamps.update(t, camera.position);
  composer.render();
  draws = renderer.info.render.calls;
};

if (params.get('orbit') === '1') {
  const ctl = new OrbitControls(camera, renderer.domElement);
  ctl.target.copy(view.look);
  const loop = () => {
    ctl.update();
    frame(performance.now() / 1000);
    hud.textContent = `${viewName} | draws ${draws} | tris ${renderer.info.render.triangles} | build ${tBuild.toFixed(0)} ms | colliders ${level.world.colliders.length}`;
    requestAnimationFrame(loop);
  };
  loop();
} else {
  frame(12.5);
  frame(12.6);
  hud.textContent = `${viewName} | draws ${draws} | tris ${renderer.info.render.triangles} | build ${tBuild.toFixed(0)} ms | colliders ${level.world.colliders.length}`;
  (window as any).__stats = { draws, tris: renderer.info.render.triangles, build: tBuild, colliders: level.world.colliders.length };
  (window as any).__ready = true;
}
