// dev/models-cast.html — models pass (CUT v2 finishing pass): the Gilgal cast in the film's light and post chain, filmed
// through the REAL take cameras of src/film/FilmCams.ts (gilgalCam / gilgalFocus, whatever the cut teammate has set),
// with the film's face-light rig — so the looks (Samuel's face, the torn corner, Saul's coat) are judged in the
// frames the film shows. Not part of the game build.
//
//   ?q=low|medium|high   ?lb=0 no letterbox   ?w=&h= canvas
//
// window.__mc:
//   load(roles[])                 'saul', 'samuel', 'bearer', 'elder:3', 'soldier:5', 'philistine:2:elite'
//   film(take, t, o?)             take = 'tear' | 'tear:insert' | 'verdict' | 'saulAlone' | 'king' | ... at shot second t
//                                 (simulated forward from the take start; continues when t grows). o: { hairSim, rig,
//                                 dof, cam: [px,py,pz, lx,ly,lz, fov] (override) }
//   studio(key, view, o?)         one actor alone (views: front, three4, side, back, face, face34, faceSide, hands, full)
//   tearInfo()                    MeilTear diagnostics (components, max stretch, free-fall)
import * as THREE from 'three';
import { makeQuality, type TierName } from '../src/core/Engine';
import { GilgalSet, type GilgalShotName } from '../src/film/gilgal/GilgalSet';
import { FilmActor, GilgalPerformance, GILGAL_CLIPS, RAMAH_CLIPS, POSES } from '../src/film/cast';
import { FaceLightRig } from '../src/film/cast/faceLight';
import { MocapLibrary } from '../src/characters/mocap';
import { SAMUEL } from '../src/film/gilgal/gilgalLayout';
import { baseTake, gilgalCam, gilgalFocus, SUN_CHEAT, takeExposure, TAKE_OFFSET, type GilgalCtx } from '../src/film/FilmCams';
import { INTRO_SHOTS } from '../src/content/introScript';
import type { ShotFrame } from '../src/gameplay/CameraRig';

