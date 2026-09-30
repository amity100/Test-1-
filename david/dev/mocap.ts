// Dev-only harness for src/characters/mocap (not part of the game build).
//
// /dev/mocap.html?clips=walk,run&preset=david|saul|man&n=6&view=side|front|three4|back&w=260&h=360&q=low|medium|high
//   contact sheet: one row per clip, n evenly spaced frames per row, the game's sky/sun lighting, ground grid.
//   &mirror=1  &layer=<clip>&mask=upper (partial layer over every row)  &look=x,y,z  &ik=1 (foot IK on a slope)
//   &live=1    real-time playback of the first clip (orbit with the mouse wheel: no, fixed camera)
// window.__info: per clip { slide: planted-foot slide cm/s (heel/ball), pen: lowest sole (cm), pops: max joint deg/frame }
import * as THREE from 'three';
import { SkySystem } from '../src/world/Sky';
import { HumanModel } from '../src/characters/human/HumanModel';
import { MocapLibrary, MocapPlayer, MOCAP_INDEX } from '../src/characters/mocap';

const P = new URLSearchParams(location.search);
const preset = (P.get('preset') ?? 'david') as 'david' | 'saul' | 'man';
const q = (P.get('q') ?? 'medium') as 'low' | 'medium' | 'high';
const clips = (P.get('clips') ?? 'walk').split(',').filter((c) => c in MOCAP_INDEX);
const N = parseInt(P.get('n') ?? '6', 10);
const CW = parseInt(P.get('w') ?? '240', 10);
const CH = parseInt(P.get('h') ?? '340', 10);
const view = P.get('view') ?? 'side';
const mirror = P.get('mirror') === '1';
const live = P.get('live') === '1';
const W = CW * N, H = CH * clips.length;
const info = document.getElementById('info')!;
const w = window as unknown as { __ready?: boolean; __error?: string; __info?: unknown };

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, stencil: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = parseFloat(P.get('exposure') ?? '0.62');
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, CW / CH, 0.05, 20000);
const sky = new SkySystem(renderer, 2048);
scene.add(sky.group);
const [sunEl, sunAz] = (P.get('sun') ?? '24,120').split(',').map(Number);
sky.setSun(sunEl, sunAz, scene);
const sc = sky.sun.shadow.camera;
sc.left = -2; sc.right = 2; sc.top = 2.4; sc.bottom = -2;
sc.updateProjectionMatrix();
sky.sun.shadow.bias = -0.0002;
sky.sun.shadow.normalBias = 0.012;

// ground: warm limestone-dust colour with a 0.5 m grid (reveals sliding feet)
const slope = P.get('ik') === '1';
const groundH = (x: number, z: number) => (slope ? 0.18 * Math.sin(x * 1.3) + 0.12 * z * 0.25 + 0.06 * Math.sin(z * 2.1) : 0);
const gGeo = new THREE.PlaneGeometry(80, 80, 160, 160);
gGeo.rotateX(-Math.PI / 2);
{
  const p = gGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, groundH(p.getX(i), p.getZ(i)));
  gGeo.computeVertexNormals();
}
const gc = document.createElement('canvas');
gc.width = gc.height = 256;
{
  const g = gc.getContext('2d')!;
  g.fillStyle = '#b8a27f';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(70,52,34,0.55)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 256, 256);
}
const gt = new THREE.CanvasTexture(gc);
gt.colorSpace = THREE.SRGBColorSpace;
gt.wrapS = gt.wrapT = THREE.RepeatWrapping;
gt.repeat.set(160, 160);
gt.anisotropy = 8;
const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95 }));
ground.receiveShadow = true;
scene.add(ground);

