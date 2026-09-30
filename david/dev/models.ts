// dev/models.html — models-pass checks that no other harness covers (not part of the game build).
//   ?view=bearEyes&shine=3&light=0.08   the bear's head in the dark of the thicket, the tapetum eye-shine (H2)
// window.__M.shot(shine, light) re-renders with another eye-shine strength / light level.
import * as THREE from 'three';
import { BearModel } from '../src/characters/BearModel';

const P = new URLSearchParams(location.search);
const W = innerWidth, H = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.58;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020302);
const camera = new THREE.PerspectiveCamera(28, W / H, 0.05, 200);
// the thicket: almost no light inside; a dim cool sky fill and a weak warm key from behind the viewer
const hemi = new THREE.HemisphereLight(0x3a4a5a, 0x0a0805, 0.25);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffd7a0, 0.6);
key.position.set(0, 1.5, 6);
scene.add(key);
const w = window as unknown as Record<string, unknown>;

async function boot() {
  const bear = new BearModel({ quality: (P.get('q') as 'low' | 'medium' | 'high') ?? 'high' });
  await bear.ready;
  scene.add(bear.root);
  for (let i = 0; i < 20; i++) bear.update(1 / 30);
  bear.root.updateMatrixWorld(true);
  const head = bear.headCenter.getWorldPosition(new THREE.Vector3());
  const shot = (shine: number, light: number) => {
    bear.eyeShine = shine;
    hemi.intensity = 0.25 * light / 0.08;
    key.intensity = 0.6 * light / 0.08;
    // in front of the face (the bear faces +Z in its bind frame), a little above the eye line
    camera.position.set(head.x + 0.15, head.y + 0.08, head.z + 2.4);
    camera.lookAt(head.x, head.y + 0.02, head.z + 0.3);
    renderer.render(scene, camera);
    renderer.render(scene, camera);
    return { shine, light };
  };
  w.__M = { shot, bear };
  shot(parseFloat(P.get('shine') ?? '3'), parseFloat(P.get('light') ?? '0.08'));
  w.__ready = true;
}
boot().catch((e) => {
  console.error(e);
  w.__error = String((e as Error)?.stack || e);
});
