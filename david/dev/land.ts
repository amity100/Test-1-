// dev/land.html — the prologue's land sets (src/film/land/LandSet.ts) rendered alone through the game's PostFX.
//
//   ?loc=judah|coast|ramah   ?q=low|medium|high   ?figs=0 (hide placeholders)   ?play=1 (loop the sequence)
//
// Test driver (window.__land): shot(name, u, frames?) renders shot `name` at normalised time u; view(pos, look, fov);
// stats(); names(): shot names.
import * as THREE from 'three';
import { makeQuality, type TierName } from '../src/core/Engine';
import { PostFX } from '../src/fx/PostFX';
import { LandSet, type LandLocation } from '../src/film/land/LandSet';

const app = document.getElementById('app')!;
const hud = document.getElementById('hud')!;
const params = new URLSearchParams(location.search);
const w = window as unknown as Record<string, unknown>;

async function boot() {
  const qn = (params.get('q') ?? 'high') as 'low' | 'medium' | 'high';
  const tier: TierName = qn === 'high' ? 'desktop-high' : qn === 'medium' ? 'desktop-medium' : 'mobile-low';
  const q = makeQuality(tier, qn === 'low', '');
  const loc = (params.get('loc') ?? 'judah') as LandLocation;
  const renderer = new THREE.WebGLRenderer({ antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.maxPixelRatio));
  renderer.setSize(app.clientWidth, app.clientHeight, false);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  app.appendChild(renderer.domElement);
  const set = await LandSet.create({ renderer, quality: q, location: loc });
  const camera = new THREE.PerspectiveCamera(45, app.clientWidth / app.clientHeight, set.near, set.far);
  const floatTargets = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const post = new PostFX(renderer, set.scene, camera, set.sky.cubeTarget.texture as THREE.CubeTexture, {
    msaa: 0, bloom: q.bloom, godRaySamples: q.godRaySamples, aa: q.aa, sharpen: q.sharpen, filmFx: q.filmFx,
    bloomScale: q.bloomScale, bloomMips: q.bloomMips, colorType: floatTargets ? THREE.HalfFloatType : THREE.UnsignedByteType, taa: false,
  });
  const a = post.atmosphere.uniforms;
  a.uDensity.value = set.atmosphere.density;
  a.uHeightFalloff.value = set.atmosphere.heightFalloff;
  a.uBaseHeight.value = set.atmosphere.baseHeight;
  a.uGodRays.value = set.atmosphere.godRays;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(size.x, size.y);
  set.showPlaceholders(params.get('figs') !== '0');
  // ?host=1: the crowd teammate's PhilistineHost on the coast anchors (instead of the placeholders)
  let host: { group: THREE.Object3D; update(dt: number, cam: THREE.Camera): void } | null = null;
  if (params.get('host') === '1' && set.anchors.coast) {
    const { PhilistineHost } = await import('../src/film/crowd/PhilistineHost');
    const a = set.anchors.coast;
    const h = await PhilistineHost.create({ tier: q.tier, trail: [a.columnHead, ...a.route.slice().reverse().filter((p) => p.x < a.columnHead.x - 1)], columnWidth: a.columnWidth, ground: (x, z) => set.height.height(x, z) });
    set.scene.add(h.group);
    host = h as unknown as typeof host;
    set.showPlaceholders(false);
  }
  const applyFrame = (name: string, u: number) => {
    const s = set.shots[name];
    if (!s) throw new Error('no shot ' + name);
    const f = set.frame(s, u);
    camera.position.copy(f.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(f.look);
    camera.fov = f.fov ?? 45;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };
  renderer.info.autoReset = false;
  const renderFrame = (dt: number) => {
    renderer.info.reset();
    set.update(dt, camera);
    host?.update(dt, camera);
    renderer.toneMappingExposure = set.exposure;
    post.render(dt);
  };
  const shot = (name: string, u: number, frames = 2) => {
    applyFrame(name, u);
    for (let i = 0; i < frames; i++) renderFrame(i === 0 ? 0 : 1 / 30);
    return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };
  const view = (p: number[], l: number[], fov = 45, frames = 2) => {
    camera.position.set(p[0], p[1], p[2]);
    camera.lookAt(l[0], l[1], l[2]);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    for (let i = 0; i < frames; i++) renderFrame(i === 0 ? 0 : 1 / 30);
  };
  const snap = (name: string, u: number, frames = 2) => { shot(name, u, frames); return renderer.domElement.toDataURL('image/png'); };
  w.__land = { set, shot, snap, view, names: () => Object.keys(set.shots), stats: () => ({ ...set.stats(renderer), tier: q.tier, memory: renderer.info.memory }), camera, renderer, post, THREE };
  w.__ready = true;
  if (params.get('hud') === '1') hud.classList.remove('off');
  if (params.get('play') === '1') {
    const names = Object.keys(set.shots);
    let i = 0, t = 0, last = performance.now();
    const loop = () => {
      const now = performance.now(); const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
      const s = set.shots[names[i]];
      if (t > s.duration) { t = 0; i = (i + 1) % names.length; }
      applyFrame(names[i], t / s.duration);
      renderFrame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
boot().catch((e) => { console.error(e); w.__error = String((e as Error)?.stack || e); });
