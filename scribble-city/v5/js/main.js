import * as THREE from 'three';
import { shared, pens, mergeMoving } from './render/materials.js';
import { Settings } from './core/settings.js';
import { Pipeline } from './render/pipeline.js';
import { buildAtlas } from './render/atlas.js';
import { buildCity } from './world/city.js';
import { Mainland } from './world/mainland/index.js';
import { Interiors } from './world/interiors.js';
import { buildGarages } from './world/garages.js';
import { buildStation } from './world/station.js';
import { buildRoofs } from './world/roofs.js';
import { buildPanes } from './world/glass.js';
import { Game } from './game/game.js';
import { prebuildFolkBodies } from './render/folkshapes.js';
import { FOLK, FOLK_PHONE } from './render/folkspec.js';
import { isTouchDevice } from './core/util.js';
import { initProvoke } from './render/provoke.js';
import { cacheUniformArrays } from './render/glcache.js';
import { readMemo } from './render/depthtrial.js';
import { BUILD } from './game/telemetry.js';
import { setupAdmin } from './ui/admin.js';
import { setupStartLang, applyStartLang } from './ui/startlang.js';

// (the game's own folder, v5/ - for its pictures, sounds and data, wherever the code is loaded from:
// these modules one by one, or all of them in one file next to this one - tools/publish-pages.sh)
window.__gameBase = new URL('../', import.meta.url).href;
import { browserName } from './game/perf.js';

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

// (how long each step of getting ready takes: logged together when the game is ready - the load's
// own numbers, to see where its time goes on any computer)
// (the first: the page's code itself, every module of it, fetched and read - from the page's start
// until this one runs)
const loadT = [['modules', Math.round(performance.now())]];
let loadAt = performance.now();
function mark(name) {
  const now = performance.now();
  loadT.push([name, Math.round(now - loadAt)]);
  loadAt = now;
}

function setStatus(t) {
  const el = document.getElementById('load-status');
  if (el) el.textContent = t;
  // (and the loading screen's line under its bar, index.html #loader)
  const ld = document.getElementById('ld-status');
  if (ld && t) ld.textContent = t;
}

// (v5, ROADMAP 18.9) how far the load has got, 0..1 - the loading screen's bar (index.html #loading):
// each step its share of the whole, as long as they take on a computer; within a step, by its parts
const SHARE = { fonts: 0.03, city: 0.36, mainland: 0.02, upload: 0.03, shadow: 0.03, people: 0.1, nav: 0.02, pens: 0.03, init: 0.14, pictures: 0.04, shaders: 0.2 };
const ORDER = Object.keys(SHARE);
let progStep = 'fonts';
let progIn = 0;
function progress(step, within = 0) {
  if (step) progStep = step;
  progIn = Math.max(0, Math.min(1, within));
  let p = 0;
  for (const k of ORDER) {
    if (k === progStep) {
      p += SHARE[k] * progIn;
      break;
    }
    p += SHARE[k];
  }
  if (window.__loadProgress) window.__loadProgress(Math.min(1, p));
}

// (v5, ROADMAP 18.9) a breath for the page while it loads: after some 40 ms of work, the thread given
// back for a moment - the loading screen moves, the computer under it is not held up. Called between
// the parts of a long step (world/city.js, render/folkshapes.js): null when it is not yet time
let breathAt = performance.now();
let breathN = 0;
function breathe(label) {
  breathN++;
  const now = performance.now();
  if (now - breathAt < 40) return null;
  // (what still held the page long, before this breath: the test route reads it)
  if (now - breathAt > 250) (window.__slowBreaths = window.__slowBreaths || []).push([label, Math.round(now - breathAt)]);
  if (label === 'block' || label === 'ground' || label === 'boulevard' || label === 'blocks' || label === 'ocean' || label === 'streets' || label === 'extra' || label === 'hills' || label === 'towers' || label === 'landmarks' || label === 'north' || label === 'pens' || label === 'meshes' || label === 'rooms') progress('city', Math.min(0.98, breathN / 30));
  return new Promise((r) =>
    setTimeout(() => {
      breathAt = performance.now();
      r();
    }, 0),
  );
}

