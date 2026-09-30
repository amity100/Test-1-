// Dev-only harness for the realistic David (src/characters/DavidModel.ts) — not part of the game build.
//
// /dev/david.html?q=high|medium|low
// Scripted (Playwright): await window.__D.sheet({ mode, view, frames, every, settle, w, h, cols }) renders a contact
// sheet of the clip into the page (one row per `cols` frames). Modes: idle hero walk walkslow jog sprint carrywalk
// startstop turn spin throw strike strikeHigh grab pick call dodge hurt pull carry kneel thanks.
// Views: side sideL front back three4 three4L low face bust feet wide handL handR (close-ups of the grips).
// window.__D.perf(mode, n) returns the mean CPU ms of DavidModel.update + updateSling.
import * as THREE from 'three';
import { SkySystem } from '../src/world/Sky';
import { PostFX } from '../src/fx/PostFX';
import { shared } from '../src/core/Shared';
import { SUN } from '../src/world/Layout';
import { DavidModel, type DavidParts } from '../src/characters/DavidModel';
import rockAlbedo from '../src/assets/textures/soil_albedo.jpg';
import rockNormal from '../src/assets/textures/soil_normal.jpg';

const P = new URLSearchParams(location.search);
const q = (P.get('q') ?? 'high') as 'low' | 'medium' | 'high';
const info = document.getElementById('info')!;
let W = 420, H = 560;

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, stencil: false });
renderer.domElement.id = 'gl';
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = parseFloat(P.get('exposure') ?? '0.6');
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const sheet = document.createElement('canvas');
document.body.appendChild(sheet);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 26000);
const sky = new SkySystem(renderer, q === 'high' ? 4096 : 2048);
scene.add(sky.group);
sky.setSun(parseFloat(P.get('el') ?? String(SUN.elevation)), parseFloat(P.get('az') ?? String(SUN.azimuth)), scene);
const post = new PostFX(renderer, scene, camera, sky.cubeTarget.texture, { msaa: q === 'low' ? 0 : 4, bloom: true, godRaySamples: 16, pixelRatio: 1 });
post.setSize(W, H);
post.atmosphere.uniforms.uDensity.value = 0.00012;

// uneven ground (tests the foot IK): gentle swells and a few steps of rock
const hf = (x: number, z: number) => 0.13 * Math.sin(x * 0.8 + 0.4) * Math.cos(z * 0.62) + 0.05 * Math.sin(z * 2.3 + x * 0.4) + 0.02 * Math.sin(x * 5.1 - z * 3.7);
const tl = new THREE.TextureLoader();
const ra = tl.load(rockAlbedo);
ra.colorSpace = THREE.SRGBColorSpace;
const rn = tl.load(rockNormal);
for (const t of [ra, rn]) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 30);
  t.anisotropy = 8;
}
const gGeo = new THREE.PlaneGeometry(60, 60, 240, 240);
gGeo.rotateX(-Math.PI / 2);
{
  const p = gGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, hf(p.getX(i), p.getZ(i)));
  gGeo.computeVertexNormals();
}
const groundMesh = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ map: ra, normalMap: rn, color: 0xd8c6a6, roughness: 0.95 }));
groundMesh.receiveShadow = true;
scene.add(groundMesh);

let parts: DavidParts;
let david: DavidModel;
const dyn = new THREE.Group();
scene.add(dyn);
const aimDir = new THREE.Vector3(0, 0, 1);
const beardPt = new THREE.Vector3();
let heading = 0;
let x = 0, z = 0, t = 0;
let dodgeT = -1;
const dodgeDir = new THREE.Vector3();

