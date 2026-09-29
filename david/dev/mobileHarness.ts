// dev/mobile.html — reproduces the "black flash" of the old post chain and checks the new one.
//
// A back-lit golden-hour shot: the camera looks toward a low sun (like many of the game's cinematic
// shots) past a few small, smooth objects (eyes, a wet nose, polished leather, a sling stone...). At
// grazing angles three's GGX specular (roughness is clamped to >= 0.0525) exceeds the half-float
// maximum (65504), so the HDR target holds +Inf there. The old chain (UnrealBloom -> OutputPass ACES)
// smears that Inf over the bloom mips and ACES turns it into NaN (Inf/Inf) -> black blotches.
//
//   ?mode=old|new   &frames=N   &w=..&h=..
// window.__run(mode, frames) -> { infPixels, nanPixels, darkFrac: [...per frame], blotchFrames }
import * as THREE from 'three';
import { PostFX } from '../src/fx/PostFX';
import { OldPostFX } from './mobileOldPostFX';
import { FrameWatchdog } from '../src/fx/Watchdog';
import { shared } from '../src/core/Shared';

const params = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
const pr = Number(params.get('pr') || 1);
renderer.setPixelRatio(pr);
renderer.setSize(innerWidth, innerHeight, false);
renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.58;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.3, 26000);

