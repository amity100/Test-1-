// dev/map.html — the realistic 3D map of CUT v5 (src/film/map/MapSet.ts) alone through the game's PostFX, with the
// film's letterbox and its label layer: iterate on the look / camera / route / labels without the whole film.
//
//   ?q=desktop-high|desktop-medium|mobile-high|mobile-low   ?lb=0 (no letterbox)   ?play=exodus|tribes (real time)
//
// window.__mapH: shot(take, t, frames?) renders take 'exodus' | 'tribes' at shot second t (frames: settle TAA /
// dt = 1/30 between them); stats(); ready.
import * as THREE from 'three';
import '../src/ui/style.css';
import { makeQuality, type TierName } from '../src/core/Engine';
import { PostFX } from '../src/fx/PostFX';
import { createMapSet } from '../src/film/map/MapSet';
import { applyHandheld, portraitLens } from '../src/film/FilmCams';
import type { ShotFrame } from '../src/gameplay/CameraRig';

const app = document.getElementById('app')!;
const info = document.getElementById('info')!;
const params = new URLSearchParams(location.search);
const w = window as unknown as Record<string, unknown>;

async function boot() {
  const tier = (params.get('q') ?? 'desktop-high') as TierName;
  const q = makeQuality(tier, tier.startsWith('mobile'), '');
  const renderer = new THREE.WebGLRenderer({ antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setSize(app.clientWidth, app.clientHeight, false);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  app.appendChild(renderer.domElement);
  const floatTargets = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const scene0 = new THREE.Scene();
  const cam0 = new THREE.PerspectiveCamera();
  const cubeRT = new THREE.WebGLCubeRenderTarget(8);
  const post = new PostFX(renderer, scene0, cam0, cubeRT.texture, {
    msaa: 0, bloom: q.bloom, godRaySamples: q.godRaySamples, aa: q.aa, sharpen: q.sharpen, filmFx: q.filmFx,
    bloomScale: q.bloomScale, bloomMips: q.bloomMips, colorType: floatTargets ? THREE.HalfFloatType : THREE.UnsignedByteType, taa: false,
  });
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(size.x, size.y);
  if (params.get('lb') !== '0') post.setLetterbox(2.39, 0);
  post.setFilmLook(0.85, 0);
  const t0 = performance.now();
  const handle = await createMapSet({ quality: q, renderer, post }, {});
  const buildMs = performance.now() - t0;
  const v = handle.view;
  const cam = handle.camera;
  post.setView(v.scene, cam, null);
  const a = post.atmosphere.uniforms;
  a.uDensity.value = 0;
  a.uGodRays.value = 0;
  renderer.info.autoReset = false;
  const f: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 30, roll: 0 };
  let filmT = 0;
  const pose = (take: string, t: number) => {
    cam.aspect = app.clientWidth / Math.max(1, app.clientHeight);
    handle.enter(take);
    handle.tick(take, t, 0);
    handle.frame(take, 0, t, f);
    applyHandheld(take, t, filmT, f);
    portraitLens(f, null, cam.aspect);
    cam.position.copy(f.pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(f.look);
    if (f.roll) cam.rotateZ(f.roll);
    cam.fov = f.fov ?? 30;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  };
  const renderFrame = (dt: number) => {
    renderer.info.reset();
    v.update?.(dt, cam);
    renderer.toneMappingExposure = typeof v.exposure === 'function' ? v.exposure() : v.exposure ?? 0.6;
    post.render(dt);
  };
  const shot = (take: string, t: number, frames = 2) => {
    filmT = (take === 'tribes' ? 37 : 24) + t;
    for (let i = 0; i < frames; i++) {
      pose(take, t);
      renderFrame(i === 0 ? 0 : 1 / 30);
    }
    const r = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, near: cam.near, far: cam.far, fov: cam.fov };
    info.textContent = `${take} t=${t.toFixed(2)}  calls ${r.calls}  tris ${(r.tris / 1e6).toFixed(2)}M  near ${r.near.toFixed(0)} far ${(r.far / 1000).toFixed(0)}km  fov ${r.fov.toFixed(1)}`;
    return r;
  };
  w.__mapH = { shot, handle, post, renderer, buildMs, stats: () => ({ tier: q.tier, buildMs, memory: renderer.info.memory, status: handle.status }) };
  w.__ready = true;
  if (params.get('hud') === '0') info.style.display = 'none';
  const play = params.get('play');
  if (play) {
    let t = 0, last = performance.now();
    const dur = play === 'tribes' ? 9 : 13;
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t = (t + dt) % dur;
      shot(play, t, 1);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else shot('exodus', 6, 2);
}
boot().catch((e) => {
  console.error(e);
  w.__error = String((e as Error)?.stack || e);
});