type Mode = string;
function resetState(mode: Mode) {
  x = 0; z = 0; t = 0; heading = 0;
  david.speed = 0;
  david.hold = 'none';
  david.staffMode = 'plant';
  david.lookTarget = null;
  david.mood = null;
  david.sling.state = 'idle';
  david.sling.loaded = true;
  dodgeT = -1;
  nextPlay = 0;
  vCur = 0;
  david.performFilm(null);
  david.autoHero = mode === 'idlehero';
  if (mode === 'hero') david.hold = 'hero';
  if (mode === 'pull') david.hold = 'pull';
  if (mode === 'carry' || mode === 'carrywalk') david.hold = 'carry';
  if (mode === 'kneel') david.hold = 'kneel';
  if (mode === 'thanks') david.hold = 'thanks';
  if (mode === 'grab' || mode === 'strikeHigh') {
    david.hold = 'grab';
    david.staffMode = 'strike';
    beardPt.set(0, hf(0, 1.0) + 1.9, 1.0);
    david.lookTarget = beardPt;
  }
  if (mode === 'strike') david.staffMode = 'strike';
  place();
  david.resetDynamics();
}
function place() {
  david.root.position.set(x, hf(x, z), z);
  david.root.rotation.y = heading;
}

let playedAt = -1;
let vCur = 0;
const dampA = (a: number, b: number, k: number, dt: number) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * (1 - Math.exp(-k * dt)); };
let nextPlay = 0;
function tick(mode: Mode, dt: number) {
  t += dt;
  const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  let v = 0;
  switch (mode) {
    case 'walk': v = 1.6; break;
    case 'walkslow': v = 1.25; break;
    case 'jog': v = 3.0; break;
    case 'sprint': v = 5.7; break;
    case 'carrywalk': v = 2.1; break;
    case 'startstop': v = t % 4 < 2 ? 3.0 : 0; break;
    case 'turn': v = 3.0; heading += dt * 1.6; break;
    case 'run': v = 4.3; break;
    // like the Player: damped speed (accelerate 6/s, brake 9/s) and damped heading (9/s)
    case 'walkstop': case 'jogstop': {
      const target = t % 3 < 1.5 ? (mode === 'walkstop' ? 1.6 : 3.0) : 0;
      vCur += (target - vCur) * (1 - Math.exp(-(target > vCur ? 6 : 9) * dt));
      v = vCur;
      break;
    }
    case 'turnspot': heading = dampA(heading, (Math.floor(t / 1.5) % 4) * (Math.PI / 2) * (Math.floor(t / 6) % 2 ? -1 : 1), 9, dt); break;
    case 'film_back': david.performFilm('back', t); break;
    case 'film_reveal': david.performFilm('reveal', t, { look: camera.position }); break;
    case 'film_wide': david.performFilm('wide', t); break;
    case 'spin':
      david.hold = 'spin';
      david.sling.state = 'spin';
      david.spinPower = Math.min(1, t / 1.2);
      break;
    case 'throw': {
      const cyc = t % 2.2;
      if (cyc < 1.2) {
        david.hold = 'spin';
        david.sling.state = 'spin';
        david.sling.loaded = true;
        david.spinPower = Math.min(1, cyc / 1.0);
        playedAt = -1;
      } else if (playedAt < 0) {
        playedAt = t;
        david.hold = 'none';
        david.play('throw', [{ t: 0.19, fn: () => david.releaseSling() }]);
      }
      if (david.sling.state === 'idle' && !david.busy) david.sling.loaded = true;
      break;
    }
    case 'strike': if (!david.busy && t >= nextPlay) { david.play('strike'); nextPlay = t + 1.0; } break;
    case 'strikeHigh': if (!david.busy && t >= nextPlay) { david.play('strikeHigh'); nextPlay = t + 0.9; } break;
    case 'pick': if (!david.busy && t >= nextPlay) { david.play('pick'); nextPlay = t + 1.5; } break;
    case 'call': if (!david.busy && t >= nextPlay) { david.play('call'); nextPlay = t + 2.0; } break;
    case 'hurt': if (!david.busy && t >= nextPlay) { david.play('hurt'); nextPlay = t + 1.0; } break;
    case 'dodge':
      if (!david.busy && t >= nextPlay) {
        nextPlay = t + 1.2;
        dodgeDir.set(Math.cos(heading), 0, -Math.sin(heading)).multiplyScalar(Math.floor(t / 1.2) % 2 ? -1 : 1);
        david.dodgeSide = dodgeDir.x * Math.cos(heading) - dodgeDir.z * Math.sin(heading);
        david.play('dodge');
        dodgeT = 0;
      }
      break;
  }
  if (dodgeT >= 0) {
    dodgeT += dt;
    const k = Math.max(0, 1 - dodgeT / 0.42);
    x += dodgeDir.x * 7.5 * k * dt;
    z += dodgeDir.z * 7.5 * k * dt;
    if (dodgeT > 0.5) dodgeT = -1;
  }
  david.speed = v;
  x += fwd.x * v * dt;
  z += fwd.z * v * dt;
  place();
  aimDir.copy(fwd);
  shared.uTime.value += dt;
  david.update(dt);
  david.updateSling(dt, aimDir);
}