// sun: 13 deg elevation, same colour/intensity as SkySystem.setSun at the chapter's start
const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 13), THREE.MathUtils.degToRad(180));
shared.uSunDir.value.copy(sunDir);
shared.uSunColor.value.setRGB(1.0, 0.55 + 0.33 * 0.52, 0.28 + 0.45 * 0.52);
const sun = new THREE.DirectionalLight(shared.uSunColor.value, 7.5);
sun.position.copy(sunDir).multiplyScalar(60);
scene.add(sun, new THREE.HemisphereLight(0x9fb8d8, 0x6b4a2e, 0.55));

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { uSunDir: shared.uSunDir, uSunColor: shared.uSunColor },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
  fragmentShader: `uniform vec3 uSunDir, uSunColor; varying vec3 vDir;
    void main(){ vec3 d = normalize(vDir); float mu = max(dot(d, uSunDir), 0.0);
      vec3 col = mix(vec3(1.3, 0.8, 0.45), vec3(0.12, 0.22, 0.45), pow(clamp(d.y, 0.0, 1.0), 0.42));
      col += uSunColor * (pow(mu, 6.0) * 0.38 + pow(mu, 40.0) + pow(mu, 400.0) * 3.5) + uSunColor * smoothstep(0.99975, 0.99992, mu) * 24.0;
      if (d.y < 0.0) col *= 0.6; gl_FragColor = vec4(col, 1.0); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(10000, 48, 24), skyMat);
sky.frustumCulled = false;
scene.add(sky);
const skyScene = new THREE.Scene();
skyScene.add(new THREE.Mesh(sky.geometry, skyMat));
const cubeRT = new THREE.WebGLCubeRenderTarget(64, { type: THREE.HalfFloatType });
new THREE.CubeCamera(1, 30000, cubeRT).update(renderer, skyScene);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb08a55, roughness: 0.95 }));
ground.receiveShadow = true;
scene.add(ground);
// small smooth objects: eyeball / wet nose / polished leather / sling stone
const smooth = [
  new THREE.MeshPhysicalMaterial({ color: 0xf2efe8, roughness: 0.0, metalness: 0, clearcoat: 1, clearcoatRoughness: 0 }),
  new THREE.MeshStandardMaterial({ color: 0x1b1310, roughness: 0.08 }),
  new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.12 }),
  new THREE.MeshStandardMaterial({ color: 0x9a9690, roughness: 0.1 }),
];
const objs: THREE.Mesh[] = [];
for (let i = 0; i < 14; i++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.12 + (i % 4) * 0.05, 48, 32), smooth[i % smooth.length]);
  m.position.set(-2.6 + (i % 7) * 0.85, 0.9 + Math.floor(i / 7) * 0.7, -6 - (i % 3));
  m.castShadow = true;
  scene.add(m);
  objs.push(m);
}
// a still water surface (drinking trough / cistern) at the spot where it mirrors the low sun: a flat,
// smooth surface has no geometric roughness, so the GGX peak (~4e4) survives -> radiance >> 65504
const water = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0c1a1c, roughness: 0.0, metalness: 0 }));
water.position.set(0, 0.5, 2 - 0.9 / Math.tan(THREE.MathUtils.degToRad(13)));
scene.add(water);
const trough = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 1.1), new THREE.MeshStandardMaterial({ color: 0x8c8274, roughness: 0.9 }));
trough.position.set(water.position.x, 0.26, water.position.z);
scene.add(trough);
const cam0 = new THREE.Vector3(0, 1.4, 2);
camera.position.copy(cam0);
camera.lookAt(new THREE.Vector3(0, 1.2, -6).add(sunDir.clone().multiplyScalar(2)));

// probe target: same format as the composer's scene buffer, to count Inf / NaN texels the RenderPass produces
const probe = new THREE.WebGLRenderTarget(renderer.domElement.width, renderer.domElement.height, { type: THREE.HalfFloatType });
function countBad(): { inf: number; nan: number; max: number } {
  renderer.setRenderTarget(probe);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  const buf = new Uint16Array(probe.width * probe.height * 4);
  renderer.readRenderTargetPixels(probe, 0, 0, probe.width, probe.height, buf);
  let inf = 0, nan = 0, max = 0;
  for (let i = 0; i < buf.length; i++) {
    if ((i & 3) === 3) continue;
    const h = buf[i], e = (h >> 10) & 0x1f, f = h & 0x3ff;
    if (e === 31) { if (f === 0) inf++; else nan++; }
    else max = Math.max(max, THREE.DataUtils.fromHalfFloat(h));
  }
  return { inf, nan, max };
}

const w = window as unknown as Record<string, unknown>;
w.__run = (mode: 'old' | 'new', frames = 24, showAt = 0.5) => {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const post = mode === 'old'
    ? new OldPostFX(renderer, scene, camera, cubeRT.texture, { msaa: 0, bloom: true, godRaySamples: 16, pixelRatio: pr })
    : new PostFX(renderer, scene, camera, cubeRT.texture, { msaa: 0, bloom: true, godRaySamples: 20, aa: 'fxaa', sharpen: 0.35, filmFx: false, bloomScale: 0.5, bloomMips: 5 });
  post.setSize(size.x, size.y);
  const wd = new FrameWatchdog(renderer, 1);
  const dark: number[] = [];
  let infTotal = 0, nanTotal = 0, maxHdr = 0, framesWithInf = 0;
  const pose = (t: number) => {
    // slow drift of the camera (as when the player walks by): the glint comes and goes
    for (let i = 0; i < objs.length; i++) objs[i].position.y = 0.9 + Math.floor(i / 7) * 0.7 + Math.sin(t * 6.283 + i) * 0.08;
    camera.position.set(cam0.x + Math.sin(t * 6.283) * 0.6, cam0.y + Math.cos(t * 3.1) * 0.15, cam0.z);
    camera.lookAt(new THREE.Vector3(0, 1.2, -6).add(sunDir.clone().multiplyScalar(2)));
    camera.updateMatrixWorld();
  };
  for (let f = 0; f < frames; f++) {
    pose(f / frames);
    const bad = countBad();
    infTotal += bad.inf; nanTotal += bad.nan; maxHdr = Math.max(maxHdr, bad.max);
    if (bad.inf + bad.nan > 0) framesWithInf++;
    post.render(1 / 30);
    wd.afterFrame();
    dark.push(+wd.lastDark.toFixed(3));
  }
  const res = { mode, frames, framesWithInf, infTexels: infTotal, nanTexels: nanTotal, maxFiniteHdr: maxHdr, darkFrac: dark, blackOrBlotchFrames: dark.filter((d) => d > 0.05).length };
  pose(showAt); // leave a chosen frame on screen for the screenshot
  post.render(0);
  return res;
};
w.__ready = true;
