import * as THREE from 'three';
import { shared } from './materials.js';

/**
 * Bakes one depth map of the static city as seen from the sun. The city never moves,
 * so this happens once at startup.
 */
export function bakeSunShadows(renderer, group, sunDir, size = 2048) {
  const meshes = group.children.filter((o) => o.isMesh && o.geometry && o.geometry.getAttribute('aFace') && !o.geometry.isInstancedBufferGeometry);
  if (!meshes.length) return null;
  const box = new THREE.Box3();
  for (const m of meshes) {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox);
  }
  const center = box.getCenter(new THREE.Vector3());
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  cam.position.copy(center).addScaledVector(sunDir, 1200);
  cam.up.set(0, 1, 0);
  cam.lookAt(center);
  cam.updateMatrixWorld();
  const inv = cam.matrixWorldInverse;
  const lo = new THREE.Vector3(Infinity, Infinity, Infinity);
  const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(inv);
    lo.min(v);
    hi.max(v);
  }
  cam.left = lo.x - 2;
  cam.right = hi.x + 2;
  cam.bottom = lo.y - 2;
  cam.top = hi.y + 2;
  cam.near = -hi.z - 5;
  cam.far = -lo.z + 5;
  cam.updateProjectionMatrix();

  const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
  rt.texture.generateMipmaps = false;
  rt.depthTexture = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
  const depthMat = new THREE.MeshDepthMaterial({ side: THREE.DoubleSide });
  const scene = new THREE.Scene();
  scene.overrideMaterial = depthMat;
  const parents = meshes.map((m) => m.parent);
  for (const m of meshes) scene.add(m);
  const prev = renderer.getRenderTarget();
  const clear = renderer.getClearColor(new THREE.Color());
  const clearA = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0xffffff, 1);
  renderer.clear(true, true, true);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev);
  renderer.setClearColor(clear, clearA);
  meshes.forEach((m, i) => parents[i].add(m));
  depthMat.dispose();

  shared.uShadowMap.value = rt.depthTexture;
  shared.uShadowMatrix.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  shared.uShadowTexel.value = 1 / size;
  return rt;
}

const tmp = new THREE.Vector3();
const fwd = new THREE.Vector3();
const look = new THREE.Vector3();

// Screen positions of the horizon and the sun, for the coloured-pencil sky glow.
export function updateSkyUniforms(camera) {
  const r = shared.uResolution.value;
  look.set(0, 0, -1).applyQuaternion(camera.quaternion);
  fwd.copy(look);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
  fwd.normalize();
  tmp.copy(camera.position).addScaledVector(fwd, 5000).project(camera);
  shared.uHorizonY.value = (tmp.y * 0.5 + 0.5) * r.y;
  const s = shared.uSunDir.value;
  const inFront = s.dot(look) > 0.05;
  tmp.copy(camera.position).addScaledVector(s, 5000).project(camera);
  shared.uSunScreen.value.set((tmp.x * 0.5 + 0.5) * r.x, (tmp.y * 0.5 + 0.5) * r.y, inFront ? 1 : 0);
}
