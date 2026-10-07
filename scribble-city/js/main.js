import * as THREE from 'three';
import { shared, makeLineMaterial, makeSurfaceMaterial, makeSkyMesh, setLook, savedLook, look, GOLDEN_SUN } from './render/materials.js';
import { bakeSunShadows, updateSkyUniforms } from './render/sunlight.js';
import { Steam } from './render/steam.js';
import { buildAtlas } from './render/atlas.js';
import { buildSignAtlas } from './render/signs.js';
import { buildCity } from './world/city.js';
import { Sky } from './render/sky.js';
import { Game } from './game/game.js';
import { isTouchDevice } from './core/util.js';

THREE.ColorManagement.enabled = false;

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
        document.fonts.load('700 40px "Caveat"', 'ABC'),
      ]),
      wait(4000),
    ]);
  } catch (e) {
    // fonts are optional
  }
}

async function boot() {
  const touch = isTouchDevice();
  if (touch) document.body.classList.add('touch');
  setStatus('מחדדים עפרונות…');
  await loadFonts();

  const lowEnd = touch || params.has('low');
  const renderer = new THREE.WebGLRenderer({ antialias: !lowEnd, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('test') });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const pr = Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xf8f4e9, 1);
  document.getElementById('viewport').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(touch ? 70 : 64, window.innerWidth / window.innerHeight, 0.12, 1400);
  camera.rotation.order = 'YXZ';
  scene.add(makeSkyMesh());

  setStatus('מציירים ספרייטים…');
  await new Promise((r) => setTimeout(r, 10));
  const atlas = buildAtlas();
  const signAtlas = buildSignAtlas();

  const mats = {
    surface: makeSurfaceMaterial({ hatchScale: 1.7 }),
    surfaceFaint: makeSurfaceMaterial({ hatchScale: 1.7 }),
    line: makeLineMaterial({}),
    itemSurface: makeSurfaceMaterial({ hatchScale: 0.45, side: THREE.DoubleSide }),
    itemLine: makeLineMaterial({ nudge: 0.0015, minWidth: 1.0 }),
  };
  mats.lineFaint = mats.line;

  setStatus('מציירים את העיר…');
  await new Promise((r) => setTimeout(r, 10));
  const t0 = performance.now();
  const world = buildCity(scene, atlas, signAtlas, mats);
  const buildMs = Math.round(performance.now() - t0);
  console.log('city built', buildMs, 'ms', JSON.stringify(world.stats));

  const sky = new Sky(scene, atlas);

  // golden-hour look: bake the sun's view of the city once; steam from the manholes
  setStatus('מצללים את העיר…');
  await new Promise((r) => setTimeout(r, 10));
  try {
    bakeSunShadows(renderer, world.group, GOLDEN_SUN, 2048);
    look.shadowsReady = true;
  } catch (err) {
    console.warn('shadow bake failed', err);
  }
  const steam = new Steam(scene, mats.line);
  look.onChange = (id) => {
    steam.visible = id === 1;
    const box = document.getElementById('opt-look');
    if (box) box.checked = id === 1;
  };
  setLook(params.has('look') ? +params.get('look') : savedLook());

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    shared.uResolution.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    shared.uPR.value = renderer.getPixelRatio();
    const portrait = touch && h > w;
    document.getElementById('rotate-hint').classList.toggle('hidden', !portrait);
  };
  window.addEventListener('resize', resize);
  resize();

  const game = new Game({ renderer, scene, camera, world, atlas, signAtlas, mats, sky, touch, params });
  window.__game = game;
  game.onFrame = (dt) => {
    updateSkyUniforms(camera);
    steam.update(dt, camera.position);
  };
  await game.init();
  setStatus('');
  const startBtn = document.getElementById('start-btn');
  startBtn.disabled = false;
  startBtn.textContent = '▶ פותחים את המחברת';
  game.loop();
  if (params.has('autostart') || params.has('free')) game.start();
  window.__ready = true;
}

boot().catch(fatal);