const app = document.getElementById('app')!;
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
  const camera = new THREE.PerspectiveCamera(40, app.clientWidth / app.clientHeight, 0.05, 90000);
  const set = await GilgalSet.create({ renderer, quality: q });
  // the film's face-light rig (fixed light count per tier; added before anything compiles)
  const rig = new FaceLightRig({ quality: qn });
  rig.addTo(set.scene);
  rig.setPreset('off', 0);
  const floatTargets = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const post = set.createPost(camera, {
    msaa: q.msaa, bloom: q.bloom, godRaySamples: q.godRaySamples, aa: q.aa, taa: false, dofSamples: q.dofSamples, sharpen: q.sharpen, filmFx: q.filmFx,
    bloomScale: q.bloomScale, bloomMips: q.bloomMips, colorType: floatTargets ? THREE.HalfFloatType : THREE.UnsignedByteType,
  });
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(size.x, size.y);
  if (params.get('lb') !== '0') post.setLetterbox(2.39, 0);
  post.setFilmLook(0.55, 0);
  set.showPlaceholders(false);
  const H = (x: number, z: number) => set.height(x, z);
  await MocapLibrary.shared.preload([...new Set([...GILGAL_CLIPS, ...RAMAH_CLIPS])]);
  const actors: Record<string, FilmActor> = {};
  let perf: GilgalPerformance | null = null;
  const load = async (keys: string[]) => {
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      if (actors[key]) continue;
      const [role, seedS, rank] = key.split(':');
      const t0 = performance.now();
      const a = await FilmActor.create({
        role: (role === 'bearer' ? 'armourBearer' : role) as never, quality: qn, seed: seedS ? +seedS : 1, msaa: q.msaa,
        rank: rank === 'elite' ? 'elite' : rank === 'rank' ? 'rank' : undefined, ground: H,
      });
      a.addTo(set.scene);
      a.setVisible(false);
      actors[key] = a;
      out[key] = { ms: Math.round(performance.now() - t0), tris: a.outfit.stats.triangles, calls: a.outfit.stats.drawCalls, groom: a.groom?.stats.strands };
    }
    return out;
  };
  const hideAll = () => {
    for (const k in actors) actors[k].setVisible(false);
  };
  renderer.info.autoReset = false;
  let expMul = 1;
  const render = (frames = 2) => {
    for (let i = 0; i < frames; i++) {
      renderer.info.reset();
      set.update(i === 0 ? 0 : 1 / 30, camera, { advanceTime: false });
      set.applyExposure(renderer);
      renderer.toneMappingExposure *= expMul;
      post.render(1 / 30);
    }
    return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };
  const STUDIO = new THREE.Vector3(SAMUEL.pos.x + 6, 0, SAMUEL.pos.z + 3);
  const posed = (a: FilmActor, o: { yaw?: number; clip?: string; t?: number; pose?: string; at?: THREE.Vector3 }) => {
    a.body.drop = a.body.lean = a.body.twist = a.body.side = a.body.feetFwd = 0;
    a.setVisible(true);
    const at = o.at ?? STUDIO;
    a.place(at, o.yaw ?? -Math.PI / 2);
    a.headingSnap = true;
    a.mocap.play(o.clip ?? 'idle_king', { fade: 0 });
    if (a.spec.role === 'saul') {
      a.armPose.L.pose = POSES.helmetL;
      a.armPose.L.weight = 1;
      a.armPose.R.pose = o.pose === 'fist' ? POSES.clothFistR : POSES.spearCarryR;
      a.armPose.R.weight = 1;
      if (!a.props.spear.parent) a.holdProp('spear', 'R');
      if (a.props.helmet && !a.props.helmet.parent) a.carryUnderArm('helmet', 'L');
      a.upright.R.prop = 'spear';
      a.upright.R.weight = 1;
    }
    if ((a.spec.role === 'soldier' || a.spec.role === 'armourBearer' || a.spec.role === 'philistine') && a.props.main) {
      if (!a.props.main.parent) a.holdProp('main', 'R');
      if (a.kit === 'spear' || a.kit === 'armourBearer') {
        a.armPose.R.pose = POSES.spearCarryR;
        a.armPose.R.weight = 1;
        a.upright.R.prop = 'main';
        a.upright.R.weight = 1;
      }
    }
    if (a.spec.role === 'elder' && a.props.staff && !a.props.staff.parent) a.holdProp('staff', 'R');
    a.mocap.lookAt = at.clone().add(new THREE.Vector3(Math.sin(a.yaw) * 20, 1.65, Math.cos(a.yaw) * 20));
    const T = o.t ?? 1.5;
    for (let t = 0; t < T; t += 1 / 30) a.update(1 / 30, camera, size.y, new THREE.Vector3(1.2, 0, 0.2));
  };
  const studio = (key: string, view: string, o: { yaw?: number; fov?: number; dist?: number; h?: number; clip?: string; t?: number; pose?: string; side?: number; rig?: string; lookDy?: number; sun?: number | null } = {}) => {
    hideAll();
    set.setSunCheat(o.sun ?? null);
    const a = actors[key];
    posed(a, o);
    const head = a.headWorld(new THREE.Vector3());
    const base = a.root.position.clone();
    const yaw = a.yaw;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const left = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const ang = ({ front: 0, three4: 0.7, side: 1.5708, back: Math.PI, face: 0.05, face34: 0.6, faceSide: 1.45, hands: 0.3, full: 0.35, low: 0.25 } as Record<string, number>)[view] ?? 0;
    const dir = fwd.clone().multiplyScalar(Math.cos(ang)).addScaledVector(left, Math.sin(ang) * (o.side ?? 1));
    const faceView = view.startsWith('face');
    const dist = o.dist ?? (faceView ? 0.8 : view === 'hands' ? 1.4 : 6.2);
    const lookY = faceView ? head.y - 0.03 + (o.lookDy ?? 0) : view === 'hands' ? base.y + 1.0 + (o.lookDy ?? 0) : base.y + (head.y - base.y) * 0.55 + (o.lookDy ?? 0);
    const camY = o.h !== undefined ? base.y + o.h : faceView ? head.y : lookY + 0.1;
    camera.position.copy(base).addScaledVector(dir, dist).setY(camY);
    camera.lookAt(base.x, lookY, base.z);
    camera.fov = o.fov ?? (faceView ? 30 : 32);
    camera.near = 0.05;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    if (o.rig) {
      rig.setPreset(o.rig as never, 1);
      rig.update(a.eyesWorld(new THREE.Vector3()), camera);
    } else rig.setPreset('off', 0);
    if (faceView) post.setDoF({ enabled: true, focusDistance: dist, fStop: 2.8, focalLength: null, target: null });
    else post.setDoF({ enabled: false });
    post.resetHistory();
    expMul = 1;
    return render(3);
  };

  // ---------------------------------------------------------------------------------------------- the film takes
  const ctx: GilgalCtx = {
    saulHand: (out) => (actors.saul ? actors.saul.human.sockets.handGripR.getWorldPosition(out) : null),
    saulEyes: (out) => (actors.saul ? actors.saul.eyesWorld(out) : null),
    samuelEyes: (out) => (actors.samuel ? actors.samuel.eyesWorld(out) : null),
  };
  const durOf = (take: string) => INTRO_SHOTS.find((s) => s.set === 'gilgal' && s.take === take)?.dur ?? 3;
  let cur: { base: GilgalShotName; bt: number } | null = null;
  const frame: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40, roll: 0 };
  const tmp = new THREE.Vector3();
  const film = (take: string, t: number, o: { hairSim?: boolean; rig?: string | null; dof?: boolean; cam?: number[]; dt?: number; sun?: number | null } = {}) => {
    const saul = actors.saul, samuel = actors.samuel;
    if (!perf) perf = new GilgalPerformance({ saul, samuel, armourBearer: actors.bearer }, H);
    const base = baseTake(take);
    const bt = t + (TAKE_OFFSET[take] ?? 0);
    const dt = o.dt ?? 1 / 30;
    hideAll();
    saul.setVisible(true);
    samuel.setVisible(true);
    actors.bearer?.setVisible(true);
    if (!cur || cur.base !== base || bt < cur.bt - 1e-6) {
      perf.enter(base);
      for (const a of [saul, samuel]) a.groom?.sim?.reset?.();
      cur = { base, bt: 0 };
      set.setBeat(base, 0);
      perf.update(0, 0, camera, size.y);
    }
    // cut4: Samuel's hair sim ON in the verdict, still off in the slow-motion tear (override with o.hairSim)
    samuel.groom?.setSimulation(o.hairSim ?? base !== 'tear');
    const u = Math.max(0, Math.min(1, t / durOf(take)));
    // the film's light cheat of the close set-ups (FilmCams.SUN_CHEAT: the sun behind the two men), o.sun overrides
    set.setSunCheat(o.sun !== undefined ? o.sun : SUN_CHEAT[take] ?? null);
    const aim = () => {
      camera.up.set(0, 1, 0);
      if (o.cam) {
        camera.position.set(o.cam[0], o.cam[1], o.cam[2]);
        camera.lookAt(o.cam[3], o.cam[4], o.cam[5]);
        camera.fov = o.cam[6] ?? 35;
      } else if (gilgalCam(take, u, bt, H, frame, ctx)) {
        camera.position.copy(frame.pos);
        camera.up.set(0, 1, 0);
        camera.lookAt(frame.look);
        if (frame.roll) camera.rotateZ(frame.roll);
        camera.fov = frame.fov ?? 40;
      }
      camera.near = 0.05;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    };
    while (cur.bt < bt - 1e-6) {
      const step = Math.min(dt, bt - cur.bt);
      cur.bt += step;
      set.setBeat(base, cur.bt);
      aim();
      perf.update(cur.bt, step, camera, size.y);
    }
    aim();
    // face light like FilmStage: G2 / G3 / G7 'afternoonKing' on Saul, G6 'verdict' on Samuel; off in the wides / insert
    const who = take === 'king' || take === 'saulAlone' || take === 'spearRaised' ? saul : take === 'verdict' ? samuel : null;
    const preset = o.rig !== undefined ? o.rig : who ? (take === 'verdict' ? 'verdict' : 'afternoonKing') : null;
    if (preset && (who ?? samuel)) {
      rig.setPreset(preset as never, take === 'spearRaised' ? 0.7 : 1);
      rig.update((who ?? samuel).eyesWorld(tmp), camera);
    } else rig.setPreset('off', 0);
    const f = gilgalFocus(take, bt, H, ctx, tmp);
    if (f && post.dofAvailable && o.dof !== false) post.setDoF({ enabled: true, focusDistance: f.point.distanceTo(camera.position), fStop: f.fStop, focalLength: null, target: null });
    else post.setDoF({ enabled: false });
    expMul = takeExposure(take, t);
    post.resetHistory();
    const r = render(3);
    return { ...r, cam: camera.position.toArray().map((v) => +v.toFixed(2)), fov: +camera.fov.toFixed(1), torn: samuel.tear?.isTorn, p: +(samuel.tear?.progress ?? 0).toFixed(2) };
  };
  /** MeilTear diagnostics: particle spread, lowest point, distance of the piece's far point from the hand */
  const tearInfo = () => {
    const tr = actors.samuel?.tear as unknown as { p: Float32Array; isTorn: boolean } | undefined;
    if (!tr || !tr.isTorn) return null;
    const hand = actors.saul.human.sockets.handGripR.getWorldPosition(new THREE.Vector3());
    let minY = Infinity, maxD = 0;
    for (let i = 0; i < tr.p.length; i += 3) {
      minY = Math.min(minY, tr.p[i + 1]);
      maxD = Math.max(maxD, Math.hypot(tr.p[i] - hand.x, tr.p[i + 1] - hand.y, tr.p[i + 2] - hand.z));
    }
    return { minY: +minY.toFixed(3), maxFromHand: +maxD.toFixed(3), handY: +hand.y.toFixed(3) };
  };
  const stats = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, programs: renderer.info.programs?.length });
  w.__mc = { load, studio, film, tearInfo, stats, actors, set, camera, rig, THREE, renderer, post };
  w.__ready = true;
}
boot().catch((e) => {
  console.error(e);
  w.__error = String((e as Error)?.stack || e);
});
