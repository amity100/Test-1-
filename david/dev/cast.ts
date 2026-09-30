// dev/cast.html — the cast of the opening film (src/film/cast) on the Gilgal set, in the film's light and post chain.
//
//   ?q=low|medium|high   content tier;  ?lb=0 no letterbox
//
// Test driver (window.__cast):
//   load(roles[])                      builds actors ('saul','samuel','elder:3','soldier:5','philistine:2:elite','bearer')
//   studio(key, view, o?)              one actor alone at the studio mark (views: front, three4, side, back, face, face34,
//                                      faceSide, hands, full) — o = { yaw, fov, dist, h, clip, t, pose }
//   lineup(keys[], o?)                 several actors side by side (height comparison)
//   shot(name, t, o?)                  the Gilgal performance at shot `name`, time t (simulated from 0) through the
//                                      shot camera (or o.cam = [px,py,pz, lx,ly,lz, fov])
//   stats()
import * as THREE from 'three';
import { makeQuality, type TierName } from '../src/core/Engine';
import { GilgalSet, type GilgalShotName } from '../src/film/gilgal/GilgalSet';
import { FilmActor, GilgalPerformance, GILGAL_CLIPS, RAMAH_CLIPS, POSES } from '../src/film/cast';
import { MocapLibrary } from '../src/characters/mocap';
import { SAMUEL } from '../src/film/gilgal/gilgalLayout';

