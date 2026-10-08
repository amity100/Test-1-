import * as THREE from 'three';
import { shared, makeLineMaterial, makeSurfaceMaterial, makeGlassMaterial, makeSkyMesh, setLook, savedLook, look } from './render/materials.js';
import { bakeSunShadows } from './render/sunlight.js';
import { Pipeline } from './render/pipeline.js';
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
  // the screen at (up to) twice its CSS pixels; the drawing itself is made at its own scale of
  // that and brought up sharp (see Pipeline.scale), so a phone shows crisp lines
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('test') });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  document.getElementById('viewport').appendChild(renderer.domElement);
  shared.uQuality.value = lowEnd ? 0 : 1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(touch ? 70 : 64, window.innerWidth / window.innerHeight, 0.12, 3200);
  camera.rotation.order = 'YXZ';
  const skyMesh = makeSkyMesh();
  scene.add(skyMesh);
  const pipe = new Pipeline(renderer, scene, camera, { low: lowEnd });
  // drawing pixels per CSS pixel: 1.75 on a phone, 1.5 on a computer (less if the screen has less)
  const want = params.has('pr') ? +params.get('pr') : lowEnd ? 1.75 : 1.5;
  pipe.scale = Math.min(1, want / pr);
  pipe.minScale = Math.min(pipe.scale, lowEnd ? Math.max(0.5, 1.1 / pr) : 0.6);
  pipe.maxScale = Math.min(1, (lowEnd ? 2 : 1.75) / pr);
  if (params.has('norefl')) pipe.reflections = false;
  if (params.has('refl')) pipe.reflections = true;
  shared.uPR.value = pipe.pixelsPerCss;

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
    glass: makeGlassMaterial(),
    barSurface: makeSurfaceMaterial({ hatchScale: 1.3 }),
  };
  mats.barSurface.uniforms.uTintAll.value.setRGB(1.0, 0.9, 0.78);
  mats.lineFaint = mats.line;

  setStatus('מציירים את העיר…');
  await new Promise((r) => setTimeout(r, 10));
  const t0 = performance.now();
  const world = buildCity(scene, atlas, signAtlas, mats);
  const buildMs = Math.round(performance.now() - t0);
  console.log('city built', buildMs, 'ms', JSON.stringify(world.stats));

  // what the city is made of: the ground only receives shadows and is the mirror itself
  world.group.traverse((o) => {
    o.userData.staticCity = true;
    if (/^(ground|road_)/.test(o.name)) {
      o.userData.flatGround = true;
      o.userData.noReflect = true;
    }
  });
  const sky = new Sky(scene, atlas);

  // the sun's view of the whole city, baked once; steam from the manholes
  setStatus('מצללים את העיר…');
  await new Promise((r) => setTimeout(r, 10));
  try {
    bakeSunShadows(renderer, world.group, lowEnd ? 2048 : 3072, { minX: -260, maxX: 270, minZ: -200, maxZ: 205 });
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
  setLook(1);

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

  const game = new Game({ renderer, scene, camera, pipe, world, atlas, signAtlas, mats, sky, touch, params });
  window.__game = game;
  if (params.has('test')) window.__shared = shared;
  game.onFrame = (dt) => {
    skyMesh.position.copy(camera.position);
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
