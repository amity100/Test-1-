// dev/cast-ramah.html — shot 5 (Samuel before the elders at the gate of Ramah, 1 Sam 8:4-6) on the land teammate's
// Ramah set, driven by src/film/cast RamahPerformance, through the game's PostFX.
//
//   ?q=low|medium|high  ?n=<elders, default 10>
//   window.__ramah: shot(name, u, t)  view([px,py,pz],[lx,ly,lz], fov, t)  face(key, dist, az, fov, t)  stats()
import * as THREE from 'three';
import { makeQuality, type TierName } from '../src/core/Engine';
import { PostFX } from '../src/fx/PostFX';
import { LandSet } from '../src/film/land/LandSet';
import { FilmActor, RamahPerformance, RAMAH_CLIPS } from '../src/film/cast';
import { MocapLibrary } from '../src/characters/mocap';

const app = document.getElementById('app')!;
const params = new URLSearchParams(location.search);
const w = window as unknown as Record<string, unknown>;

async function boot() {
  const qn = (params.get('q') ?? 'medium') as 'low' | 'medium' | 'high';
  const tier: TierName = qn === 'high' ? 'desktop-high' : qn === 'medium' ? 'desktop-medium' : 'mobile-low';
  const q = makeQuality(tier, qn === 'low', '');
  const renderer = new THREE.WebGLRenderer({ antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setSize(app.clientWidth, app.clientHeight, false);
  app.appendChild(renderer.domElement);
  const set = await LandSet.create({ renderer, quality: q, location: 'ramah' });
  const camera = new THREE.PerspectiveCamera(40, app.clientWidth / app.clientHeight, set.near, set.far);
  const floatTargets = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const post = new PostFX(renderer, set.scene, camera, set.sky.cubeTarget.texture as THREE.CubeTexture, {
    msaa: q.msaa, bloom: q.bloom, godRaySamples: q.godRaySamples, aa: q.aa, sharpen: q.sharpen, filmFx: q.filmFx, dofSamples: q.dofSamples,
    bloomScale: q.bloomScale, bloomMips: q.bloomMips, colorType: floatTargets ? THREE.HalfFloatType : THREE.UnsignedByteType, taa: false,
  });
  const a = post.atmosphere.uniforms;
  a.uDensity.value = set.atmosphere.density;
  a.uHeightFalloff.value = set.atmosphere.heightFalloff;
  a.uBaseHeight.value = set.atmosphere.baseHeight;
  a.uGodRays.value = set.atmosphere.godRays;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(size.x, size.y);
  post.setLetterbox(2.39, 0);
  post.setFilmLook(0.55, 0);
  set.showPlaceholders(false);
  const anchors = set.anchors.ramah!;
  const H = (x: number, z: number) => set.height.height(x, z);
  await MocapLibrary.shared.preload(RAMAH_CLIPS);
  const n = +(params.get('n') ?? 10);
  const t0 = performance.now();
  const samuel = await FilmActor.create({ role: 'samuel', quality: qn, msaa: q.msaa, ground: H });
  samuel.addTo(set.scene);
  const elders: FilmActor[] = [];
  for (let i = 0; i < Math.min(n, anchors.elders.length); i++) {
    // ?near=<n>: the first n elders at 'near' LOD (default 6; the contact sheet of the elders' faces uses 11)
    const e = await FilmActor.create({ role: 'elder', quality: qn, seed: i + 1, msaa: q.msaa, ground: H, lod: i < +(params.get('near') ?? 6) ? 'near' : 'crowd' });
    e.addTo(set.scene);
    elders.push(e);
  }
  const loadMs = performance.now() - t0;
  // the nearest marks first (the harness camera looks at the gate)
  const perf = new RamahPerformance(samuel, elders, anchors.samuel, anchors.elders, H);
  renderer.info.autoReset = false;
  const sim = (t: number) => {
    const dt = 1 / 30;
    for (let k = 0, tt = 0; tt <= t; k++, tt = k * dt) perf.update(tt, dt, camera, size.y);
  };
  const render = (frames = 3) => {
    for (let i = 0; i < frames; i++) {
      renderer.info.reset();
      set.update(i === 0 ? 0 : 1 / 30, camera);
      renderer.toneMappingExposure = set.exposure;
      post.render(1 / 30);
    }
    return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };
  const setCam = (p: THREE.Vector3, l: THREE.Vector3, fov: number) => {
    camera.position.copy(p);
    camera.up.set(0, 1, 0);
    camera.lookAt(l);
    camera.fov = fov;
    camera.near = 0.1;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };
  const shot = (name: string, u: number, t = 2) => {
    sim(t);
    const f = set.frame(set.shots[name], u);
    setCam(f.pos, f.look, f.fov ?? 40);
    post.setDoF({ enabled: false });
    post.resetHistory();
    return render();
  };
  const view = (p: number[], l: number[], fov = 35, t = 2) => {
    sim(t);
    setCam(new THREE.Vector3(...p), new THREE.Vector3(...l), fov);
    post.setDoF({ enabled: false });
    post.resetHistory();
    return render();
  };
  /** camera on an actor's face: key 'samuel' | 'elder:<i>' */
  const face = (key: string, dist = 1.0, az = 0.3, fov = 28, t = 2) => {
    sim(t);
    const act = key === 'samuel' ? samuel : elders[+key.split(':')[1]];
    const e = act.eyesWorld(new THREE.Vector3());
    const fy = act.facing().face + az;
    setCam(new THREE.Vector3(e.x + Math.sin(fy) * dist, e.y + 0.02, e.z + Math.cos(fy) * dist), e, fov);
    if (post.dofAvailable) post.setDoF({ enabled: true, focusDistance: dist, fStop: 2.2, focalLength: null, target: null });
    post.resetHistory();
    return render();
  };
  const info = () => ({
    loadMs: Math.round(loadMs), shots: Object.keys(set.shots),
    samuel: anchors.samuel.pos.toArray().map((x) => +x.toFixed(2)), gate: anchors.gate.toArray().map((x) => +x.toFixed(2)),
    elders: anchors.elders.slice(0, n).map((m) => [...m.pos.toArray().map((x) => +x.toFixed(2)), +m.yaw.toFixed(2), m.seated ? 1 : 0]),
  });
  /** numbers: seated elder i — seat top, pelvis, hip joints, feet (world) after `t` s */
  const seat = (i: number, t = 2) => {
    sim(t);
    const e = elders[i];
    const b = e.human.bones as Record<string, THREE.Object3D>;
    const f = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3()).toArray().map((x) => +x.toFixed(2));
    return { mark: anchors.elders[i].pos.toArray().map((x) => +x.toFixed(2)), yaw: anchors.elders[i].yaw, ground: +H(anchors.elders[i].pos.x, anchors.elders[i].pos.z).toFixed(2), root: e.root.position.toArray().map((x) => +x.toFixed(2)), body: { ...e.body }, pelvis: f(b.root), hipL: f(b['upperleg01.L']), kneeL: f(b['lowerleg01.L']), footL: f(b['foot.L']), head: f(b.head) };
  };
  w.__ramah = { shot, view, face, info, seat, stats: () => renderer.info.render };
  w.__ready = true;
}
boot().catch((e) => {
  console.error(e);
  w.__error = String((e as Error)?.stack || e);
});