const app = document.getElementById('app')!;
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
  renderer.setPixelRatio(1);
  renderer.setSize(app.clientWidth, app.clientHeight, false);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  app.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(40, app.clientWidth / app.clientHeight, 0.05, 90000);
  const set = await GilgalSet.create({ renderer, quality: q });
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
  const render = (frames = 2) => {
    for (let i = 0; i < frames; i++) {
      renderer.info.reset();
      set.update(i === 0 ? 0 : 1 / 30, camera, { advanceTime: false });
      set.applyExposure(renderer);
      post.render(1 / 30);
    }
    return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };
  const STUDIO = new THREE.Vector3(SAMUEL.pos.x + 6, 0, SAMUEL.pos.z + 3);
  /** pose one actor at the studio mark, simulate its clip for a while */
  const posed = (a: FilmActor, o: { yaw?: number; clip?: string; t?: number; pose?: string; at?: THREE.Vector3 }) => {
    a.setVisible(true);
    const at = o.at ?? STUDIO;
    a.place(at, o.yaw ?? -Math.PI / 2);
    a.headingSnap = true;
    a.mocap.play(o.clip ?? (a.spec.role === 'elder' ? 'idle_old' : 'idle_king'), { fade: 0 });
    if (a.spec.role === 'saul') {
      a.armPose.L.pose = POSES.helmetL;
      a.armPose.L.weight = 1;
      const p = o.pose === 'raise' ? POSES.spearRaiseR : o.pose === 'fist' ? POSES.clothFistR : POSES.spearCarryR;
      a.armPose.R.pose = p;
      a.armPose.R.weight = 1;
      if (!a.props.spear.parent) a.holdProp('spear', 'R');
      if (a.props.helmet && !a.props.helmet.parent) a.carryUnderArm('helmet', 'L');
      a.upright.R.prop = 'spear';
      a.upright.R.weight = 1;
    }
    if ((a.spec.role === 'soldier' || a.spec.role === 'armourBearer' || a.spec.role === 'philistine') && a.props.main && !a.props.main.parent) a.holdProp('main', 'R');
    if (a.spec.role === 'elder' && a.props.staff && !a.props.staff.parent) a.holdProp('staff', 'R');
    // turnarounds: eyes on the horizon straight ahead
    a.mocap.lookAt = at.clone().add(new THREE.Vector3(Math.sin(a.yaw) * 20, 1.65, Math.cos(a.yaw) * 20));
    const T = o.t ?? 1.5;
    for (let t = 0; t < T; t += 1 / 30) a.update(1 / 30, camera, size.y, new THREE.Vector3(1.2, 0, 0.2));
  };
  const studio = (key: string, view: string, o: { yaw?: number; fov?: number; dist?: number; h?: number; clip?: string; t?: number; pose?: string; side?: number } = {}) => {
    hideAll();
    const a = actors[key];
    posed(a, o);
    const head = a.headWorld(new THREE.Vector3());
    const base = a.root.position.clone();
    const yaw = a.yaw;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const left = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const ang = { front: 0, three4: 0.7, side: 1.5708, back: Math.PI, face: 0.05, face34: 0.6, faceSide: 1.45, hands: 0.3, full: 0.35, low: 0.25 }[view] ?? 0;
    const dir = fwd.clone().multiplyScalar(Math.cos(ang)).addScaledVector(left, Math.sin(ang) * (o.side ?? 1));
    const faceView = view.startsWith('face');
    const dist = o.dist ?? (faceView ? 0.8 : view === 'hands' ? 1.4 : 6.2);
    const lookY = faceView ? head.y - 0.03 : view === 'hands' ? base.y + 1.0 : view === 'low' ? base.y + 1.5 : base.y + (head.y - base.y) * 0.55;
    const camY = o.h !== undefined ? base.y + o.h : faceView ? head.y : view === 'low' ? base.y + 0.5 : lookY + 0.1;
    camera.position.copy(base).addScaledVector(dir, dist).setY(camY);
    camera.lookAt(base.x, lookY, base.z);
    camera.fov = o.fov ?? (faceView ? 30 : 32);
    camera.near = 0.05;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    if (faceView) post.setDoF({ enabled: true, focusDistance: dist, fStop: 2.8, focalLength: null, target: null });
    else post.setDoF({ enabled: false });
    post.resetHistory();
    return render(3);
  };
  const lineup = (keys: string[], o: { dist?: number; fov?: number } = {}) => {
    hideAll();
    const n = keys.length;
    keys.forEach((k, i) => {
      const at = STUDIO.clone().add(new THREE.Vector3(0, 0, (i - (n - 1) / 2) * 0.9));
      posed(actors[k], { at, yaw: -Math.PI / 2 });
    });
    const c = STUDIO.clone().setY(H(STUDIO.x, STUDIO.z));
    camera.position.copy(c).add(new THREE.Vector3(-(o.dist ?? 6.5), 1.1, 0));
    camera.lookAt(c.x, c.y + 1.0, c.z);
    camera.fov = o.fov ?? 32;
    camera.updateProjectionMatrix();
    post.setDoF({ enabled: false });
    post.resetHistory();
    return render(3);
  };
  const shot = (name: GilgalShotName, t: number, o: { cam?: number[]; dof?: boolean } = {}) => {
    hideAll();
    const saul = actors.saul, samuel = actors.samuel;
    if (!perf) perf = new GilgalPerformance({ saul, samuel, armourBearer: actors.bearer }, H);
    saul.setVisible(true);
    samuel.setVisible(true);
    actors.bearer?.setVisible(true);
    perf.enter(name);
    const dt = 1 / 30;
    for (let k = 0, tt = 0; tt <= t; k++, tt = k * dt) perf.update(tt, dt, camera, size.y);
    const info = set.shots[name];
    set.setBeat(name, t);
    if (o.cam) {
      camera.position.set(o.cam[0], o.cam[1], o.cam[2]);
      camera.lookAt(o.cam[3], o.cam[4], o.cam[5]);
      camera.fov = o.cam[6] ?? 35;
      post.setDoF({ enabled: false });
    } else {
      const s = info.shot;
      const u = t / s.duration;
      const e = s.ease !== false ? u * u * (3 - 2 * u) : u;
      const f = s.at(e, t);
      camera.position.copy(f.pos);
      camera.lookAt(f.look);
      if (f.roll) camera.rotateZ(f.roll);
      camera.fov = f.fov ?? 40;
      const fp = info.focus(t);
      if (fp && post.dofAvailable && o.dof !== false) post.setDoF({ enabled: true, focusDistance: fp.distanceTo(camera.position), fStop: info.fStop, focalLength: null, target: null });
      else post.setDoF({ enabled: false });
    }
    camera.near = 0.05;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    post.resetHistory();
    return render(3);
  };
  const diag = (key: string, clip: string, t = 1) => {
    const a = actors[key];
    posed(a, { clip, t });
    return a.facing();
  };
  const stats = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, memory: renderer.info.memory, programs: renderer.info.programs?.length });
  w.__cast = { load, diag, studio, lineup, shot, stats, actors, set, camera, THREE, renderer };
  w.__ready = true;
}
boot().catch((e) => {
  console.error(e);
  w.__error = String((e as Error)?.stack || e);
});
