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
  const posed = (a: FilmActor, o: { yaw?: number; clip?: string; t?: number; pose?: string; at?: THREE.Vector3; noLook?: boolean; body?: Partial<FilmActor['body']>; legs?: number; hide?: string[] }) => {
    a.body.drop = a.body.lean = a.body.twist = a.body.side = a.body.feetFwd = 0;
    Object.assign(a.body, o.body ?? {});
    a.mocap.stopLayer('lunge', 0.001);
    if (o.legs !== undefined) a.mocap.playLayer('lunge', 'walk', { mask: 'legs', time: o.legs, speed: 0, fade: 0.001 });
    a.root.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) c.visible = !(o.hide ?? []).some((h) => c.name.includes(h));
    });
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
    if (o.noLook) a.mocap.lookAt = null;
    const T = o.t ?? 1.5;
    for (let t = 0; t < T; t += 1 / 30) a.update(1 / 30, camera, size.y, new THREE.Vector3(1.2, 0, 0.2));
  };
  const studio = (key: string, view: string, o: { yaw?: number; fov?: number; dist?: number; h?: number; clip?: string; t?: number; pose?: string; side?: number; body?: Partial<FilmActor['body']>; legs?: number; hide?: string[]; names?: boolean } = {}) => {
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
    const r = render(3);
    if (o.names) {
      const names: string[] = [];
      a.root.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) names.push(c.name);
      });
      return { ...r, names };
    }
    return r;
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
  const markers = new THREE.Group();
  markers.visible = false;
  const mk = (c: number) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: c, depthTest: false }));
    m.renderOrder = 999;
    markers.add(m);
    return m;
  };
  const mCorner = mk(0xff2020), mHand = mk(0x20ff40);
  set.scene.add(markers);
  const shot = (name: GilgalShotName, t: number, o: { cam?: number[]; dof?: boolean; follow?: number[]; mark?: boolean; face?: string; faceCam?: number[] } = {}) => {
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
    markers.visible = !!o.mark;
    if (o.mark && perf) {
      perf.tearFocus(mCorner.position);
      saul.human.sockets.handGripR.getWorldPosition(mHand.position);
    }
    if (o.face && o.faceCam) {
      // camera relative to an actor's head: [dist, azimuth from its facing (rad, + = its left), dy, fov, lookDy]
      const a = actors[o.face];
      const hp = a.eyesWorld(new THREE.Vector3());
      const fy = a.facing().face + (o.faceCam[1] ?? 0);
      camera.position.set(hp.x + Math.sin(fy) * o.faceCam[0], hp.y + (o.faceCam[2] ?? 0), hp.z + Math.cos(fy) * o.faceCam[0]);
      camera.lookAt(hp.x, hp.y + (o.faceCam[4] ?? -0.02), hp.z);
      camera.fov = o.faceCam[3] ?? 30;
      if (post.dofAvailable && o.dof !== false) post.setDoF({ enabled: true, focusDistance: o.faceCam[0], fStop: 2.2, focalLength: null, target: null });
      else post.setDoF({ enabled: false });
    } else if (o.follow && perf) {
      // camera relative to the tear focus: [dx, dy, dz, fov, lookDy]
      const f = perf.tearFocus(new THREE.Vector3());
      camera.position.set(f.x + o.follow[0], f.y + o.follow[1], f.z + o.follow[2]);
      camera.lookAt(f.x, f.y + (o.follow[4] ?? 0.1), f.z);
      camera.fov = o.follow[3] ?? 32;
      if (post.dofAvailable && o.dof !== false) post.setDoF({ enabled: true, focusDistance: camera.position.distanceTo(f), fStop: 2.4, focalLength: null, target: null });
      else post.setDoF({ enabled: false });
    } else if (o.cam) {
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
  /** numbers only: the performance of a shot simulated to each time in `times` (positions, yaw, face heading) */
  const perfTrace = (name: GilgalShotName, times: number[]) => {
    const saul = actors.saul, samuel = actors.samuel;
    if (!perf) perf = new GilgalPerformance({ saul, samuel, armourBearer: actors.bearer }, H);
    perf.enter(name);
    const dt = 1 / 30;
    const out: string[] = [];
    const f2 = (x: number) => x.toFixed(2);
    let ti = 0;
    for (let k = 0, tt = 0; ti < times.length; k++, tt = k * dt) {
      perf.update(tt, dt, camera, size.y);
      if (tt >= times[ti] - 1e-6) {
        const a = saul.facing(), b = samuel.facing();
        const c = perf.tearFocus(new THREE.Vector3());
        const h = saul.human.sockets.handGripR.getWorldPosition(new THREE.Vector3());
        out.push(`t=${f2(tt)} saul x=${f2(saul.root.position.x)} yaw=${f2(a.yaw)} face=${f2(a.face)} | sam x=${f2(samuel.root.position.x)} yaw=${f2(b.yaw)} face=${f2(b.face)} | corner ${f2(c.x)},${f2(c.y)},${f2(c.z)} hand ${f2(h.x)},${f2(h.y)},${f2(h.z)} torn=${samuel.tear?.isTorn} p=${f2(samuel.tear?.progress ?? 0)}`);
        ti++;
      }
    }
    return out;
  };
  const diag = (key: string, clip: string, t = 1, noLook = false) => {
    const a = actors[key];
    posed(a, { clip, t, noLook });
    return a.facing();
  };
  /** clip trajectory probe: root (world xz, yaw) + right wrist / head in the placement frame, every `step` s */
  const trace = (key: string, clip: string, o: { dur?: number; step?: number; mode?: 'apply' | 'inplace'; time?: number; cancel?: boolean } = {}) => {
    const a = actors[key];
    a.setVisible(true);
    a.place(STUDIO, Math.PI / 2);
    a.human.root.position.x = 0;
    a.human.root.position.z = 0;
    a.human.root.rotation.y = 0;
    a.armPose.L.pose = null;
    a.armPose.R.pose = null;
    a.reach.R.weight = 0;
    a.upright.R.weight = 0;
    a.mocap.lookAt = null;
    a.cancelHeading = o.cancel ?? true;
    a.mocap.rootMotion = o.mode ?? 'apply';
    a.mocap.rootTarget = a.root;
    a.headingSnap = true;
    a.mocap.play(clip, { fade: 0, time: o.time ?? 0 });
    const rows: number[][] = [];
    const inv = new THREE.Matrix4();
    const f = (v: THREE.Vector3) => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)];
    const dt = 1 / 30;
    const step = o.step ?? 0.2;
    const origin = STUDIO.clone();
    for (let t = 0, k = 0; t <= (o.dur ?? 3); k++, t = k * dt) {
      a.update(dt, camera, size.y);
      if (k % Math.round(step / dt) === 0) {
        // frame of the ORIGINAL placement (x forward = +X world since yaw = PI/2)
        inv.makeTranslation(origin.x, 0, origin.z);
        const w = (a.human.bones as Record<string, THREE.Object3D>)['wrist.R'].getWorldPosition(new THREE.Vector3()).sub(origin);
        const h = a.headWorld(new THREE.Vector3()).sub(origin);
        const r = a.root.position.clone().sub(origin);
        const fl = (a.human.bones as Record<string, THREE.Object3D>)['foot.L'].getWorldPosition(new THREE.Vector3()).sub(origin);
        const fr = (a.human.bones as Record<string, THREE.Object3D>)['foot.R'].getWorldPosition(new THREE.Vector3()).sub(origin);
        rows.push([+t.toFixed(2), ...f(r), +a.root.rotation.y.toFixed(2), +a.facing().face.toFixed(2), ...f(w), ...f(h), +(fl.x - r.x).toFixed(2), +(fr.x - r.x).toFixed(2)]);
      }
    }
    a.mocap.rootMotion = 'inplace';
    a.cancelHeading = true;
    return { cols: 't rx ry rz yaw face wx wy wz hx hy hz footLx footRx', rows: rows.map((r) => r.join(' ')) };
  };
  const stats = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, memory: renderer.info.memory, programs: renderer.info.programs?.length });
  w.__cast = { load, diag, studio, lineup, shot, stats, trace, perfTrace, actors, set, camera, THREE, renderer };
  w.__ready = true;
}
boot().catch((e) => {
  console.error(e);
  w.__error = String((e as Error)?.stack || e);
});
