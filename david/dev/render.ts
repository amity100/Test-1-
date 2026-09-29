// Dev-only harness for the post chain (TAA / DoF / letterbox / film look / crossfade) — not part of the game.
//
// /dev/render.html?w=960&h=540&q=high&taa=hq|lq|0&msaa=0|2|4&aa=fxaa|none&sharpen=0.3&tdither=1&bear=1&david=1
//   window.__r: shot(name) (camera presets: face, hair, bear, wide, pan0), frames(n, dt), panTo(...), setTAA(on),
//               dof(settings), letterbox(r, s), film(a, s), fade(s, through), move(on) (bear walks across)
import * as THREE from 'three';
import { SkySystem } from '../src/world/Sky';
import { PostFX } from '../src/fx/PostFX';
import { temporal } from '../src/fx/Temporal';
import { shared } from '../src/core/Shared';
import { pose, PoseMixer } from '../src/characters/Rig';
import { HumanModel } from '../src/characters/human/HumanModel';
import { createGroom, type Groom } from '../src/characters/hair';
import { BearActor } from '../src/gameplay/BearActor';
import { Colliders } from '../src/core/Colliders';
import type { Terrain } from '../src/world/Terrain';
import rockAlbedo from '../src/assets/textures/rock_albedo.jpg';
import rockNormal from '../src/assets/textures/rock_normal.jpg';

const P = new URLSearchParams(location.search);
const q = (P.get('q') ?? 'high') as 'low' | 'medium' | 'high';
const W = parseInt(P.get('w') ?? '960', 10);
const H = parseInt(P.get('h') ?? '540', 10);
const msaa = parseInt(P.get('msaa') ?? '0', 10);
const taaP = P.get('taa') ?? 'hq';
const taa = taaP === '0' ? false : taaP === 'lq' ? 'lq' : 'hq';
const info = document.getElementById('info')!;
const win = window as unknown as Record<string, unknown>;

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, stencil: false, depth: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = parseFloat(P.get('exposure') ?? '0.58');
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 26000);
const sky = new SkySystem(renderer, q === 'high' ? 4096 : 2048);
scene.add(sky.group);
sky.setSun(13, 100, scene);
const sc = sky.sun.shadow.camera;
sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6;
sc.updateProjectionMatrix();
sky.sun.shadow.bias = -0.0002;
sky.sun.shadow.normalBias = 0.015;

const post = new PostFX(renderer, scene, camera, sky.cubeTarget.texture, {
  msaa, bloom: true, godRaySamples: 24, taa, dofSamples: parseInt(P.get('dofk') ?? (q === 'low' ? '16' : '43'), 10),
  aa: (P.get('aa') ?? 'fxaa') as 'fxaa' | 'none', sharpen: parseFloat(P.get('sharpen') ?? (taa ? '0.3' : '0.2')),
  filmFx: P.get('film') !== '0', bloomScale: 0.5, bloomMips: 5,
});
post.setSize(W, H);
post.atmosphere.uniforms.uDensity.value = 0.00012;

// ground: limestone-ish plane with a few boulders
const tl = new THREE.TextureLoader();
const ra = tl.load(rockAlbedo);
ra.colorSpace = THREE.SRGBColorSpace;
const rn = tl.load(rockNormal);
for (const t of [ra, rn]) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 30);
  t.anisotropy = 8;
}
const gGeo = new THREE.PlaneGeometry(80, 80, 8, 8);
gGeo.rotateX(-Math.PI / 2);
const groundMat = new THREE.MeshStandardMaterial({ map: ra, normalMap: rn, color: 0xd8c6a4, roughness: 0.93 });
const ground = new THREE.Mesh(gGeo, groundMat);
ground.receiveShadow = true;
scene.add(ground);
const rockGeo = new THREE.IcosahedronGeometry(1, 3);
{
  const p = rockGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const n = 1 + 0.18 * Math.sin(v.x * 5.1 + v.y * 3.3) * Math.cos(v.z * 4.2) + 0.08 * Math.sin(v.y * 11.0);
    v.multiplyScalar(n);
    p.setXYZ(i, v.x, v.y * 0.62, v.z);
  }
  rockGeo.computeVertexNormals();
}
for (const [x, z, s] of [[-3.2, -4, 1.1], [4.5, -7, 1.6], [-7, -12, 2.2], [2.2, 3.5, 0.6], [-1.2, -9, 0.9]]) {
  const m = new THREE.Mesh(rockGeo, groundMat);
  m.position.set(x, 0.1 * s, z);
  m.scale.setScalar(s);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}
// thin geometry: a few dry grass-like stalks (sub-pixel lines shimmer without TAA)
{
  const g = new THREE.BufferGeometry();
  const pos: number[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) {
    const x = (rnd() - 0.5) * 14, z = -rnd() * 14 + 2;
    if (Math.hypot(x, z) < 1.2) continue;
    const h = 0.25 + rnd() * 0.45, w = 0.004 + rnd() * 0.004, lean = (rnd() - 0.5) * 0.25, a = rnd() * Math.PI;
    const dx = Math.cos(a) * w, dz = Math.sin(a) * w;
    pos.push(x - dx, 0, z - dz, x + dx, 0, z + dz, x + lean, h, z + lean * 0.5);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.8, side: THREE.DoubleSide }));
  m.castShadow = true;
  scene.add(m);
}

const IDLE = pose({
  hips: [0, 0, 0.03], chest: [0.02, 0, 0], head: [-0.06, 0.25, 0],
  uaL: [0.02, 0, 0.1], faL: [-0.2, 0, 0], uaR: [0.04, 0, -0.1], faR: [-0.25, 0, 0],
  thL: [-0.06, 0, 0.03], shinL: [0.08, 0, 0], thR: [0.09, 0, -0.04], shinR: [0.05, 0, 0],
});

