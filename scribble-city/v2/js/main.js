import * as THREE from 'three';
import { shared } from './render/materials.js';
import { Pipeline } from './render/pipeline.js';

const params = new URLSearchParams(location.search);

function fatal(err) {
  const el = document.getElementById('fatal');
  el.classList.remove('hidden');
  el.textContent = 'Something broke:\n' + (err && (err.stack || err.message) ? err.stack || err.message : String(err));
  console.error(err);
}
window.addEventListener('error', (e) => e.error && fatal(e.error));
window.addEventListener('unhandledrejection', (e) => fatal(e.reason));

async function fonts() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 40px "Caveat"', 'ABC'), document.fonts.load('40px "Permanent Marker"', 'ABC'), document.fonts.load('40px "Gveret Levin"', 'אבג')]),
      new Promise((r) => setTimeout(r, 3500)),
    ]);
  } catch (e) {
    // the signs fall back to another hand
  }
}

async function boot() {
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (touch) document.body.classList.add('touch');
  await fonts();
  const low = touch || params.has('low');
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('test') });
  const pr = Math.min(window.devicePixelRatio || 1, low ? 1.0 : 1.5);
  renderer.setPixelRatio(pr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  document.getElementById('view').appendChild(renderer.domElement);
  shared.uPR.value = pr;
  shared.uQuality.value = low ? 0 : 1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(touch ? 62 : 55, window.innerWidth / window.innerHeight, 0.1, 3000);
  camera.rotation.order = 'YXZ';
  const sceneName = params.get('scene') || 'boulevard';
  const mod = sceneName === 'test' ? await import('./world/test.js') : await import('./world/boulevard.js');
  const world = sceneName === 'test' ? mod.buildTestScene(scene) : mod.buildBoulevard(scene);
  const pipe = new Pipeline(renderer, scene, camera, { low });

  const { Game } = await import('./game/game.js');
  const game = new Game({ renderer, scene, camera, pipe, world, touch, params });
  window.__game = game;

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);

  const start = document.getElementById('start');
  start.disabled = false;
  start.textContent = 'יוצאים לשדרה';
  start.addEventListener('click', () => game.start());
  if (params.has('autostart')) game.start();
  game.loop();
  window.__ready = true;
}

boot().catch(fatal);
