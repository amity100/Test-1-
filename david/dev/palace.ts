// dev/palace.html — Saul's house at Gibeah (src/palace/PalaceSet.ts) rendered alone through the game's PostFX.
//
//   ?q=low|medium|high (content tier; render budget of desktop-high / desktop-medium / mobile-low)
//   ?figs=1   grey placeholder figures at the anchors (king 1.98 m)
//   ?play=1   play all shots in a loop (interactive); otherwise wait for the test driver
//   ?hud=1    stats overlay
//
// Test driver API (window.__palace):
//   ready: boolean;  shot(name, u, frames?) -> renders shot `name` ('establishingExterior' | 'tamariskAndWalls' |
//   'enterHall' | 'throneReveal' | 'tamariskCourt' | 'insert0..2') at normalised time u (CameraRig easing applied);
//   figs(on); stats(); view(pos[3], look[3], fov)
import * as THREE from 'three';
import { makeQuality, type TierName } from '../src/core/Engine';
import { PalaceSet } from '../src/palace/PalaceSet';
import type { Shot } from '../src/gameplay/CameraRig';

const app = document.getElementById('app')!;
const hud = document.getElementById('hud')!;
const params = new URLSearchParams(location.search);
const w = window as unknown as Record<string, unknown>;

async function boot() {
  const qn = (params.get('q') ?? 'high') as 'low' | 'medium' | 'high';
  const tier: TierName = qn === 'high' ? 'desktop-high' : qn === 'medium' ? 'desktop-medium' : 'mobile-low';
  const q = makeQuality(tier, qn === 'low', '');
  const renderer = new THREE.WebGLRenderer({ antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const pr = Math.min(window.devicePixelRatio || 1, q.maxPixelRatio);
  renderer.setPixelRatio(pr);
  renderer.setSize(app.clientWidth, app.clientHeight, false);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  app.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(45, app.clientWidth / app.clientHeight, 0.08, 26000);
  const t0 = performance.now();
  const palace = await PalaceSet.create({ renderer, quality: q });
  const buildMs = performance.now() - t0;
  const floatTargets = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const post = palace.createPost(camera, {
    msaa: q.msaa, bloom: q.bloom, godRaySamples: q.godRaySamples, aa: q.aa, sharpen: q.sharpen, filmFx: q.filmFx,
    bloomScale: q.bloomScale, bloomMips: q.bloomMips, colorType: floatTargets ? THREE.HalfFloatType : THREE.UnsignedByteType,
  });
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(size.x, size.y);
  palace.showPlaceholders(params.get('figs') === '1');

  const shots: Record<string, Shot> = {
    establishingExterior: palace.shots.establishingExterior,
    tamariskAndWalls: palace.shots.tamariskAndWalls,
    enterHall: palace.shots.enterHall,
    throneReveal: palace.shots.throneReveal,
    tamariskCourt: palace.shots.tamariskCourt,
    insert0: palace.shots.detailInserts[0],
    insert1: palace.shots.detailInserts[1],
    insert2: palace.shots.detailInserts[2],
  };
  const applyFrame = (s: Shot, u: number) => {
    const e = s.ease !== false ? u * u * (3 - 2 * u) : u;
    const f = s.at(e, u * s.duration);
    camera.position.copy(f.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(f.look);
    if (f.roll) camera.rotateZ(f.roll);
    camera.fov = f.fov ?? 50;
    camera.near = 0.08;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };
  renderer.info.autoReset = false;
  const renderFrame = (dt: number) => {
    renderer.info.reset();
    palace.update(dt, camera, { advanceTime: true });
    palace.applyExposure(renderer);
    post.render(dt);
  };
  const shot = (name: string, u: number, frames = 2) => {
    const s = shots[name];
    if (!s) throw new Error('no shot ' + name);
    applyFrame(s, u);
    palace.interior = -1; // snap the exposure blend
    for (let i = 0; i < frames; i++) renderFrame(i === 0 ? 0 : 1 / 30);
    return renderer.info.render.calls;
  };
  const view = (p: number[], l: number[], fov = 45, frames = 2) => {
    camera.position.set(p[0], p[1], p[2]);
    camera.lookAt(l[0], l[1], l[2]);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    for (let i = 0; i < frames; i++) renderFrame(i === 0 ? 0 : 1 / 30);
  };
  const stats = () => {
    const st = palace.stats();
    return { ...st, lastFrame: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }, buildMs: Math.round(buildMs), tier: q.tier, content: q.name, memory: renderer.info.memory };
  };
  w.__palace = { palace, shot, view, stats, figs: (on: boolean) => palace.showPlaceholders(on), THREE, camera, renderer, post };
  w.__ready = true;
  if (params.get('hud') === '1') hud.classList.remove('off');
  if (params.get('play') === '1') {
    const list = palace.shots.all;
    let i = 0, t = 0;
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      if (t > list[i].duration) {
        t = 0;
        i = (i + 1) % list.length;
      }
      applyFrame(list[i], t / list[i].duration);
      renderFrame(dt);
      if (!hud.classList.contains('off')) hud.textContent = `shot ${i}  calls ${renderer.info.render.calls}  tris ${renderer.info.render.triangles}  exp ${palace.exposure.toFixed(2)}`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
boot().catch((e) => {
  console.error(e);
  w.__error = String((e as Error)?.stack || e);
});
