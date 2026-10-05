// dev/beards.html — beard1 (wave 6): the bearded men of the film (Samuel, Saul, the elders of Ramah, an Israelite soldier)
// under the film's light — the Gilgal set's sun and sky, its post chain WITH the tier's TAA, the film's face-light rig — at
// the framings the film shows them (G6's close-up, G4's medium, P7's profile and two-shot), so the grooms can be judged
// before / after. Only public APIs (FilmActor, GilgalSet, FaceLightRig): the same page builds against any tree.
// Not part of the game build.
//
//   ?tier=desktop-high|desktop-medium|mobile-high|mobile-low   (default desktop-high)   ?lb=1 letterbox 2.39
//
// window.__bd:
//   load(keys)            'samuel', 'saul', 'elder:1', 'elder:4', 'soldier:5' (role[:seed]) -> build ms, groom stats
//   shot(o)               o = { keys: [k] | [k1, k2], framing: 'close' | 'profile' | 'medium' | 'two' | 'back',
//                               light: 'gilgal' (golden back light) | 'ramah' (side light) | 'front',
//                               az?, dist?, fov?, dy?, frames? (TAA frames, default 8), t? (settle s), jaw?, rig? }
//                         -> { calls, tris, ms }
//   groom(key)            the groom's stats (strands, triangles, GPU bytes, build ms ...)
//   info()                tier, TAA, renderer programs
import * as THREE from 'three';
import { makeQuality, type TierName } from '../src/core/Engine';
import { GilgalSet } from '../src/film/gilgal/GilgalSet';
import { FilmActor, GILGAL_CLIPS, RAMAH_CLIPS, POSES } from '../src/film/cast';
import { FaceLightRig } from '../src/film/cast/faceLight';
import { MocapLibrary } from '../src/characters/mocap';
import { SAMUEL } from '../src/film/gilgal/gilgalLayout';

const app = document.getElementById('app')!;
const params = new URLSearchParams(location.search);
const w = window as unknown as Record<string, unknown>;

type Framing = 'close' | 'profile' | 'medium' | 'two' | 'back';
interface ShotOpts {
  keys: string[];
  framing: Framing;
  light: 'gilgal' | 'ramah' | 'front';
  az?: number;
  dist?: number;
  fov?: number;
  dy?: number;
  frames?: number;
  t?: number;
  jaw?: number;
  rig?: string | null;
  sunOff?: number;
  /** false: hide the strands (the skin under them alone) */
  strands?: boolean;
}

// framing: camera azimuth around the face (deg, + = the man's left), distance (m), fov, look height below the eyes (m)
const FRAMING: Record<Framing, { az: number; dist: number; fov: number; dy: number; camDy: number }> = {
  close: { az: 28, dist: 0.95, fov: 30, dy: -0.07, camDy: -0.04 }, // G6: Samuel's verdict close-up, a little from below
  profile: { az: 84, dist: 1.0, fov: 30, dy: -0.05, camDy: -0.01 }, // P7: Samuel in profile in the gateway
  medium: { az: 14, dist: 2.7, fov: 24, dy: -0.32, camDy: -0.15 }, // G4: the man in the road, waist up
  two: { az: 0, dist: 2.3, fov: 30, dy: -0.12, camDy: -0.06 }, // P7: two elders
  back: { az: 150, dist: 1.1, fov: 32, dy: -0.06, camDy: 0.02 }, // the hair from behind (scalp, nape)
};

