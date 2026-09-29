// dev/world.html — the environment alone (terrain, sky, rocks, terrace walls, vegetation, grass, Bethlehem)
// rendered through the real Engine + post chain, for fast visual iteration without characters / story.
//
//   ?q=low|medium|high
// window.__world.shot([x,y,z], [lx,ly,lz], fov, relY?) positions the camera (relY: y values are above ground)
// and renders; returns a PNG data URL of the canvas.
import * as THREE from 'three';
import { Engine } from '../src/core/Engine';
import { shared } from '../src/core/Shared';

const app = document.getElementById('app')!;
const w = window as unknown as Record<string, unknown>;

async function boot() {
  const engine = new Engine(app);
  const t0 = performance.now();
  await engine.build(() => {});
  const buildMs = performance.now() - t0;
  const cam = engine.camera;
  const shot = (p: number[], l: number[], fov = 50, rel = false, frames = 2) => {
    const gy = (x: number, z: number) => engine.terrain.heightAt(x, z);
    cam.position.set(p[0], p[1] + (rel ? gy(p[0], p[2]) : 0), p[2]);
    const look = new THREE.Vector3(l[0], l[1] + (rel ? gy(l[0], l[2]) : 0), l[2]);
    cam.lookAt(look);
    engine.setFov(fov);
    cam.updateMatrixWorld();
    engine.focus.copy(cam.position).add(cam.getWorldDirection(new THREE.Vector3()).multiplyScalar(18));
    for (let i = 0; i < frames; i++) engine.render(1 / 30, 1 / 30);
    return (engine.renderer.domElement as HTMLCanvasElement).toDataURL('image/png');
  };
  const info = () => {
    let tris = 0, draws = 0;
    engine.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible) return;
      const g = m.geometry;
      const t = (g.index ? g.index.count : g.getAttribute('position')?.count ?? 0) / 3;
      const inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
      tris += t * inst;
      draws++;
    });
    return { buildMs, tris, meshes: draws, quality: engine.quality.name, tier: engine.quality.tier, rocks: (engine.rocks as unknown as { stats?: unknown }).stats, walls: engine.rocks.walls ? { length: engine.rocks.walls.length, streamed: engine.rocks.walls.streamed, ribbonTris: engine.rocks.walls.triangles } : null, veg: (engine.vegetation as unknown as { stats?: unknown }).stats, renderInfo: engine.renderer.info.render };
  };
  w.__world = { engine, shot, info, shared, THREE };
  w.__ready = true;
}
boot().catch((e) => {
  console.error(e);
  w.__error = String((e as Error)?.stack || e);
});
