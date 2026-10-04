// dev/host.html — host1 (wave 5): the Philistine host of P6 'philistines' (coast : threat) in the REAL coast set,
// through the game's PostFX, filmed by the film's own P6 lens (FilmCams.landCam 'threat' + its handheld, the take's
// exposure, contrast and depth of field exactly as FilmStage's coast handle and Intro apply them) — the bench on which
// the host's animation is built and judged without booting the game and the film.
//   ?q=high|medium|mhigh|low (desktop-high / desktop-medium / mobile-high / mobile-low)   ?lb=0 no letterbox
//   ?van=0 the host without its vanguard of full actors (the crowd alone, as before wave 5)
//
// window.__h:
//   enter()                 the cut into P6 (the host back at the head of its road, the actors' clocks reset)
//   sim(seconds, dt?)       advance the action without rendering
//   render(n = 1)           render n frames of 1/30 s (the action advances with them)
//   cam = 'p6' | [ahead, side, h, lookAhead, lookSide, lookH, fov]   the film's lens, or a lens relative to the head of
//                           the column NOW (ahead along the march, side = the men's right, metres over the ground)
//   t                       shot seconds;  stats()  calls / triangles / crowd + vanguard numbers
import * as THREE from 'three';
import { makeQuality, type TierName } from '../src/core/Engine';
import { PostFX } from '../src/fx/PostFX';
import { applyHandheld, FILM_CAM, landCam, portraitLens, takeExposure, type LandCamCtx } from '../src/film/FilmCams';
import type { ShotFrame } from '../src/gameplay/CameraRig';
import type { CrowdTier } from '../src/film/crowd/Crowd';
import { slice } from '../src/core/slice';

const app = document.getElementById('app')!;
const params = new URLSearchParams(location.search);
const w = window as unknown as Record<string, unknown>;