async function main() {
  const t0 = performance.now();
  const human = await HumanModel.load({ preset, quality: q });
  human.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  scene.add(human.root);
  const lib = MocapLibrary.shared;
  const extra = P.get('layer');
  await lib.preload([...clips, ...(extra ? [extra] : [])]);
  const mp = new MocapPlayer(human, lib);
  mp.rootMotion = 'inplace';
  if (P.get('ik') === '1') mp.footIK = { enabled: true, ground: groundH };
  if (P.has('look')) {
    const [x, y, z] = P.get('look')!.split(',').map(Number);
    mp.lookAt = new THREE.Vector3(x, y, z);
  }
  human.rig.setFingers('both', 'relaxed');
  const loadMs = performance.now() - t0;
  const stats: Record<string, unknown> = {};
  const tr = [0, 0, 0];
  const place = (clip: string, t: number) => {
    const c = lib.get(clip)!;
    mp.play(clip, { fade: 0, time: t, mirror });
    if (extra) mp.playLayer('extra', extra, { fade: 0, time: t, mask: (P.get('mask') ?? 'upper') as 'upper' });
    mp.update(0);
    c.trajectoryAt(t, tr, mirror);
    human.root.position.set(tr[0] * mp.scale, 0, tr[1] * mp.scale);
    human.root.rotation.y = tr[2];
    human.update(1 / 30, camera, CH);
  };
  // ---- numeric checks: foot slide while planted, sole penetration, joint pops
  const foot = { L: human.rig.bones['foot.L'], R: human.rig.bones['foot.R'] };
  const ball = { L: human.rig.bones['toe3-1.L'], R: human.rig.bones['toe3-1.R'] };
  for (const name of clips) {
    const c = lib.get(name)!;
    const dt = 1 / 30;
    let slideH = 0, nH = 0, slideB = 0, nB = 0, pen = 1;
    const prev: Record<string, THREE.Vector3> = {};
    let pops = 0;
    const qPrev = new Float32Array(mp.pose.q.length);
    for (let f = 0; f < c.frames; f++) {
      place(name, f * dt);
      human.root.updateMatrixWorld(true);
      const cont = mp.pose.contacts;
      for (const s of ['L', 'R'] as const) {
        const hp = new THREE.Vector3().setFromMatrixPosition(foot[s].matrixWorld);
        const bp = new THREE.Vector3().setFromMatrixPosition(ball[s].matrixWorld);
        const hOn = cont & (s === 'L' ? 1 : 4), bOn = cont & (s === 'L' ? 2 : 8);
        if (f > 0 && hOn && prev['h' + s]) {
          slideH += Math.hypot(hp.x - prev['h' + s].x, hp.z - prev['h' + s].z) / dt;
          nH++;
        }
        if (f > 0 && bOn && prev['b' + s]) {
          slideB += Math.hypot(bp.x - prev['b' + s].x, bp.z - prev['b' + s].z) / dt;
          nB++;
        }
        prev['h' + s] = hOn ? hp : (undefined as unknown as THREE.Vector3);
        prev['b' + s] = bOn ? bp : (undefined as unknown as THREE.Vector3);
        pen = Math.min(pen, bp.y - 0.02);
      }
      if (f > 0) for (let i = 0; i < qPrev.length; i += 4) {
        const d = Math.abs(qPrev[i] * mp.pose.q[i] + qPrev[i + 1] * mp.pose.q[i + 1] + qPrev[i + 2] * mp.pose.q[i + 2] + qPrev[i + 3] * mp.pose.q[i + 3]);
        pops = Math.max(pops, (2 * Math.acos(Math.min(1, d)) * 180) / Math.PI);
      }
      qPrev.set(mp.pose.q);
    }
    stats[name] = { slideHeel: +((100 * slideH) / Math.max(1, nH)).toFixed(1), slideBall: +((100 * slideB) / Math.max(1, nB)).toFixed(1), minBall: +(pen * 100).toFixed(1), maxDegPerFrame: +pops.toFixed(1), dur: c.duration.toFixed(2) };
  }
  // ---- CPU cost per frame: rig only vs rig + mocap (2 blended tracks + 1 layer)
  const bench = (withMocap: boolean) => {
    mp.weight = withMocap ? 1 : 0;
    mp.play(clips[0], { fade: 0.5 });
    if (clips[1]) mp.play(clips[1], { fade: 0.5, additiveBlend: true });
    const t = performance.now();
    for (let i = 0; i < 240; i++) {
      if (withMocap) mp.update(1 / 60);
      human.update(1 / 60, camera, CH);
    }
    return (performance.now() - t) / 240;
  };
  const cpu = { rigOnlyMs: +bench(false).toFixed(3), rigPlusMocapMs: +bench(true).toFixed(3) };
  mp.weight = 1;
  // ---- contact sheet
  const camFor = (target: THREE.Vector3, yaw: number) => {
    const dist = preset === 'saul' ? 5.6 : 5.0;
    const a = view === 'front' ? 0 : view === 'back' ? Math.PI : view === 'three4' ? 0.75 : Math.PI / 2;
    const ang = yaw + a;
    camera.position.set(target.x + Math.sin(ang) * dist, 1.05, target.z + Math.cos(ang) * dist);
    camera.lookAt(target.x, 0.92, target.z);
  };
  const render = () => {
    renderer.setScissorTest(true);
    renderer.clear();
    clips.forEach((name, row) => {
      const c = lib.get(name)!;
      for (let i = 0; i < N; i++) {
        const t = c.loop ? (c.duration * i) / N : (c.duration * i) / Math.max(1, N - 1);
        place(name, t);
        const pv = new THREE.Vector3();
        human.rig.bones.spine05.getWorldPosition(pv);
        camFor(pv, 0);
        sky.update(camera, pv);
        const x = i * CW, y = (clips.length - 1 - row) * CH;
        renderer.setViewport(x, y, CW, CH);
        renderer.setScissor(x, y, CW, CH);
        renderer.render(scene, camera);
      }
    });
    renderer.setScissorTest(false);
  };
  render();
  const labels = clips.map((n, i) => `<div style="position:absolute;left:4px;top:${i * CH + 2}px">${n} (${MOCAP_INDEX[n].src}) ${MOCAP_INDEX[n].duration.toFixed(2)}s ${JSON.stringify(stats[n])}</div>`);
  info.innerHTML = labels.join('');
  w.__info = { loadMs, cpu, stats };
  w.__ready = true;
  if (live) {
    const clock = new THREE.Clock();
    mp.rootMotion = 'apply';
    mp.play(clips[0], { mirror });
    const loop = () => {
      const dt = Math.min(0.05, clock.getDelta());
      mp.update(dt);
      human.update(dt, camera, H);
      const pv = new THREE.Vector3();
      human.rig.bones.spine05.getWorldPosition(pv);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      camFor(pv, 0);
      sky.update(camera, pv);
      renderer.setViewport(0, 0, W, H);
      renderer.clear();
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    };
    loop();
  }
}
main().catch((e) => {
  w.__error = String(e?.stack ?? e);
  info.textContent = w.__error;
});
