// dev/court.html — King Saul and his court (src/palace/cast) on the set of his house at Gibeah, rendered through
// the game's PostFX, beat by beat (src/content/introScript.ts).
//
//   ?q=low|medium|high   content tier (render budget of desktop-high / desktop-medium / mobile-low)
//   ?beats=a,b           beats the cast is built for (default: every palace beat)
//   ?hud=1               stats overlay     ?play=1  play every beat's shots in a loop
//
// Test driver (window.__court):
//   ready; beat(name, t?) stages a beat; shot(beat, index, u, frames?) renders shot `index` of cast.beatShots(beat)
//   at normalised time u; view(pos[3], look[3], fov, frames?); focus(name) -> [x,y,z]; stats()
import * as THREE from 'three';
import { makeQuality, type TierName } from '../src/core/Engine';
import { PalaceSet } from '../src/palace/PalaceSet';
import { PalaceCast } from '../src/palace/cast';
import type { Shot } from '../src/gameplay/CameraRig';
import type { IntroBeat } from '../src/content/introScript';

const app = document.getElementById('app')!;
const hud = document.getElementById('hud')!;
const params = new URLSearchParams(location.search);
const w = window as unknown as Record<string, unknown>;

async function boot() {
  const qn = (params.get('q') ?? 'high') as 'low' | 'medium' | 'high';
  const tier: TierName = qn === 'high' ? 'desktop-high' : qn === 'medium' ? 'desktop-medium' : 'mobile-low';
  const q = makeQuality(tier, qn === 'low', '');
  const renderer = new THREE.WebGLRenderer({ antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setSize(app.clientWidth, app.clientHeight, false);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  app.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(45, app.clientWidth / app.clientHeight, 0.05, 26000);
  const t0 = performance.now();
  const palace = await PalaceSet.create({ renderer, quality: q });
  const tSet = performance.now();
  const beats = params.get('beats')?.split(',') as IntroBeat[] | undefined;
  const cast = await PalaceCast.create(palace, { quality: qn, msaa: q.msaa, beats, onProgress: (f, l) => (hud.textContent = `cast ${(f * 100).toFixed(0)}% ${l}`) });
  const tCast = performance.now();
  const floatTargets = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  // ?taa=0 for quick iteration renders (FXAA instead); the game's desktop tiers use TAA
  const taaParam = params.get('taa');
  const qx = q as unknown as { taa?: false | 'hq' | 'lq'; dofSamples?: number };
  const taa = taaParam === '0' ? false : qx.taa ?? false;
  const post = palace.createPost(camera, {
    ...({ taa, dofSamples: qx.dofSamples ?? 0 } as object),
    msaa: q.msaa, bloom: q.bloom, godRaySamples: q.godRaySamples, aa: taa ? q.aa : 'fxaa', sharpen: q.sharpen, filmFx: q.filmFx,
    bloomScale: q.bloomScale, bloomMips: q.bloomMips, colorType: floatTargets ? THREE.HalfFloatType : THREE.UnsignedByteType,
  });
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(size.x, size.y);

  const applyFrame = (s: Shot, u: number) => {
    const e = s.ease !== false ? u * u * (3 - 2 * u) : u;
    const f = s.at(e, u * s.duration);
    camera.position.copy(f.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(f.look);
    if (f.roll) camera.rotateZ(f.roll);
    camera.fov = f.fov ?? 50;
    camera.near = 0.05;
    camera.aspect = size.x / size.y;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };
  renderer.info.autoReset = false;
  const renderFrame = (dt: number) => {
    renderer.info.reset();
    cast.update(dt, camera, size.y);
    palace.update(dt, camera, { advanceTime: true });
    palace.applyExposure(renderer);
    post.render(dt);
  };
  let curBeat: IntroBeat | null = null;
  const beat = (b: IntroBeat, t = 0) => {
    curBeat = b;
    cast.setBeat(b, t);
  };
  const shot = (b: IntroBeat, i: number, u: number, frames = 3) => {
    if (curBeat !== b) beat(b, 0);
    const list = cast.beatShots(b);
    const s = list[i];
    if (!s) throw new Error(`no shot ${i} for ${b}`);
    applyFrame(s, u);
    palace.interior = -1;
    // advance the beat's performance to the shot time (Abner walking etc.)
    for (let k = 0; k < frames; k++) renderFrame(k === 0 ? 0 : 1 / 30);
    return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };
  const view = (p: number[], l: number[], fov = 35, frames = 3) => {
    camera.position.set(p[0], p[1], p[2]);
    camera.lookAt(l[0], l[1], l[2]);
    camera.fov = fov;
    camera.near = 0.05;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    palace.interior = -1;
    for (let i = 0; i < frames; i++) renderFrame(i === 0 ? 0 : 1 / 30);
    return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };
  const advance = (sec: number, step = 1 / 15) => {
    for (let t = 0; t < sec; t += step) cast.update(step, camera, size.y);
  };
  const stats = () => ({
    cast: cast.stats(),
    lastFrame: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles },
    setMs: Math.round(tSet - t0),
    castMs: Math.round(tCast - tSet),
    tier: q.tier,
    memory: renderer.info.memory,
    programs: renderer.info.programs?.length,
  });
  const focus = (n: Parameters<PalaceCast['focus']>[0]) => cast.focus(n).toArray();
  w.__court = { palace, cast, beat, shot, view, stats, focus, advance, THREE, camera, renderer, post };
  w.__ready = true;
  if (params.get('hud') === '1') hud.classList.remove('off');
  else hud.classList.add('off');
  if (params.get('play') === '1') {
    const order: IntroBeat[] = ['gibeah', 'saul-court', 'saul-portrait', 'warriors', 'saul-hall', 'hinge'];
    let bi = 0, si = 0, t = 0;
    let last = performance.now();
    beat(order[0]);
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      let list = cast.beatShots(order[bi]);
      if (t > list[si].duration) {
        t = 0;
        si++;
        if (si >= list.length) {
          si = 0;
          bi = (bi + 1) % order.length;
          beat(order[bi]);
          list = cast.beatShots(order[bi]);
        }
      }
      applyFrame(list[si], t / list[si].duration);
      renderFrame(dt);
      if (!hud.classList.contains('off')) hud.textContent = `${order[bi]} #${si}  calls ${renderer.info.render.calls}  tris ${renderer.info.render.triangles}`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
boot().catch((e) => {
  console.error(e);
  w.__error = String((e as Error)?.stack || e);
});
