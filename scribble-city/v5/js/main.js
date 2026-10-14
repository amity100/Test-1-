import * as THREE from 'three';
import { shared, pens } from './render/materials.js';
import { Settings } from './core/settings.js';
import { Pipeline } from './render/pipeline.js';
import { buildAtlas } from './render/atlas.js';
import { buildCity } from './world/city.js';
import { buildGarages } from './world/garages.js';
import { buildStation } from './world/station.js';
import { buildRoofs } from './world/roofs.js';
import { buildPanes } from './world/glass.js';
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
  // (the test route is drawn at this, whatever the resolution has come down to: game/perf.js)
  pipe.defaultScale = pipe.scale;
  // (never coarser than this: a drawing made at too few pixels turns to mush in the distance)
  pipe.minScale = Math.min(pipe.scale, low ? Math.max(0.55, 1.25 / pr) : 0.7);
  // (the steady pace, when it is chosen, may come down further on a computer: a weak graphics
  // card that cannot keep the beat otherwise; game/pace.js)
  pipe.minScaleSteady = low ? pipe.minScale : Math.min(pipe.scale, 0.5);
  // which graphics card draws (where the browser tells): none, in software (SwiftShader, llvmpipe,
  // the basic render driver), and every frame takes seconds
  const gl0 = renderer.getContext();
  const dbg = gl0.getExtension('WEBGL_debug_renderer_info');
  pipe.gpuName = String((dbg && gl0.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) || gl0.getParameter(gl0.RENDERER) || '');
  pipe.software = /swiftshader|llvmpipe|softpipe|basic render|software rasterizer/i.test(pipe.gpuName);
  if (pipe.software) {
    const note = document.getElementById('gpu-note');
    note.textContent = 'הדפדפן מצייר את המשחק בלי כרטיס המסך, ולכן הוא איטי מאוד. כדי שירוץ חלק מדליקים בהגדרות של הדפדפן את "האצת החומרה" (בכרום: הגדרות ← מערכת), ופותחים את הדפדפן מחדש.';
    note.classList.remove('hidden');
  }
  pipe.maxScale = 1;
  if (params.has('taafrac')) pipe.taaFrac = Math.min(1, Math.max(0.4, +params.get('taafrac') || 0.67));
  // (the steady pace begins from these, game/pace.js)
  pipe.defaultTaaFrac = pipe.taaFrac;
  if (params.has('norefl')) pipe.reflections = false;
  if (params.has('mirrorpens')) pipe.mirrorPlain = false;
  if (params.has('depth') || params.has('nodepth')) {
    pipe.depthFirst = params.has('depth');
    pipe.depthFixed = true;
  }
  // (the mirror under the street every frame; a phone every other one, as it always was)
  pipe.reflEvery = low ? 2 : 1;
  pipe.reflEveryDefault = pipe.reflEvery;
  shared.uPR.value = pipe.pixelsPerCss;
  // (ROADMAP 11.4) the drawing in two passes - the surfaces, then the pens over the whole picture,
  // once a pixel - on a computer whose graphics card writes six pictures at once, in float
  // colours: as the player chose it (the settings: 'auto' tries it in play against the one pass,
  // render/depthtrial.js; 'two'; 'one', as it always was), decided before the city's pens are made.
  // ?pens=auto, two or one decides instead; ?pens=off: the pens' shaders exactly as they were
  {
    const pp = params.get('pens');
    pens.can = !low && pipe.hdr && pp !== 'off' && gl0.getParameter(gl0.MAX_DRAW_BUFFERS) >= 6 && gl0.getParameter(gl0.MAX_COLOR_ATTACHMENTS) >= 6;
    const ways = ['auto', 'two', 'one'];
    const kept = new Settings().get('pens');
    const mode = ways.includes(pp) ? pp : ways.includes(kept) ? kept : 'auto';
    pipe.pensMode = pens.can ? mode : 'one';
    pipe.setPens(pipe.pensMode !== 'one');
  }

  setStatus('מציירים את העיר…');
  await frame();
  const atlas = buildAtlas();
  const t0 = performance.now();
  // (not with ?classic: the service station on Flamingo Ave, ROADMAP 4.6; the police station on the
  // fountain plaza, ROADMAP 6.3; the roofs to climb onto, ROADMAP 5.1)
  const extra = (ctx) => {
    buildGarages(ctx);
    buildStation(ctx);
    buildRoofs(ctx);
    // (the shop windows' panes, last: ROADMAP 8.3)
    buildPanes(ctx);
  };
  const world = buildCity(scene, params.has('classic') ? { low } : { low, extra, neonRows: 56, roofs: true, glass: true, fences: false });
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
  // the still city's own map of the sun's view around you (drawn again only when you have gone far
  // enough, or a prop was rubbed out): each frame only what moves is drawn for the sun
  if (!params.has('noshadowcache')) pipe.setStatic(world.group, { cull: (p) => world.cull(p), version: () => world.objects.castVersion });
  // what is behind the buildings' bodies is not drawn (the city's still pieces, not the moving ones)
  if (!params.has('noocclusion')) {
    const skip = new Set(pipe.staticSkip || []);
    const pieces = world.group.children.filter((o) => o.isMesh && !skip.has(o));
    pipe.setOcclusion(world.occluders, pieces, () => world.objects.spots);
  }
  // (v5) the walls' depth first, alone: their backs and what is behind them are not worked out
  // with the pens (render/pipeline.js setWalls: off for now, timed by the test route; ?walls: on)
  pipe.setWalls(world.group);
  // (the sea, the bay and the pools: the mirror is drawn only while some of them is in sight, or
  // the streets are wet - render/pipeline.js setWaters; ?mirroralways: every frame, as it was)
  pipe.setWaters(world.group);
  if (params.has('mirroralways')) pipe.mirrorAlways = true;
  if (params.has('walls')) pipe.wallsFirst = true;
  // (v5) and the still city's pens without their scissors wherever nothing of them is rubbed out
  // or crumbling: the graphics card leaves out what is hidden before the pens are worked out
  // (render/solid.js; ?nosolid: as it was)
  if (!params.has('nosolid')) pipe.setSolid(world.group, () => world.objects.spots, () => world.objects.fading.length > 0);
  setStatus('מסמנים דרכים…');
  await frame();
  world.buildNav();
  // every pen of the city made ready now, not in the middle of the first walk down the street
  // (the graphics card compiles them side by side where it can, and the page stays alive)
  setStatus('מכינים את העטים…');
  try {
    if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) {
      // (drawn in two passes, the pens' own pass too)
      if (pipe.deferred) await renderer.compileAsync(pipe.pensScene(), pipe.quadCam);
      await renderer.compileAsync(scene, camera);
      // (the still city's own pens, with their scissors, for the first rubbed-out spot: in the
      // background, render/solid.js)
      if (pipe.solid) renderer.compileAsync(pipe.solid.standIns(), camera).catch(() => {});
    } else {
      if (pipe.deferred) renderer.compile(pipe.pensScene(), pipe.quadCam);
      renderer.compile(scene, camera);
    }
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
  else game.showContinue();
  window.__ready = true;
  // (the pens' shaders for the other way of drawing, made ready in the background a little after the
  // game begins - for trying the two in play: render/pipeline.js prepareOtherPens)
  pipe.otherAt = performance.now() + 1500;
}

boot().catch(fatal);