async function boot() {
  const tier = (params.get('tier') ?? 'desktop-high') as TierName;
  const mobile = tier.startsWith('mobile');
  const q = makeQuality(tier, mobile, '');
  const qn = q.name as 'low' | 'medium' | 'high';
  const renderer = new THREE.WebGLRenderer({ antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setSize(app.clientWidth, app.clientHeight, false);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  app.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(30, app.clientWidth / app.clientHeight, 0.05, 90000);
  const set = await GilgalSet.create({ renderer, quality: q });
  const rig = new FaceLightRig({ quality: qn });
  rig.addTo(set.scene);
  rig.setPreset('off', 0);
  const floatTargets = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const post = set.createPost(camera, {
    msaa: q.msaa, bloom: q.bloom, godRaySamples: q.godRaySamples, aa: q.aa, taa: q.taa, dofSamples: q.dofSamples, sharpen: q.sharpen, filmFx: q.filmFx,
    bloomScale: q.bloomScale, bloomMips: q.bloomMips, colorType: floatTargets ? THREE.HalfFloatType : THREE.UnsignedByteType,
  });
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(size.x, size.y);
  if (params.get('lb') === '1') post.setLetterbox(2.39, 0);
  post.setFilmLook(0.55, 0);
  post.setDoF({ enabled: false });
  set.showPlaceholders(false);
  const H = (x: number, z: number) => set.height(x, z);
  await MocapLibrary.shared.preload([...new Set([...GILGAL_CLIPS, ...RAMAH_CLIPS])]);
  const actors: Record<string, FilmActor> = {};
  const loadInfo: Record<string, unknown> = {};
  const load = async (keys: string[]) => {
    for (const key of keys) {
      if (actors[key]) continue;
      const [role, seedS, lodS] = key.split(':');
      const t0 = performance.now();
      const a = await FilmActor.create({
        role: role as never, quality: qn, seed: seedS ? +seedS : 1, msaa: q.msaa, ground: H,
        ...(lodS ? { lod: lodS as never } : {}),
      });
      const ms = performance.now() - t0;
      a.addTo(set.scene);
      a.setVisible(false);
      actors[key] = a;
      const g = a.groom;
      loadInfo[key] = { actorMs: Math.round(ms), groom: g ? { ...g.stats, layers: undefined } : null };
    }
    return loadInfo;
  };
  const hideAll = () => {
    for (const k in actors) actors[k].setVisible(false);
  };
  renderer.info.autoReset = false;
  const STUDIO = new THREE.Vector3(SAMUEL.pos.x + 6, 0, SAMUEL.pos.z + 3);
  const YAW = -Math.PI / 2;
  const wind = new THREE.Vector3(1.2, 0, 0.2);
  const posed = (a: FilmActor, at: THREE.Vector3, yaw: number, T: number, jaw: number | undefined) => {
    a.body.drop = a.body.lean = a.body.twist = a.body.side = a.body.feetFwd = 0;
    a.setVisible(true);
    a.place(at, yaw);
    a.headingSnap = true;
    a.mocap.play('idle_king', { fade: 0 });
    if (a.spec.role === 'saul') {
      a.armPose.L.pose = POSES.helmetL;
      a.armPose.L.weight = 1;
      a.armPose.R.pose = POSES.spearCarryR;
      a.armPose.R.weight = 1;
      if (!a.props.spear.parent) a.holdProp('spear', 'R');
      if (a.props.helmet && !a.props.helmet.parent) a.carryUnderArm('helmet', 'L');
      a.upright.R.prop = 'spear';
      a.upright.R.weight = 1;
    }
    if ((a.spec.role === 'soldier' || a.spec.role === 'armourBearer') && a.props.main) {
      if (!a.props.main.parent) a.holdProp('main', 'R');
      if (a.kit === 'spear' || a.kit === 'armourBearer') {
        a.armPose.R.pose = POSES.spearCarryR;
        a.armPose.R.weight = 1;
        a.upright.R.prop = 'main';
        a.upright.R.weight = 1;
      }
    }
    if (a.spec.role === 'elder' && a.props.staff && !a.props.staff.parent) a.holdProp('staff', 'R');
    a.mocap.lookAt = at.clone().add(new THREE.Vector3(Math.sin(yaw) * 20, 1.65, Math.cos(yaw) * 20));
    a.groom?.sim?.reset();
    for (let t = 0; t < T; t += 1 / 30) {
      a.human.rig.jawOpen = jaw ?? 0;
      a.update(1 / 30, camera, size.y, wind);
    }
  };
  const fwd = new THREE.Vector3(Math.sin(YAW), 0, Math.cos(YAW));
  const left = new THREE.Vector3(fwd.z, 0, -fwd.x);
  const tmp = new THREE.Vector3();
  const shot = (o: ShotOpts) => {
    const t0 = performance.now();
    hideAll();
    const F = FRAMING[o.framing];
    const As = o.keys.map((k) => actors[k]).filter(Boolean);
    if (!As.length) throw new Error('not loaded: ' + o.keys.join(','));
    // placement: one man at the studio mark; two side by side, a little turned to each other
    if (As.length === 1) posed(As[0], STUDIO, YAW, o.t ?? 1.5, o.jaw);
    else {
      posed(As[0], STUDIO.clone().addScaledVector(left, 0.42), YAW - 0.3, o.t ?? 1.5, o.jaw);
      posed(As[1], STUDIO.clone().addScaledVector(left, -0.42), YAW + 0.3, o.t ?? 1.5, o.jaw);
    }
    const eyes = new THREE.Vector3();
    for (const a of As) eyes.add(a.eyesWorld(tmp));
    eyes.multiplyScalar(1 / As.length);
    const az = THREE.MathUtils.degToRad(o.az ?? F.az);
    const dir = fwd.clone().multiplyScalar(Math.cos(az)).addScaledVector(left, Math.sin(az));
    const dist = o.dist ?? F.dist;
    camera.position.copy(eyes).addScaledVector(dir, dist);
    camera.position.y = eyes.y + F.camDy;
    camera.up.set(0, 1, 0);
    camera.lookAt(eyes.x, eyes.y + (o.dy ?? F.dy), eyes.z);
    camera.fov = o.fov ?? F.fov;
    camera.near = 0.05;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    // light: the sun behind the man and to his side (Gilgal's golden back light, G2-G7), from the side (Ramah's gate),
    // or from the camera side (a reference)
    const camTheta = THREE.MathUtils.radToDeg(Math.atan2(dir.x, dir.z));
    const sunTheta = o.light === 'gilgal' ? camTheta + 180 - 38 : o.light === 'ramah' ? camTheta + 100 : camTheta + 30;
    set.setSunCheat(sunTheta + (o.sunOff ?? 0));
    const lead = As[0];
    const preset = o.rig !== undefined ? o.rig : o.light === 'gilgal' ? (lead.spec.role === 'samuel' ? 'verdict' : lead.spec.role === 'saul' ? 'afternoonKing' : null) : null;
    if (preset) {
      rig.setPreset(preset as never, 1);
      rig.update(lead.eyesWorld(tmp), camera);
    } else rig.setPreset('off', 0);
    for (const a of As) if (a.groom) a.groom.strands.visible = o.strands !== false;
    post.resetHistory();
    const frames = o.frames ?? (q.taa ? 8 : 2);
    let calls = 0, tris = 0;
    for (let i = 0; i < frames; i++) {
      // the men keep breathing / the hair keeps moving a little while TAA converges (as in the film)
      for (const a of As) {
        a.human.rig.jawOpen = o.jaw ?? 0;
        a.update(1 / 60, camera, size.y, wind);
      }
      renderer.info.reset();
      set.update(1 / 60, camera, { advanceTime: false });
      set.applyExposure(renderer);
      post.render(1 / 60);
      calls = renderer.info.render.calls;
      tris = renderer.info.render.triangles;
    }
    return { calls, tris, ms: Math.round(performance.now() - t0), frames };
  };
  const groom = (key: string) => {
    const g = actors[key]?.groom;
    return g ? { ...g.stats } : null;
  };
  const info = () => ({ tier: q.tier, name: q.name, msaa: q.msaa, taa: q.taa, programs: renderer.info.programs?.length, size: [size.x, size.y] });
  w.__bd = { load, shot, groom, info, actors, set, camera, rig, renderer, post, THREE };
  w.__ready = true;
}
boot().catch((e) => {
  console.error(e);
  w.__error = String((e as Error)?.stack || e);
});
