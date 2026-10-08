import * as THREE from 'three';
import { shared, surfaceDepthMaterial } from './materials.js';

// The city's shadows: one depth map of the whole city as the sun sees it. The city only changes
// when something is rubbed out (and the sun only moves slowly over the day), so it is baked once
// and baked again only then. What moves casts its shadow through a small map made every frame
// (see pipeline.js).

const bake = { renderer: null, meshes: null, cam: null, rt: null, box: null, size: 2048, sun: new THREE.Vector3(), at: -1e9 };
const _c = new THREE.Vector3();
const _v = new THREE.Vector3();
const _lo = new THREE.Vector3();
const _hi = new THREE.Vector3();

function fitCamera() {
  const { cam, box } = bake;
  const sun = shared.uSunDir.value;
  box.getCenter(_c);
  cam.position.copy(_c).addScaledVector(sun, 2000);
  if (Math.abs(sun.y) > 0.97) cam.up.set(0, 0, -1);
  else cam.up.set(0, 1, 0);
  cam.lookAt(_c);
  cam.updateMatrixWorld();
  const inv = cam.matrixWorldInverse;
  _lo.set(Infinity, Infinity, Infinity);
  _hi.set(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < 8; i++) {
    _v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(inv);
    _lo.min(_v);
    _hi.max(_v);
  }
  cam.left = _lo.x - 2;
  cam.right = _hi.x + 2;
  cam.bottom = _lo.y - 2;
  cam.top = _hi.y + 2;
  cam.near = Math.max(0.5, -_hi.z - 5);
  cam.far = -_lo.z + 5;
  cam.updateProjectionMatrix();
}

function renderBake() {
  const { renderer, meshes, cam, rt } = bake;
  fitCamera();
  const scene = new THREE.Scene();
  scene.overrideMaterial = surfaceDepthMaterial();
  const parents = meshes.map((m) => m.parent);
  for (const m of meshes) scene.add(m);
  const prev = renderer.getRenderTarget();
  const on = shared.uShadowOn.value;
  shared.uShadowOn.value = 0;
  renderer.setRenderTarget(rt);
  renderer.clear(true, true, true);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev);
  shared.uShadowOn.value = on;
  meshes.forEach((m, i) => parents[i].add(m));
  shared.uShadowFar.value = rt.depthTexture;
  shared.uShadowFarM.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  shared.uShadowFarTexel.value = 1 / bake.size;
  // how far a point steps off its surface before it looks for its shadow: a texel and a half
  const texel = Math.max(cam.right - cam.left, cam.top - cam.bottom) / bake.size;
  shared.uShadowFarP.value.set(texel * 1.5, 0.12 / (cam.far - cam.near), 0, 0);
  bake.sun.copy(shared.uSunDir.value);
}

// Props were rubbed out (or walls were): redraw the sun's view so their shadows go too.
export function rebakeSunShadows() {
  if (bake.rt) renderBake();
}

// The sun moved on (the day goes by): bake again now and then.
export function followSun(now) {
  if (!bake.rt) return;
  if (bake.sun.angleTo(shared.uSunDir.value) < 0.006) return;
  if (now - bake.at < 1.2) return;
  bake.at = now;
  renderBake();
}

/**
 * Bakes one depth map of the static city as seen from the sun. Flat ground (roads, the land,
 * the water) only ever receives shadows, so it is left out.
 */
export function bakeSunShadows(renderer, group, size = 2048, bounds = null) {
  const meshes = group.children.filter((o) => o.isMesh && o.geometry && o.geometry.getAttribute('aFace') && !o.geometry.isInstancedBufferGeometry && !o.userData.flatGround);
  if (!meshes.length) return null;
  const box = new THREE.Box3();
  for (const m of meshes) {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox);
  }
  if (bounds) {
    box.min.x = Math.max(box.min.x, bounds.minX);
    box.max.x = Math.min(box.max.x, bounds.maxX);
    box.min.z = Math.max(box.min.z, bounds.minZ);
    box.max.z = Math.min(box.max.z, bounds.maxZ);
  }
  const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
  rt.texture.generateMipmaps = false;
  rt.depthTexture = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
  Object.assign(bake, { renderer, meshes, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10), rt, box, size });
  renderBake();
  shared.uShadowOn.value = 1;
  return rt;
}

export function updateSkyUniforms() {
  // (the original edition placed its paper sky by these; the pen sky works them out itself)
}