let david: HumanModel | null = null;
let groom: Groom | null = null;
let bear: BearActor | null = null;
let bearMove = false;
const wind = new THREE.Vector3(1.0, 0, 0.4);

/** Proof of the one-line integration change in HairMaterial.ts: add temporal.uDitherOffset to the IGN input. */
function patchTemporalDither(root: THREE.Object3D) {
  let n = 0;
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (!m || Array.isArray(m) || m.userData.tdPatched) return;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (s, r) => {
      prev.call(m, s, r);
      if (!s.fragmentShader.includes('hairIGN( gl_FragCoord.xy + vec2(')) return;
      s.uniforms.uDitherOffset = temporal.uDitherOffset;
      s.fragmentShader = 'uniform vec2 uDitherOffset;\n' + s.fragmentShader.split('hairIGN( gl_FragCoord.xy + vec2(').join('hairIGN( gl_FragCoord.xy + uDitherOffset + vec2(');
      n++;
    };
    const key = m.customProgramCacheKey.bind(m);
    m.customProgramCacheKey = () => key() + '-td';
    m.userData.tdPatched = true;
    m.needsUpdate = true;
  });
  return n;
}

async function load() {
  if (P.get('david') !== '0') {
    david = await HumanModel.load({ preset: 'david', quality: q });
    scene.add(david.root);
    const mixer = new PoseMixer(david.joints);
    mixer.reset();
    mixer.layer(IDLE, 1);
    mixer.apply();
    david.joints.hips.position.y = david.rig.hipHeight;
    david.joints.hips.position.z = david.rig.pelvis.z;
    david.rig.blinkEnabled = false;
    david.rig.lookTarget = null;
    david.setPupil(0.2);
    for (let i = 0; i < 30; i++) david.update(1 / 30, camera, H);
    groom = await createGroom(david, 'david', { quality: q, msaa, simulate: true });
    if (P.get('tdither') === '1') patchTemporalDither(groom.root);
  }
  if (P.get('bear') !== '0') {
    const terrain = { heightAt: () => 0 } as unknown as Terrain;
    bear = new BearActor(terrain, new Colliders(), scene, { quality: q });
    await bear.model.ready;
    bear.visible = true;
    bear.place(2.6, -1.5, -2.2);
    bear.update(1 / 30);
  }
}

const views: Record<string, { pos: [number, number, number]; look: [number, number, number]; fov: number }> = {
  face: { pos: [0.55, 1.68, 1.05], look: [0.0, 1.62, 0.0], fov: 24 },
  hair: { pos: [-0.62, 1.74, 0.72], look: [0.0, 1.66, 0.0], fov: 18 },
  bear: { pos: [4.4, 1.25, 0.9], look: [2.6, 0.75, -1.5], fov: 26 },
  wide: { pos: [1.2, 1.55, 5.6], look: [0.8, 1.0, -1.0], fov: 38 },
};

function shot(name: string) {
  const v = views[name];
  camera.position.set(...v.pos);
  camera.lookAt(new THREE.Vector3(...v.look));
  camera.fov = v.fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  post.resetHistory();
}

let simTime = 0;
function frame(dt: number) {
  simTime += dt;
  shared.uTime.value += dt;
  shared.uCamPos.value.copy(camera.position);
  if (david) {
    david.update(dt, camera, H);
    groom?.update(dt, wind);
  }
  if (bear) {
    if (bearMove) bear.moveTo(new THREE.Vector3(-40, 0, -2.0), 1.6, dt);
    bear.update(dt);
  }
  sky.update(camera, new THREE.Vector3(0.5, 0, -1));
  post.render(dt);
}

function frames(n: number, dt = 1 / 30, cam?: (i: number) => void) {
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    cam?.(i);
    frame(dt);
  }
  const gl = renderer.getContext();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  return performance.now() - t0;
}

win.__r = {
  shot,
  frames,
  /** pan the camera around `look` by `deg` degrees over n frames (moving-camera ghosting check) */
  pan(n: number, deg: number, dt = 1 / 30) {
    const look = new THREE.Vector3();
    camera.getWorldDirection(look).multiplyScalar(4).add(camera.position);
    const start = camera.position.clone().sub(look);
    return frames(n, dt, (i) => {
      const a = THREE.MathUtils.degToRad((deg * (i + 1)) / n);
      camera.position.copy(start).applyAxisAngle(new THREE.Vector3(0, 1, 0), a).add(look);
      camera.lookAt(look);
      camera.updateMatrixWorld();
    });
  },
  setTAA: (on: boolean) => post.setTAAEnabled(on),
  dof: (s: Record<string, unknown>) => post.setDoF(s),
  letterbox: (r: number | null, s = 1.2) => post.setLetterbox(r, s),
  film: (a: number, s = 1) => post.setFilmLook(a, s),
  fade: (s: number, through?: number) => post.crossfade(s, through === undefined ? {} : { through }),
  move: (on: boolean) => (bearMove = on),
  bearPos: () => bear?.pos.toArray(),
  stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, mem: (post.bytes / 1048576).toFixed(1) + ' MB', taa: post.taaEnabled, groom: groom?.stats.strands }),
  post,
  camera,
};

load()
  .then(() => {
    shot(P.get('view') ?? 'face');
    frames(2);
    info.textContent = `q=${q} taa=${taa} msaa=${msaa}`;
    win.__ready = true;
  })
  .catch((e) => {
    console.error(e);
    win.__error = String((e as Error)?.stack || e);
  });
