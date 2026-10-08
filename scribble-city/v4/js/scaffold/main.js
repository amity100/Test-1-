import * as THREE from 'three';
import { shared } from '../render/materials.js';
import { Pipeline } from '../render/pipeline.js';
import { buildCity } from '../world/city.js';

const params = new URLSearchParams(location.search);
function fatal(err) {
  const el = document.getElementById('fatal');
  el.classList.remove('hidden');
  el.textContent = 'Something broke:\n' + (err && (err.stack || err.message) ? err.stack || err.message : String(err));
  console.error(err);
}
window.addEventListener('error', (e) => e.error && fatal(e.error));
window.addEventListener('unhandledrejection', (e) => fatal(e.reason));

async function boot() {
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (touch) document.body.classList.add('touch');
  try {
    await Promise.race([Promise.all([document.fonts.load('700 40px "Caveat"', 'ABC'), document.fonts.load('40px "Permanent Marker"', 'ABC'), document.fonts.load('700 40px "Rubik"', 'ABC')]), new Promise((r) => setTimeout(r, 3500))]);
  } catch (e) {}
  const low = touch || params.has('low');
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('test') });
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  document.getElementById('view').appendChild(renderer.domElement);
  shared.uQuality.value = low ? 0 : 1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(touch ? 62 : 55, window.innerWidth / window.innerHeight, 0.1, 3000);
  camera.rotation.order = 'YXZ';
  const world = buildCity(scene, {});
  console.log('city', JSON.stringify(world.stats));
  window.__world = world;
  const pipe = new Pipeline(renderer, scene, camera, { low });
  const want = params.has('pr') ? +params.get('pr') : low ? 1.75 : 1.5;
  pipe.scale = Math.min(1, want / pr);
  pipe.minScale = Math.min(pipe.scale, low ? Math.max(0.5, 1.1 / pr) : 0.6);
  pipe.maxScale = 1;
  shared.uPR.value = pipe.pixelsPerCss;
  if (!params.has('nofar')) {
    const t0 = performance.now();
    pipe.bakeFarShadows(world.group, new THREE.Box3(new THREE.Vector3(-260, 0, -600), new THREE.Vector3(40, 90, 340)), low ? 2048 : 4096);
    console.log('far shadows', Math.round(performance.now() - t0), 'ms');
  }
  const { Game } = await import('./game.js');
  const game = new Game({ renderer, scene, camera, pipe, world, touch, params });
  window.__game = game;
  const start = document.getElementById('start');
  start.disabled = false;
  start.textContent = 'start';
  start.addEventListener('click', () => game.start());
  if (params.has('autostart')) game.start();
  game.loop();
  window.__ready = true;
}
boot().catch(fatal);