function frameCamera(view: string, dist = 0) {
  const r = david.root.position;
  const h = 1.75;
  const f = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  const left = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
  const at = (target: THREE.Vector3, dir: THREE.Vector3, d: number, fov: number) => {
    camera.fov = fov;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    camera.position.copy(target).addScaledVector(dir.normalize(), d);
    camera.lookAt(target);
  };
  const c = r.clone().add(new THREE.Vector3(0, h * 0.52, 0));
  const head = david.human.bones.head.getWorldPosition(new THREE.Vector3());
  switch (view) {
    case 'side': at(c, left.clone().negate().add(new THREE.Vector3(0, 0.05, 0)), dist || 5.2, 30); break;
    case 'sideL': at(c, left.clone().add(new THREE.Vector3(0, 0.05, 0)), dist || 5.2, 30); break;
    case 'front': at(c, f.clone().add(new THREE.Vector3(0, 0.05, 0)), dist || 5.2, 30); break;
    case 'back': at(c, f.clone().negate().add(new THREE.Vector3(0, 0.1, 0)), dist || 5.2, 30); break;
    case 'three4': at(c, f.clone().addScaledVector(left, -0.8).add(new THREE.Vector3(0, 0.08, 0)), dist || 5.2, 30); break;
    case 'three4L': at(c, f.clone().addScaledVector(left, 0.8).add(new THREE.Vector3(0, 0.08, 0)), dist || 5.2, 30); break;
    case 'low': at(r.clone().add(new THREE.Vector3(0, h * 0.6, 0)), f.clone().addScaledVector(left, -0.55).add(new THREE.Vector3(0, -0.22, 0)), dist || 4.4, 34); break;
    case 'face': at(head.clone().add(new THREE.Vector3(0, 0.02, 0)), f.clone().addScaledVector(left, -0.6).add(new THREE.Vector3(0, 0.05, 0)), dist || 0.9, 30); break;
    case 'bust': at(head.clone().add(new THREE.Vector3(0, -0.25, 0)), f.clone().addScaledVector(left, -0.5).add(new THREE.Vector3(0, 0.05, 0)), dist || 1.8, 30); break;
    case 'feet': at(r.clone().add(new THREE.Vector3(0, 0.25, 0)), left.clone().negate().addScaledVector(f, 0.3).add(new THREE.Vector3(0, 0.15, 0)), dist || 1.8, 30); break;
    case 'wide': at(c, f.clone().addScaledVector(left, -0.9).add(new THREE.Vector3(0, 0.25, 0)), dist || 9, 30); break;
    case 'handL': at(david.human.sockets.handGripL.getWorldPosition(new THREE.Vector3()), f.clone().addScaledVector(left, 0.6).add(new THREE.Vector3(0, 0.1, 0)), dist || 0.7, 30); break;
    case 'handR': at(david.human.sockets.handGripR.getWorldPosition(new THREE.Vector3()), f.clone().addScaledVector(left, -0.6).add(new THREE.Vector3(0, 0.1, 0)), dist || 0.7, 30); break;
    default: at(c, f, 5.2, 30);
  }
  shared.uCamPos.value.copy(camera.position);
}

function render(dt = 1 / 30) {
  sky.update(camera, david.root.position.clone().add(new THREE.Vector3(0, 1, 0)));
  post.render(dt);
}

