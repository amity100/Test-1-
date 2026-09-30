// dev/gilgal.html — the Gilgal set (src/film/gilgal/GilgalSet.ts, ACT I + the rise of the opening film) rendered
// alone through the game's PostFX, with DoF, letterbox and the film look as the film will use them.
//
//   ?q=low|medium|high   content tier (render budget of mobile-low / desktop-medium / desktop-high)
//   ?figs=0              hide the placeholder figures (king 1.98 m, Samuel 1.70 m, the army)
//   ?play=1              play shots 6-13 in a loop; ?hud=1 stats overlay; ?lb=0 no letterbox
//
// Test driver (window.__gilgal): shot(name, u, frames?) renders shot `name` at normalised time u (CameraRig easing
// applied) and returns draw calls; view(pos[3], look[3], fov, frames?); figs(on); stats()
import * as THREE from 'three';
import { makeQuality, type TierName } from '../src/core/Engine';
import { GilgalSet, SHOT_ORDER, type GilgalShotName } from '../src/film/gilgal/GilgalSet';

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.maxPixelRatio));
  renderer.setSize(app.clientWidth, app.clientHeight, false);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  app.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(40, app.clientWidth / app.clientHeight, 0.05, 90000);
  const t0 = performance.now();
  const set = await GilgalSet.create({ renderer, quality: q });
  const buildMs = performance.now() - t0;
  const floatTargets = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const post = set.createPost(camera, {
    msaa: q.msaa, bloom: q.bloom, godRaySamples: q.godRaySamples, aa: q.aa, taa: q.taa, dofSamples: q.dofSamples, sharpen: q.sharpen, filmFx: q.filmFx,
    bloomScale: q.bloomScale, bloomMips: q.bloomMips, colorType: floatTargets ? THREE.HalfFloatType : THREE.UnsignedByteType,
  });
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(size.x, size.y);
  if (params.get('lb') !== '0') post.setLetterbox(2.39, 0);
  post.setFilmLook(0.55, 0);
  set.showPlaceholders(params.get('figs') !== '0');

  let current: GilgalShotName = 'dustWall';
  const applyFrame = (name: GilgalShotName, u: number) => {
    const info = set.shots[name];
    const s = info.shot;
    const e = s.ease !== false ? u * u * (3 - 2 * u) : u;
    const time = u * s.duration;
    set.setBeat(name, time);
    const f = s.at(e, time);
    camera.position.copy(f.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(f.look);
    if (f.roll) camera.rotateZ(f.roll);
    camera.fov = f.fov ?? 40;
    camera.near = camera.position.y - set.height(camera.position.x, camera.position.z) > 200 ? 2 : 0.05;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const fp = info.focus(time);
    if (fp && post.dofAvailable) post.setDoF({ enabled: true, focusDistance: fp.distanceTo(camera.position), fStop: info.fStop, focalLength: null, target: null });
    else post.setDoF({ enabled: false });
  };
  renderer.info.autoReset = false;
  const renderFrame = (dt: number) => {
    renderer.info.reset();
    set.update(dt, camera, { advanceTime: true });
    set.applyExposure(renderer);
    post.render(dt);
  };
  const shot = (name: GilgalShotName, u: number, frames = 3) => {
    if (name !== current) post.resetHistory();
    current = name;
    for (let i = 0; i < frames; i++) {
      applyFrame(name, Math.min(1, u + (i - frames + 1) * 0.002));
      renderFrame(i === 0 ? 0 : 1 / 30);
    }
    return renderer.info.render.calls;
  };
  const view = (p: number[], l: number[], fov = 45, frames = 2) => {
    set.beat = null;
    camera.position.set(p[0], p[1], p[2]);
    camera.lookAt(l[0], l[1], l[2]);
    camera.fov = fov;
    camera.near = 0.5;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    post.setDoF({ enabled: false });
    post.resetHistory();
    for (let i = 0; i < frames; i++) renderFrame(i === 0 ? 0 : 1 / 30);
  };
  const stats = () => ({ ...set.stats(), lastFrame: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }, buildMs: Math.round(buildMs), tier: q.tier, content: q.name, memory: renderer.info.memory });
  w.__gilgal = { set, shot, view, stats, figs: (on: boolean) => set.showPlaceholders(on), THREE, camera, renderer, post };
  w.__ready = true;
  if (params.get('hud') === '1') hud.classList.remove('off');
  if (params.get('play') === '1') {
    let i = 0, t = 0, last = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      const name = SHOT_ORDER[i];
      if (t > set.shots[name].shot.duration) {
        t = 0;
        i = (i + 1) % SHOT_ORDER.length;
        post.resetHistory();
      }
      applyFrame(SHOT_ORDER[i], t / set.shots[SHOT_ORDER[i]].shot.duration);
      renderFrame(dt);
      if (!hud.classList.contains('off')) hud.textContent = `${SHOT_ORDER[i]} ${t.toFixed(1)}s  calls ${renderer.info.render.calls}  tris ${renderer.info.render.triangles}`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
boot().catch((e) => {
  console.error(e);
  w.__error = String((e as Error)?.stack || e);
});