// (v5, ROADMAP 18.9) the city's meshes sent up to the graphics card a few at a time, before anything
// needs them all at once (the sun's view of the whole city, next): each drawn once, alone, by a
// stand-in sharing its geometry into a speck of a picture - its buffers up on the card - some 16 MB
// a breath. All at once they held the card, and the computer with it, for seconds
async function uploadGradually(renderer, group, step) {
  const list = [];
  group.traverse((o) => {
    if ((o.isMesh || o.isLineSegments || o.isPoints) && o.geometry && o.geometry.attributes && o.geometry.attributes.position) list.push(o);
  });
  const rt = new THREE.WebGLRenderTarget(4, 4);
  const sc = new THREE.Scene();
  const basic = new THREE.MeshBasicMaterial();
  const cam = new THREE.OrthographicCamera(-1e6, 1e6, 1e6, -1e6, -1e6, 1e6);
  const keep = renderer.getRenderTarget();
  // (drawn with none of their points: three.js sends a shape's buffers up as it is put in the
  // picture, before it looks how many of its points to draw - so the card is given the buffers and
  // nothing to draw with them)
  const bytes = (g) => {
    let n = g.index ? g.index.array.byteLength : 0;
    for (const k in g.attributes) n += g.attributes[k].array ? g.attributes[k].array.byteLength : 0;
    return n;
  };
  const seen = new Set();
  let budget = 0;
  let held = [];
  for (let i = 0; i < list.length; i++) {
    const g = list[i].geometry;
    if (!seen.has(g)) {
      seen.add(g);
      const stand = new THREE.Mesh(g, basic);
      stand.frustumCulled = false;
      sc.add(stand);
      held.push([g, g.drawRange.start, g.drawRange.count]);
      g.setDrawRange(0, 0);
      budget += bytes(g);
    }
    if (budget > 16e6 || i === list.length - 1) {
      try {
        renderer.setRenderTarget(rt);
        renderer.render(sc, cam);
      } catch (e) {
        // (whatever could not go up now goes up when it is first drawn, as before)
      }
      for (const [hg, a, n] of held) hg.setDrawRange(a, n);
      held = [];
      renderer.setRenderTarget(keep);
      sc.clear();
      budget = 0;
      progress(step, (i + 1) / list.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  rt.dispose();
  basic.dispose();
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
        // (ROADMAP 13.2: BAYVIEW MALL's boards, the couture houses' letters)
        document.fonts.load('600 40px "Cinzel"', 'ABC'),
        document.fonts.load('700 40px "Cinzel"', 'ABC'),
        document.fonts.load('500 40px "Rubik"', 'ABC'),
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
  // (round 16: the start screen's language choice, and its words in it - ui/startlang.js)
  setupStartLang();
  setStatus('מחדדים את העטים…');
  progress('fonts', 0.2);
  await loadFonts();
  progress('city', 0);

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
  // (never coarser than this: a drawing made at too few pixels turns to mush in the distance. v5,
  // ROADMAP 11.43: higher than it was - the game looks as it should all the time; what is least
  // seen is given up first, game.js applyDetail)
  pipe.minScale = Math.min(pipe.scale, low ? Math.max(0.6, 1.4 / pr) : 0.85);
  // (the steady pace, when it is chosen, may come down a little further on a computer: a weak
  // graphics card that cannot keep the beat otherwise; game/pace.js)
  pipe.minScaleSteady = low ? pipe.minScale : Math.min(pipe.scale, 0.8);
  // which graphics card draws (where the browser tells): none, in software (SwiftShader, llvmpipe,
  // the basic render driver), and every frame takes seconds
  const gl0 = renderer.getContext();
  // (11.5) the surfaces' flat values from a triangle's first corner, where the browser lets the game
  // choose: on Windows that takes the geometry shader the browser put in front of every triangle
  // out of the drawing and the mirror (render/provoke.js; ?provokelast: as it was). And again if the
  // graphics context is lost and comes back
  initProvoke(gl0, params.has('provokelast'));
  // (v5, ROADMAP 11.39) the shared arrays sent to a shader only when they changed (render/glcache.js;
  // ?nouniformcache: as it was)
  if (!params.has('nouniformcache')) cacheUniformArrays(gl0);
  renderer.domElement.addEventListener('webglcontextrestored', () => initProvoke(renderer.getContext(), params.has('provokelast')));
  const dbg = gl0.getExtension('WEBGL_debug_renderer_info');
  pipe.gpuName = String((dbg && gl0.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) || gl0.getParameter(gl0.RENDERER) || '');
  pipe.software = /swiftshader|llvmpipe|softpipe|basic render|software rasterizer/i.test(pipe.gpuName);
  if (pipe.software) {
    const note = document.getElementById('gpu-note');
    note.textContent = 'הדפדפן מצייר את המשחק בלי כרטיס המסך, ולכן הוא איטי מאוד. כדי שירוץ חלק מדליקים בהגדרות של הדפדפן את "האצת החומרה" (בכרום: הגדרות ← מערכת), ופותחים את הדפדפן מחדש.';
    note.classList.remove('hidden');
    const ldNote = document.getElementById('ld-note');
    if (ldNote) {
      ldNote.textContent = note.textContent;
      ldNote.classList.remove('hidden');
    }
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
  // (11.5) what trying the ways in play chose here before, in this build of the game and this
  // browser: kept, and not tried again (render/depthtrial.js readMemo). ?trials: tried again
  const trialDev = `${pipe.gpuName}|${browserName()}`;
  const memo = params.has('trials') ? null : readMemo(BUILD, trialDev);
  pipe.trialMemo = { build: BUILD, dev: trialDev, kept: memo };
  const memoOf = (k) => (memo && typeof memo[k] === 'boolean' ? memo[k] : null);
  if (!pipe.depthFixed && memoOf('depth') !== null) {
    pipe.depthFirst = memoOf('depth');
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
  // (11.5: a phone too - it begins in one pass, as it always was, and tries the two in play. Its
  // compiler keeps the pens' work far apart from the rest's there: on a Mali the surfaces' pass
  // spills nothing to memory and the pens' own pass little. Six pictures a pixel are much for a
  // phone's memory, so only the trial decides)
  {
    const pp = params.get('pens');
    pens.can = pipe.hdr && pp !== 'off' && gl0.getParameter(gl0.MAX_DRAW_BUFFERS) >= 6 && gl0.getParameter(gl0.MAX_COLOR_ATTACHMENTS) >= 6;
    const ways = ['auto', 'two', 'one'];
    const kept = new Settings().get('pens');
    const mode = ways.includes(pp) ? pp : ways.includes(kept) ? kept : 'auto';
    pipe.pensMode = pens.can ? mode : 'one';
    // (the two ways tried here before: the one kept, from the start - render/depthtrial.js)
    const was = memoOf('pens');
    if (pipe.pensMode === 'auto' && was !== null) pipe.pensKnown = true;
    pipe.setPens(pipe.pensMode === 'two' || (pipe.pensMode === 'auto' && (was !== null ? was : !low)));
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
  mark('before city');
  // (the block 5th Street Garage stands on left empty for it: not in the lab, where the prologue's
  // pieces are not built - game/prologue/carpark.js)
  const vacate = !params.has('lab') && !window.SC_LAB;
  const world = await buildCity(scene, params.has('classic') ? { low, breathe } : { low, extra, neonRows: 56, roofs: true, glass: true, fences: false, vacate, breathe });
  console.log('city built', Math.round(performance.now() - t0), 'ms', JSON.stringify(world.stats));
  mark('city');
  // (v5, ROADMAP 11.17) the mainland across the bay: built near you as you go (its far bodies
  // from the bake, world/mainland/far.json, when it is there)
  if (world.ctx.mainland) {
    let farData = null;
    try {
      const res = await fetch(new URL('js/world/mainland/far.json', window.__gameBase));
      if (res.ok) farData = await res.json();
    } catch (e) {
      farData = null;
    }
    world.mainland = new Mainland(world, { renderer, pipe, low, farData });
  }
  mark('mainland');
  progress('mainland', 1);
  // (v5, ROADMAP 11.18) what is on the shops' shelves, built near you (the island's rooms now, each
  // block's with it)
  world.interiors = new Interiors(world, { pipe, low, warm: world.mainland ? (m) => world.mainland.warm(m) : null });
  world.interiors.addAll(world.stockRecs);
  mark('interiors');

  // (ROADMAP 18.9: the city up on the graphics card a little at a time, first)
  setStatus('מעלים את העיר…');
  await uploadGradually(renderer, world.group, 'upload');
  mark('upload');
  setStatus('השמש שוקעת על העיר…');
  progress('shadow', 0.1);
  await frame();
  // the sun's view of the whole city, made once (the long evening shadows across every street)
  world.bakeShadows = () => pipe.bakeFarShadows(world.group, new THREE.Box3(new THREE.Vector3(-262, -1, -600), new THREE.Vector3(36, 95, 345)), low ? 2048 : 4096);
  try {
    world.bakeShadows();
  } catch (err) {
    console.warn('shadow bake failed', err);
  }
  mark('shadow bake');
  // (ROADMAP 18.9: the city's people's bodies made now, a few at a time - not all at once inside the
  // game's own start: render/folkshapes.js prebuildFolkBodies)
  setStatus('מציירים את האנשים…');
  {
    const nK = touch ? FOLK_PHONE : FOLK.length;
    let made = 0;
    await prebuildFolkBodies(nK, (label) => {
      made += 4;
      progress('people', made / nK);
      return breathe(label);
    });
  }
  mark('people');
  // the still city's own map of the sun's view around you (drawn again only when you have gone far
  // enough, or a prop was rubbed out): each frame only what moves is drawn for the sun
  if (!params.has('noshadowcache')) pipe.setStatic(world.group, { cull: (p) => world.cull(p), version: () => world.objects.castVersion });
  mark('static shadow');
  // what is behind the buildings' bodies is not drawn (the city's still pieces, not the moving ones)
  if (!params.has('noocclusion')) {
    const skip = new Set(pipe.staticSkip || []);
    const pieces = world.group.children.filter((o) => o.isMesh && !skip.has(o));
    pipe.setOcclusion(world.occluders, pieces, () => world.objects.spots);
  }
  mark('occlusion');
  // (v5) the walls' depth first, alone: their backs and what is behind them are not worked out
  // with the pens (render/pipeline.js setWalls: off for now, timed by the test route; ?walls: on)
  pipe.setWalls(world.group);
  // (the sea, the bay and the pools: the mirror is drawn only while some of them is in sight, or
  // the streets are wet - render/pipeline.js setWaters; ?mirroralways: every frame, as it was)
  pipe.setWaters(world.group);
  if (params.has('mirroralways')) pipe.mirrorAlways = true;
  mark('walls, waters');
  // (ROADMAP 11.32) a mall's great hall: the mirror is its polished floor's, the floor the camera is
  // over (a hair over its stone); ?nofloormirror: the hall's light in the floor instead, as a phone
  if (!params.has('nofloormirror')) {
    pipe.floorAt = (p) => {
      for (const m of world.malls || []) {
        if (!m.mega) continue;
        // (its arcade over the avenue: one floor, the first)
        const a = m.arcade;
        if (a && p.x > a.x0 && p.x < a.x1 && p.z > a.z0 && p.z < a.z1 && p.y > a.y + 0.2 && p.y < a.y + a.top) return { y: a.y + 0.03, box: [a.x0 - 2, a.z0 - 2, a.x1 + 2, a.z1 + 2, a.y + a.top + 2] };
        const h = m.hall;
        if (!h || p.x < h.x0 || p.x > h.x1 || p.z < h.z0 || p.z > h.z1) continue;
        const rel = p.y - h.y;
        if (rel < 0.2 || rel > h.top) continue;
        let k = 0;
        for (let i = 1; i < m.levels.length; i++) if (m.levels[i] < rel - 0.3) k = i;
        const r = m.rect;
        return { y: h.y + m.levels[k] + 0.03, box: [r.x0 - 2, r.z0 - 2, r.x1 + 2, r.z1 + 2, m.height || h.y + h.top + 20] };
      }
      return null;
    };
  }
  // (11.5: the mirror drawn only where the water in sight reads it; ?mirrorfull: all of it, as it was)
  if (params.has('mirrorfull')) pipe.mirrorPartOn = false;
  // (the walls' depth first: tried in play, render/depthtrial.js; ?walls / ?nowalls: fixed, no trying)
  if (params.has('walls') || params.has('nowalls')) {
    pipe.wallsFirst = params.has('walls');
    pipe.wallsFixed = true;
  } else if (memoOf('walls') !== null) {
    pipe.wallsFirst = memoOf('walls');
    pipe.wallsFixed = true;
  }
  // (v5) and the still city's pens without their scissors wherever nothing of them is rubbed out
  // or crumbling: the graphics card leaves out what is hidden before the pens are worked out
  // (render/solid.js; ?nosolid: as it was)
  if (!params.has('nosolid')) pipe.setSolid(world.group, () => world.objects.spots, () => world.objects.fading.length > 0);
  mark('solid');
  setStatus('מסמנים דרכים…');
  progress('nav', 0);
  await frame();
  world.buildNav();
  mark('nav');
  progress('pens', 0);
  await frame();
  // every pen of the city made ready now, not in the middle of the first walk down the street
  // (the graphics card compiles them side by side where it can, and the page stays alive): asked
  // for now, while the game's people and cars are made; theirs after, and all of them waited for
  // (11.5: render/pipeline.js precompile - made as the frames draw with them)
  setStatus('מכינים את העטים…');
  // (ROADMAP 11.47) and every pen the city may yet draw with - the mainland's blocks, the malls, the
  // shops' goods - as the blocks will wear them (shared, and the still city's twin of each), made
  // now with the rest: a shader first made in play stops the picture while it is made, on a phone
  // a second or more each time (?nocatalog: as it was)
  const catalog = params.has('nocatalog') ? null : penCatalog(world, pipe);
  if (catalog) scene.add(catalog);
  const progs = pipe.precompile();
  if (catalog) scene.remove(catalog);
  mark('precompile');

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
  progress('init', 0);
  await frame();
  game.breathe = (label) => {
    progress('init', Math.min(0.95, (game.__inits = (game.__inits || 0) + 1) / 9));
    return breathe(label);
  };
  await game.init();
  game.breathe = null;
  mark('game init');
  // (ROADMAP 18.9: and every picture they are drawn with sent up, one at a time)
  progress('pictures', 0);
  await picturesUp(renderer, scene);
  mark('pictures');
  progress('shaders', 0);
  for (const p of pipe.precompile()) progs.push(p);
  const allProgs = [...new Set(progs)];
  const startBtn = document.getElementById('start-btn');
  const open = () => {
    setStatus('');
    progress('shaders', 1);
    if (window.__loadDone) window.__loadDone();
    startBtn.disabled = false;
    // (round 16: in the language chosen on the start screen - ui/startlang.js)
    applyStartLang();
  };
  const run = () => {
    mark('shaders ready');
    if (catalog) warmCatalog(game, catalog);
    // (and shown with the frame's numbers, F3: game/perf.js - the whole of it from the page's start)
    game.loadSteps = loadT;
    game.loadTotal = Math.round(performance.now());
    game.loop();
    if (params.has('autostart')) game.start();
    window.__ready = true;
    console.log('load steps (ms)', JSON.stringify(loadT));
    // (the pens' shaders for the other way of drawing, made ready in the background a little after
    // the game begins - for trying the two in play: render/pipeline.js prepareOtherPens)
    pipe.otherAt = performance.now() + 1500;
  };
  if (params.has('test') || params.has('autostart')) {
    await shadersReady(renderer, allProgs);
    open();
    run();
    if (!params.has('autostart')) game.showContinue();
    return;
  }
  // (ROADMAP 18.9, round 9: the loading shorter - the title page as soon as the city and the game are
  // made; the graphics card makes its shaders behind it, while it is read and its button pressed, and
  // the city comes up behind it once they are made. A game begun before that waits the moment out
  // behind the prologue's black)
  open();
  game.showContinue();
  // (the maker's door on the start screen: the prologue's films, behind a password - ui/admin.js)
  try {
    setupAdmin(game);
  } catch (e) {
    console.warn('admin', e);
  }
  shadersReady(renderer, allProgs).then(run, run).catch(fatal);
}

// (ROADMAP 11.47) a stand-in for every pen of the city, as the blocks will wear it: the pen itself,
// the shared pen it is merged into (world/city.js merge, mergeObj) and their twins without the
// scissors (render/solid.js) - hidden, for render/pipeline.js precompile to make their shaders
function penCatalog(world, pipe) {
  const M = world.ctx && world.ctx.M;
  if (!M) return null;
  const pens = new Set();
  const look = (o) => {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v && v.isShaderMaterial) pens.add(v);
    }
  };
  look(M);
  if (M.store) look(M.store);
  if (world.mainM) look(world.mainM);
  const all = new Set();
  for (const m of pens) {
    if (!m.uniforms || !m.uniforms.uKind) continue;
    // (and the pen of what moves - a mall's fountain, its lifts: render/materials.js mergeMoving)
    for (const v of [m, world.merge && world.merge(m), world.mergeObj && world.mergeObj(m), mergeMoving(m)]) {
      if (!v) continue;
      all.add(v);
      const t = pipe.solid ? pipe.solid.twinFor(v) : null;
      if (t) all.add(t);
    }
  }
  const geo = new THREE.BufferGeometry();
  const n = 3;
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.01, 0, 0, 0, 0.01, 0], 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  for (const [name, w] of [['aId', 1], ['aObj', 1], ['aMat', 1], ['aSway', 1]]) geo.setAttribute(name, new THREE.Float32BufferAttribute(new Float32Array(n * w), w));
  const g = new THREE.Group();
  g.name = 'pen catalog';
  for (const m of all) {
    const mesh = new THREE.Mesh(geo, m);
    mesh.frustumCulled = false;
    mesh.position.y = -500;
    g.add(mesh);
  }
  return g;
}

// (ROADMAP 11.47) the catalog drawn once in the frame's own passes - a speck of each pen just in
// front of the camera, behind the loading page: some graphics cards finish a shader only when it is
// first drawn with, and for each kind of picture it is drawn into
function warmCatalog(game, catalog) {
  const cam = game.camera;
  cam.updateMatrixWorld();
  const fwd = cam.getWorldDirection(new THREE.Vector3());
  const right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  catalog.children.forEach((m, i) => {
    m.position.copy(cam.position).addScaledVector(fwd, 2.5).addScaledVector(right, ((i % 24) - 12) * 0.03).addScaledVector(up, (Math.floor(i / 24) - 4) * 0.03);
  });
  game.scene.add(catalog);
  // (and what is drawn over the ink only now and then - the rain, its splashes: shown for these two
  // frames, a drop or two of each)
  const after = [];
  for (const m of game.pipe.afterInk.children) {
    after.push([m, m.visible, m.geometry && m.geometry.instanceCount]);
    m.visible = true;
    if (m.geometry && m.geometry.instanceCount === 0) m.geometry.instanceCount = 1;
  }
  try {
    game.renderFrame();
    game.renderFrame();
  } catch (e) {
    console.warn('pen catalog warm failed', e);
  }
  for (const [m, v, n] of after) {
    m.visible = v;
    if (n !== undefined && m.geometry) m.geometry.instanceCount = n;
  }
  game.scene.remove(catalog);
}

// (11.5) the shaders asked for (render/pipeline.js precompile) all made, where the graphics card
// makes them alongside the game - counted on the loading page; elsewhere they were made as asked.
// Never more than two minutes: then the frames make what is left, as before
// (ROADMAP 18.9: where the card cannot say whether a shader is made without waiting for it, each is
// waited for by itself, a breath between - the page alive, not held for all of them at once in the
// first frame)
async function shadersReady(renderer, progs) {
  const n = progs.length;
  if (!renderer.extensions.has('KHR_parallel_shader_compile')) {
    for (let i = 0; i < n; i++) {
      try {
        progs[i].getUniforms();
      } catch (e) {
        // (one that will not make: the frame says why, as before)
      }
      setStatus(`מכינים את העטים… ${i + 1}/${n}`);
      progress('shaders', (i + 1) / n);
      await new Promise((r) => setTimeout(r, 0));
    }
    return;
  }
  const t0 = performance.now();
  for (;;) {
    let left = 0;
    for (const p of progs) if (!p.isReady()) left++;
    progress('shaders', (n - left) / Math.max(1, n));
    if (!left || performance.now() - t0 > 120000) return;
    setStatus(`מכינים את העטים… ${n - left}/${n}`);
    await new Promise((r) => setTimeout(r, 60));
  }
}

// (ROADMAP 18.9) every picture the city and its people are drawn with sent up to the graphics card
// one at a time, a breath between - not all of them in the first frame (the people's atlases, the
// city's pens' pictures, the signs')
async function picturesUp(renderer, scene) {
  const texs = new Set();
  const take = (v) => {
    if (v && v.isTexture && !v.isRenderTargetTexture) texs.add(v);
  };
  const look = (m) => {
    if (!m) return;
    for (const k in m) take(m[k]);
    if (m.uniforms)
      for (const k in m.uniforms) {
        const v = m.uniforms[k] && m.uniforms[k].value;
        if (Array.isArray(v)) v.forEach(take);
        else take(v);
      }
  };
  scene.traverse((o) => {
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(look);
  });
  const list = [...texs];
  for (let i = 0; i < list.length; i++) {
    try {
      renderer.initTexture(list[i]);
    } catch (e) {
      // (it goes up when it is first drawn, as before)
    }
    progress('pictures', (i + 1) / list.length);
    const b = breathe('pictures');
    if (b) await b;
  }
}

boot().catch(fatal);
