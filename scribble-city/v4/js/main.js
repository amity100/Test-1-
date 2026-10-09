import * as THREE from 'three';
import { shared } from './render/materials.js';
import { Pipeline } from './render/pipeline.js';
import { buildAtlas } from './render/atlas.js';
import { buildCity } from './world/city.js';
import { Game } from './game/game.js';
import { isTouchDevice } from './core/util.js';

// עיר השרבוטים: the first boulevard on the water at sunset, and the whole city around it, drawn
// with coloured pens. Everything you draw becomes real.

const params = new URLSearchParams(location.search);

function fatal(err) {
  const el = document.getElementById('fatal');
  el.classList.remove('hidden');
  el.textContent = 'אופס, משהו נשבר:\n' + (err && (err.stack || err.message) ? err.stack || err.message : String(err));
  console.error(err);
}
window.addEventListener('error', (e) => {
  if (e.error) fatal(e.error);
});
window.addEventListener('unhandledrejection', (e) => fatal(e.reason));

function setStatus(t) {
  const el = document.getElementById('load-status');
  if (el) el.textContent = t;
}

async function loadFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('40px "Gveret Levin"', 'אבג'),
        document.fonts.load('700 40px "Rubik"', 'אבג'),
        document.fonts.load('400 20px "Rubik"', 'אבג'),
        document.fonts.load('40px "Permanent Marker"', 'ABC'),
        // (the ads in the city are English: the Latin letters of Rubik too)
        document.fonts.load('800 40px "Rubik"', 'ABC'),
        document.fonts.load('600 40px "Rubik"', 'ABC'),
        document.fonts.load('400 40px "Rubik"', 'ABC'),
        document.fonts.load('700 40px "Caveat"', 'ABC'),
      ]),
      wait(4000),
    ]);
  } catch (e) {
    // fonts are optional
  }
}

const frame = () => new Promise((r) => setTimeout(r, 10));

async function boot() {
  const touch = isTouchDevice();
  if (touch) document.body.classList.add('touch');
  setStatus('מחדדים את העטים…');
  await loadFonts();

  const low = touch || params.has('low');
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('test') });
  // the screen at (up to) twice its CSS pixels; the drawing itself is made at its own scale of
  // that and brought up sharp (see Pipeline.scale), so a phone shows crisp lines
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  document.getElementById('viewport').appendChild(renderer.domElement);
  shared.uQuality.value = low ? 0 : 1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(touch ? 62 : 55, window.innerWidth / window.innerHeight, 0.1, 3000);
  camera.rotation.order = 'YXZ';
  const pipe = new Pipeline(renderer, scene, camera, { low });
  // drawing pixels per CSS pixel: 1.75 on a phone, 1.5 on a computer (less if the screen has less)
  const want = params.has('pr') ? +params.get('pr') : low ? 1.75 : 1.5;
  pipe.scale = Math.min(1, want / pr);
  // (never coarser than this: a drawing made at too few pixels turns to mush in the distance)
  pipe.minScale = Math.min(pipe.scale, low ? Math.max(0.55, 1.25 / pr) : 0.7);
  pipe.maxScale = 1;
  if (params.has('norefl')) pipe.reflections = false;
  shared.uPR.value = pipe.pixelsPerCss;

  setStatus('מציירים את העיר…');
  await frame();
  const atlas = buildAtlas();
  const t0 = performance.now();
  const world = buildCity(scene, { low });
  console.log('city built', Math.round(performance.now() - t0), 'ms', JSON.stringify(world.stats));

  setStatus('השמש שוקעת על העיר…');
  await frame();
  // the sun's view of the whole city, made once (the long evening shadows across every street)
  world.bakeShadows = () => pipe.bakeFarShadows(world.group, new THREE.Box3(new THREE.Vector3(-262, -1, -600), new THREE.Vector3(36, 95, 345)), low ? 2048 : 4096);
  try {
    world.bakeShadows();
  } catch (err) {
    console.warn('shadow bake failed', err);
  }
  setStatus('מסמנים דרכים…');
  await frame();
  world.buildNav();
  // every pen of the city made ready now, not in the middle of the first walk down the street
  try {
    renderer.compile(scene, camera);
  } catch (err) {
    console.warn('precompile failed', err);
  }

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    shared.uPR.value = pipe.pixelsPerCss;
    const portrait = touch && h > w;
    document.getElementById('rotate-hint').classList.toggle('hidden', !portrait);
  };
  window.addEventListener('resize', resize);
  resize();

  const game = new Game({ renderer, scene, camera, pipe, world, atlas, touch, params });
  window.__game = game;
  if (params.has('test')) {
    window.__shared = shared;
    window.__THREE = THREE;
  }
  await game.init();
  setStatus('');
  const startBtn = document.getElementById('start-btn');
  startBtn.disabled = false;
  startBtn.textContent = 'יוצאים לעיר';
  game.loop();
  if (params.has('autostart')) game.start();
  window.__ready = true;
}

boot().catch(fatal);
