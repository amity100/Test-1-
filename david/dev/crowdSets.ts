// dev/crowd-sets.html — the film crowds (src/film/crowd) inside the REAL sets, through the game's PostFX:
//   ?set=gilgal  Saul's army on the Gilgal set (shots 6-9, driven by the gilgal blocking)
//   ?set=coast   the Philistine host on the land set's coast (shot 4)
//   ?q=low|medium|high  (mobile-low / desktop-medium / desktop-high)   ?lb=0 no letterbox   ?imp=0 no impostors
//
// Test driver (window.__cs): shot(name, u, frames?) simulates the action from the start of the shot (and the shots
// before it that matter) and renders shot `name` at normalised time u; view(pos, look, fov); stats().
import * as THREE from 'three';
import { makeQuality, type TierName } from '../src/core/Engine';
import { PostFX } from '../src/fx/PostFX';
import type { CrowdTier } from '../src/film/crowd/Crowd';

const app = document.getElementById('app')!;
const hud = document.getElementById('hud')!;
const params = new URLSearchParams(location.search);
const w = window as unknown as Record<string, unknown>;

async function boot() {
  const qn = (params.get('q') ?? 'high') as 'low' | 'medium' | 'high';
  const tier: TierName = qn === 'high' ? 'desktop-high' : qn === 'medium' ? 'desktop-medium' : 'mobile-low';
  const q = makeQuality(tier, qn === 'low', '');
  const which = params.get('set') ?? 'gilgal';
  const renderer = new THREE.WebGLRenderer({ antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setSize(app.clientWidth, app.clientHeight, false);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  app.appendChild(renderer.domElement);
  renderer.info.autoReset = false;
  const floatTargets = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const pq = {
    msaa: 0, bloom: q.bloom, godRaySamples: q.godRaySamples, aa: q.aa, taa: false, dofSamples: q.dofSamples, sharpen: q.sharpen, filmFx: q.filmFx,
    bloomScale: q.bloomScale, bloomMips: q.bloomMips, colorType: floatTargets ? THREE.HalfFloatType : THREE.UnsignedByteType,
  };
  const t0 = performance.now();
  const info: Record<string, unknown> = { tier: q.tier };

  if (which === 'gilgal') {
    const { GilgalSet, SHOT_ORDER } = await import('../src/film/gilgal/GilgalSet');
    const { GilgalArmy } = await import('../src/film/crowd/GilgalArmy');
    type Shot = (typeof SHOT_ORDER)[number];
    const camera = new THREE.PerspectiveCamera(40, app.clientWidth / app.clientHeight, 0.05, 90000);
    const set = await GilgalSet.create({ renderer, quality: q });
    const post = set.createPost(camera, pq);
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    post.setSize(size.x, size.y);
    if (params.get('lb') !== '0') post.setLetterbox(2.39, 0);
    post.setFilmLook(0.55, 0);
    // the stand-ins of Saul and Samuel stay; the placeholder soldiers are replaced by the crowd
    set.showPlaceholders(params.get('figs') !== '0');
    set.placeholders.group.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) o.visible = false; });
    const ta = performance.now();
    const army = await GilgalArmy.create({ tier: q.tier as CrowdTier, ground: (x, z) => set.height(x, z), impostors: params.get('imp') !== '0' });
    info.armyMs = Math.round(performance.now() - ta);
    info.bakeMs = Math.round(army.anim.bakeMs);
    set.scene.add(army.group);
    army.crowd.viewportHeight = size.y;
    info.loadMs = Math.round(performance.now() - t0);
    const prof = { beat: 0, upd: 0, n: 0 };
    const applyFrame = (name: Shot, time: number, dt: number) => {
      const inf = set.shots[name];
      const s = inf.shot;
      const u = time / s.duration;
      const e = s.ease !== false ? u * u * (3 - 2 * u) : u;
      set.setBeat(name, time);
      const f = s.at(e, time);
      camera.position.copy(f.pos);
      camera.up.set(0, 1, 0);
      camera.lookAt(f.look);
      if (f.roll) camera.rotateZ(f.roll);
      camera.fov = f.fov ?? 40;
      camera.near = 0.05;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const a0 = performance.now();
      army.setBeat(name, time);
      const a1 = performance.now();
      army.update(dt, camera);
      prof.beat += a1 - a0;
      prof.upd += performance.now() - a1;
      prof.n++;
      const fp = inf.focus(time);
      if (fp && post.dofAvailable) post.setDoF({ enabled: true, focusDistance: fp.distanceTo(camera.position), fStop: inf.fStop, focalLength: null, target: null });
      else post.setDoF({ enabled: false });
    };
    const renderFrame = (dt: number) => {
      renderer.info.reset();
      set.update(dt, camera, { advanceTime: true });
      set.applyExposure(renderer);
      post.render(dt);
    };
    let cpu = 0, nUp = 0;
    const simulate = (name: Shot, time: number) => {
      const step = 1 / 20;
      const idx = SHOT_ORDER.indexOf(name);
      // the state the shot starts in: play the shot before it (the roar before the silence, ...)
      const from = name === 'silence' || name === 'faceOff' ? idx - 1 : idx;
      for (let k = from; k <= idx; k++) {
        const n = SHOT_ORDER[k];
        const end = k === idx ? time : set.shots[n].shot.duration;
        for (let t = 0; t < end; t += step) {
          const a = performance.now();
          applyFrame(n, t, t === 0 ? 0 : step);
          cpu += performance.now() - a;
          nUp++;
        }
      }
    };
    const shot = (name: Shot, u: number, frames = 2) => {
      post.resetHistory();
      const time = u * set.shots[name].shot.duration;
      simulate(name, Math.max(0, time - (frames - 1) / 30));
      for (let i = 0; i < frames; i++) {
        applyFrame(name, time - (frames - 1 - i) / 30, 1 / 30);
        renderFrame(i === 0 ? 0 : 1 / 30);
      }
      return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, crowd: { ...army.crowd.stats, drawn: [...army.crowd.stats.drawn] }, impostors: army.impostors?.stats, cpuMsPerUpdate: +(cpu / Math.max(1, nUp)).toFixed(3), armyBeatMs: +(prof.beat / Math.max(1, prof.n)).toFixed(3), crowdUpdateMs: +(prof.upd / Math.max(1, prof.n)).toFixed(3) };
    };
    const view = (p: number[], l: number[], fov = 40, frames = 2, name: Shot = 'dustWall', time = 3) => {
      simulate(name, time);
      set.beat = null;
      camera.position.set(p[0], p[1], p[2]);
      camera.lookAt(l[0], l[1], l[2]);
      camera.fov = fov;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      army.update(0, camera);
      post.setDoF({ enabled: false });
      post.resetHistory();
      for (let i = 0; i < frames; i++) renderFrame(i === 0 ? 0 : 1 / 30);
      return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    };
    w.__cs = { set, army, shot, view, info, camera, renderer, post, THREE };
  } else {
    const { LandSet } = await import('../src/film/land/LandSet');
    const { PhilistineHost } = await import('../src/film/crowd/PhilistineHost');
    const set = await LandSet.create({ renderer, quality: q, location: 'coast' });
    const camera = new THREE.PerspectiveCamera(45, app.clientWidth / app.clientHeight, set.near, set.far);
    const post = new PostFX(renderer, set.scene, camera, set.sky.cubeTarget.texture as THREE.CubeTexture, pq);
    const a = post.atmosphere.uniforms;
    a.uDensity.value = set.atmosphere.density;
    a.uHeightFalloff.value = set.atmosphere.heightFalloff;
    a.uBaseHeight.value = set.atmosphere.baseHeight;
    a.uGodRays.value = set.atmosphere.godRays;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    post.setSize(size.x, size.y);
    if (params.get('lb') !== '0') post.setLetterbox(2.39, 0);
    post.setFilmLook(0.55, 0);
    set.showPlaceholders(false);
    const c = set.anchors.coast!;
    const ta = performance.now();
    const host = await PhilistineHost.create({
      tier: q.tier as CrowdTier, coast: c, ground: (x, z) => set.height.height(x, z), impostors: params.get('imp') !== '0',
    });
    info.hostMs = Math.round(performance.now() - ta);
    info.bakeMs = Math.round(host.anim.bakeMs);
    set.scene.add(host.group);
    host.crowd.viewportHeight = size.y;
    if (params.get('nohost') === '1') host.group.visible = false;
    info.loadMs = Math.round(performance.now() - t0);
    const order = set.sequence;
    const names = Object.keys(set.shots);
    const renderFrame = (dt: number) => {
      renderer.info.reset();
      set.update(dt, camera);
      renderer.toneMappingExposure = set.exposure;
      post.render(dt);
    };
    const shot = (name: string, u: number, frames = 2) => {
      post.resetHistory();
      const s = set.shots[name];
      // the host keeps marching through the sequence: travel = time since the start of shot 4
      let start = 0;
      for (const o of order) { if (o === s) break; start += o.duration; }
      for (let i = 0; i < frames; i++) {
        const t = u * s.duration - (frames - 1 - i) / 30;
        const f = set.frame(s, Math.max(0, t / s.duration));
        camera.position.copy(f.pos);
        camera.up.set(0, 1, 0);
        camera.lookAt(f.look);
        camera.fov = f.fov ?? 45;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        host.setTravel((start + t) * host.speed);
        host.update(i === 0 ? 0 : 1 / 30, camera);
        renderFrame(i === 0 ? 0 : 1 / 30);
      }
      return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, crowd: { ...host.crowd.stats, drawn: [...host.crowd.stats.drawn] }, impostors: host.impostors?.stats };
    };
    const view = (p: number[], l: number[], fov = 40, frames = 2) => {
      camera.position.set(p[0], p[1], p[2]);
      camera.lookAt(l[0], l[1], l[2]);
      camera.fov = fov;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      host.update(0, camera);
      for (let i = 0; i < frames; i++) renderFrame(i === 0 ? 0 : 1 / 30);
      return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    };
    // a view in the coast shots' frame: (back along the heading, lateral on the land set's `side`, up above ground)
    const T = (back: number, lat: number, up: number) => {
      const hd = c.heading, x = c.columnHead.x + hd.x * back - hd.z * lat, z = c.columnHead.z + hd.z * back + hd.x * lat;
      return [x, set.height.height(x, z) + up, z];
    };
    const viewRel = (p: number[], l: number[], fov = 40, travel = 0) => {
      host.setTravel(travel);
      return view(T(p[0], p[1], p[2]), T(l[0], l[1], l[2]), fov);
    };
    w.__cs = { set, host, shot, view, viewRel, info, names, camera, renderer, post, THREE, coast: c };
  }
  w.__ready = true;
  if (params.get('hud') === '1') hud.classList.remove('off');
}
boot().catch((e) => {
  console.error(e);
  w.__error = String((e as Error)?.stack || e);
});