async function main() {
  const t0 = performance.now();
  parts = await DavidModel.preload(q, { msaa: q === 'low' ? 0 : 4 });
  david = new DavidModel(undefined, parts);
  if (P.get('mocap') === '0') david.mocapWeight = 0;
  david.ground = hf;
  david.camera = camera;
  scene.add(david.root);
  david.attachSling(dyn);
  resetState('idle');
  for (let i = 0; i < 30; i++) tick('idle', 1 / 30);
  (window as unknown as { __info: unknown }).__info = {
    loadMs: parts.loadMs, totalMs: performance.now() - t0,
    outfit: parts.outfit.stats, groom: parts.groom?.stats ? { strands: parts.groom.stats.strands, trianglesFull: parts.groom.stats.trianglesFull } : null,
    bodyTris: parts.human.metrics.triangles,
  };
  (window as unknown as { __D: unknown }).__D = api;
  (window as unknown as { __ready: boolean }).__ready = true;
}

const api = {
  get david() { return david; },
  async sheet(o: { mode: Mode; view?: string; frames?: number; every?: number; settle?: number; w?: number; h?: number; cols?: number; dist?: number; label?: boolean }) {
    const w = o.w ?? 360, h = o.h ?? 480;
    if (w !== W || h !== H) {
      W = w; H = h;
      renderer.setSize(W, H);
      post.setSize(W, H);
    }
    const n = o.frames ?? 8, cols = o.cols ?? n, rows = Math.ceil(n / cols);
    sheet.width = cols * W;
    sheet.height = rows * H;
    const ctx = sheet.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    resetState(o.mode);
    const dt = 1 / 30;
    const settle = o.settle ?? 1.0;
    nextPlay = settle;
    for (let i = 0; i < Math.round(settle / dt); i++) tick(o.mode, dt);
    const every = o.every ?? 0.1;
    const t0 = t;
    let calls = 0, tris = 0;
    for (let k = 0; k < n; k++) {
      const steps = k === 0 ? 0 : Math.max(1, Math.round(every / dt));
      for (let i = 0; i < steps; i++) tick(o.mode, dt);
      frameCamera(o.view ?? 'side', o.dist ?? 0);
      render(dt);
      render(dt);
      calls = renderer.info.render.calls;
      tris = renderer.info.render.triangles;
      ctx.drawImage(renderer.domElement, (k % cols) * W, Math.floor(k / cols) * H);
      if (o.label !== false) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect((k % cols) * W, Math.floor(k / cols) * H, 150, 18);
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.fillText(`${o.mode} t=${(t - t0).toFixed(2)}`, (k % cols) * W + 4, Math.floor(k / cols) * H + 13);
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    return { calls, tris };
  },
  /** debug: where the right hand's grip socket is vs the mouth during a clip */
  probe(mode: Mode, at = 0.6) {
    resetState(mode);
    for (let i = 0; i < 10; i++) tick(mode, 1 / 30);
    const n = Math.round(at * 30);
    for (let i = 0; i < n; i++) tick(mode, 1 / 30);
    const v = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3()).toArray().map((x) => +x.toFixed(3));
    const h = david.human;
    return { grip: v(h.sockets.handGripR), palm: v(h.sockets.palmR), mouth: v(h.sockets.mouth), head: v(h.bones.head), wristProxy: v(david.j.hdR), shoulder: v(david.j.uaR), action: david.actionName };
  },
  /** one rendered frame's cost (main + shadow + post passes) at the given view */
  stats(mode: Mode, view = 'three4', dist = 0) {
    resetState(mode);
    for (let i = 0; i < 45; i++) tick(mode, 1 / 30);
    frameCamera(view, dist);
    render();
    renderer.info.autoReset = false;
    renderer.info.reset();
    render();
    const r = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries };
    renderer.info.autoReset = true;
    // same frame without David (ground + sky + post only)
    david.root.visible = false;
    david.setVisible(false);
    renderer.info.autoReset = false;
    renderer.info.reset();
    render();
    const base = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    renderer.info.autoReset = true;
    david.root.visible = true;
    david.setVisible(true);
    return { withDavid: r, without: base, david: { calls: r.calls - base.calls, tris: r.tris - base.tris } };
  },
  perf(mode: Mode, n = 120) {
    resetState(mode);
    for (let i = 0; i < 30; i++) tick(mode, 1 / 30);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) tick(mode, 1 / 30);
    return (performance.now() - t0) / n;
  },
};

main().catch((e) => {
  info.textContent = 'ERROR ' + (e?.stack ?? e);
  console.error(e);
  (window as unknown as { __error: string }).__error = String(e?.stack ?? e);
});