async function boot() {
  const qn = params.get('q') ?? 'high';
  const tier: TierName = qn === 'high' ? 'desktop-high' : qn === 'medium' ? 'desktop-medium' : qn === 'mhigh' ? 'mobile-high' : 'mobile-low';
  const q = makeQuality(tier, tier.startsWith('mobile'), '');
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
  const info: Record<string, unknown> = { tier: q.tier };
  const t0 = performance.now();
  const { LandSet } = await import('../src/film/land/LandSet');
  const { PhilistineHost } = await import('../src/film/crowd/PhilistineHost');
  const set = await LandSet.create({ renderer, quality: q, location: 'coast' });
  info.setMs = Math.round(performance.now() - t0);
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
  post.setFilmLook(0.85, 0);
  // the take's contrast (FilmStage's coast handle)
  const uc = post.grade.uniforms.uContrast;
  uc.value = (uc.value as number) * FILM_CAM.threat.contrast;
  set.showPlaceholders(false);
  const c = set.anchors.coast!;
  const ta = performance.now();
  // the background builder's yields (core/slice) are honoured here too: a long build step shows in blockMs
  let blockMs = 0;
  let last = performance.now();
  const probe = setInterval(() => {
    const n = performance.now();
    blockMs = Math.max(blockMs, n - last);
    last = n;
  }, 4);
  void slice;
  const host = await PhilistineHost.create({
    tier: q.tier as CrowdTier,
    coast: { route: c.route, columnHead: c.columnHead, columnWidth: c.columnWidth },
    ground: (x, z) => set.height.height(x, z),
    // as FilmStage's coast handle: the full-detail figures reach the front ranks on phones too
    ...(q.tier === 'mobile-low' ? { lodDistances: [13, 30, 400] as [number, number, number] } : q.tier === 'mobile-high' ? { lodDistances: [15, 36, 500] as [number, number, number] } : {}),
    ...(params.get('van') === '0' ? { vanguard: 0 } : {}),
  } as Parameters<typeof PhilistineHost.create>[0]);
  clearInterval(probe);
  info.hostMs = Math.round(performance.now() - ta);
  info.hostBlockMs = Math.round(blockMs);
  info.bakeMs = Math.round(host.anim.bakeMs);
  set.scene.add(host.group);
  host.crowd.viewportHeight = size.y;
  info.loadMs = Math.round(performance.now() - t0);

  const ctx: LandCamCtx = { height: (x, z) => set.height.height(x, z), coast: { heading: c.heading, columnHead: c.columnHead } };
  const frame: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40, roll: 0 };
  const focusP = new THREE.Vector3();
  const st = { t: 0, cam: 'p6' as 'p6' | number[], dof: true };
  const hd = c.heading;
  const right = new THREE.Vector3(-hd.z, 0, hd.x);
  const head = new THREE.Vector3();
  const pose = () => {
    const t = st.t;
    const u = t / 7.0;
    if (st.cam === 'p6') {
      landCam('threat', u, t, ctx, frame);
      applyHandheld('threat', t, 24.5 + t, frame);
    } else {
      const k = st.cam;
      head.copy(c.columnHead).addScaledVector(hd, FILM_CAM.coast.march * t);
      frame.pos.copy(head).addScaledVector(hd, k[0]).addScaledVector(right, k[1]);
      frame.pos.y = set.height.height(frame.pos.x, frame.pos.z) + k[2];
      frame.look.copy(head).addScaledVector(hd, k[3]).addScaledVector(right, k[4]);
      frame.look.y = set.height.height(frame.look.x, frame.look.z) + k[5];
      frame.fov = k[6];
      frame.roll = 0;
    }
    // the take's focus (FilmStage: on the front ranks, focusBack behind the head)
    focusP.copy(c.columnHead).addScaledVector(hd, FILM_CAM.coast.march * t - FILM_CAM.threat.focusBack);
    focusP.y = set.height.height(focusP.x, focusP.z) + 1.5;
    portraitLens(frame, focusP, app.clientWidth / Math.max(1, app.clientHeight));
    camera.position.copy(frame.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(frame.look);
    if (frame.roll) camera.rotateZ(frame.roll);
    camera.fov = frame.fov ?? 40;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };
  let simMs = 0, simN = 0;
  const tick = (dt: number) => {
    st.t += dt;
    const s0 = performance.now();
    host.update(dt, camera);
    simMs += performance.now() - s0;
    simN++;
    pose();
  };
  const enter = () => {
    st.t = 0;
    host.setTravel(0);
    host.enter?.();
    pose();
    host.update(0, camera);
    post.resetHistory();
  };
  const sim = (seconds: number, dt = 1 / 30) => {
    const n = Math.max(1, Math.round(seconds / dt));
    for (let i = 0; i < n; i++) tick(dt);
    return st.t;
  };
  const draw = () => {
    renderer.info.reset();
    set.update(1 / 30, camera);
    renderer.toneMappingExposure = set.exposure * takeExposure('threat', st.t);
    if (st.dof && post.dofAvailable) post.setDoF({ enabled: true, focusDistance: Math.max(0.2, focusP.distanceTo(camera.position)), fStop: FILM_CAM.threat.fStop, focalLength: null, target: null });
    else post.setDoF({ enabled: false });
    post.render(1 / 30);
  };
  const render = (n = 1) => {
    for (let i = 0; i < n; i++) {
      if (i > 0) tick(1 / 30);
      draw();
    }
    return { t: st.t, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };
  const stats = () => ({
    t: st.t, calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
    crowd: { ...host.crowd.stats, drawn: [...host.crowd.stats.drawn] },
    vanguard: host.vanguardStats?.() ?? null,
    simMsPerTick: +(simMs / Math.max(1, simN)).toFixed(2),
    geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
  });
  // gait probe (no rendering): play `clip` on the first vanguard actor in place for `secs` and measure each foot's
  // highest lift above the ground, the thigh's largest forward swing (deg from vertical) and the step rate
  const clipProbe = async (clip: string, secs = 3, mps = 1.2) => {
    const a = host.vanguardActors[0];
    if (!a) return null;
    const mp = a.mocap;
    await mp.lib.load(clip);
    mp.play(clip, { fade: 0, time: 0 });
    mp.matchSpeed(clip, mps);
    const bones = a.human.bones as Record<string, THREE.Object3D>;
    const P = new THREE.Vector3(), K = new THREE.Vector3(), H = new THREE.Vector3();
    let lift = 0, swing = 0, steps = 0;
    const prevOn = [true, true];
    const g0 = a.root.position.y;
    for (let i = 0; i < secs * 60; i++) {
      a.update(1 / 60, camera, 360);
      ['L', 'R'].forEach((s, k) => {
        bones[`foot.${s}`].getWorldPosition(P);
        bones[`lowerleg01.${s}`].getWorldPosition(K);
        bones[`upperleg01.${s}`].getWorldPosition(H);
        const h = P.y - g0;
        if (i > 30) lift = Math.max(lift, h);
        const fwd = new THREE.Vector3(Math.sin(a.yaw), 0, Math.cos(a.yaw));
        const th = K.clone().sub(H);
        const ang = Math.atan2(th.dot(fwd), -th.y) * 180 / Math.PI;
        if (i > 30) swing = Math.max(swing, ang);
        const on = h < 0.13;
        if (on && !prevOn[k] && i > 30) steps++;
        prevOn[k] = on;
      });
    }
    return { clip, lift: +lift.toFixed(3), swingDeg: +swing.toFixed(1), stepsPerS: +(steps / (secs - 0.5)).toFixed(2) };
  };
  enter();
  w.__h = { set, host, camera, renderer, post, info, enter, sim, render, stats, st, THREE, coast: c, clipProbe };
  w.__ready = true;
}
boot().catch((e) => {
  console.error(e);
  w.__error = String((e as Error)?.stack || e);
});
