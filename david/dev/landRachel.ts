// dev/landRachel.html — shot 3 (Rachel's tomb) filmed in the game world (src/film/land/rachel.ts) through the real Engine.
//   ?q=low|medium|high   ?flock=0
// window.__rachel: shot(name, u, frames?) -> data URL; view(p, l, fov) -> data URL; profile(z, x0, x1, step)
import * as THREE from 'three';
import { Engine } from '../src/core/Engine';
import { Flock } from '../src/characters/Flock';
import { rachelShots, alongPolyline } from '../src/film/land/rachel';

const app = document.getElementById('app')!;
const w = window as unknown as Record<string, unknown>;
const params = new URLSearchParams(location.search);

/** a distant shepherd silhouette: cloak, head-cloth, staff (placeholder for the cast's 'man') */
function shepherdPlaceholder() {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0x8a7658, roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.3, 1.35, 10), cloth); body.position.y = 0.72;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), cloth); head.position.y = 1.55;
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.9, 5), new THREE.MeshStandardMaterial({ color: 0x5a4430 }));
  staff.position.set(0.28, 0.95, 0.15); staff.rotation.z = -0.08;
  for (const m of [body, head, staff]) { m.castShadow = true; g.add(m); }
  return g;
}

async function boot() {
  const engine = new Engine(app);
  await engine.build(() => {});
  const cam = engine.camera;
  const ground = (x: number, z: number) => engine.terrain.heightAt(x, z);
  const village = (engine).village;
  const pillar = village?.rachelPillar ?? new THREE.Vector3(-150, ground(-150, -198), -198);
  const R = rachelShots(ground, pillar);
  let flock: Flock | null = null;
  const shep = shepherdPlaceholder();
  engine.scene.add(shep);
  if (params.get('flock') !== '0') {
    await Flock.preloadAsync(7);
    const a = R.anchors;
    flock = new Flock({ sheep: 14, rams: 2, goats: 7, ground, pastureCenter: a.flockRoute[0].clone(), pastureRadius: 9, seed: 7, quality: engine.quality.name });
    engine.scene.add(flock.group);
  }
  let simT = 0;
  const shepPos = new THREE.Vector3();
  /** advance the shepherd + flock to film time t (s) */
  const simulate = (t: number) => {
    const a = R.anchors;
    const dt = 1 / 15;
    while (simT < t) {
      simT += dt;
      alongPolyline(a.shepherdRoute, simT * a.walkSpeed, shepPos);
      shepPos.y = ground(shepPos.x, shepPos.z);
      const nxt = alongPolyline(a.shepherdRoute, simT * a.walkSpeed + 1, new THREE.Vector3());
      shep.position.copy(shepPos);
      shep.rotation.y = Math.atan2(nxt.x - shepPos.x, nxt.z - shepPos.z);
      if (flock && simT <= dt * 1.5) flock.call(shepPos);
      if (flock) {
        flock.setPasture(alongPolyline(a.flockRoute, Math.max(0, simT * a.walkSpeed - 6), new THREE.Vector3()), 8);
        flock.update(dt, simT, { shepherd: shepPos, threats: [], camera: cam });
      }
    }
  };
  const place = (p: THREE.Vector3, l: THREE.Vector3, fov: number, frames: number) => {
    cam.position.copy(p);
    cam.lookAt(l);
    engine.setFov(fov);
    cam.updateMatrixWorld();
    engine.focus.copy(cam.position).add(cam.getWorldDirection(new THREE.Vector3()).multiplyScalar(14));
    for (let i = 0; i < frames; i++) engine.render(1 / 30, 1 / 30);
    return (engine.renderer.domElement as HTMLCanvasElement).toDataURL('image/png');
  };
  const shot = (name: string, u: number, frames = 3, filmT = 20) => {
    const s = R.shots[name];
    const e = s.ease !== false ? u * u * (3 - 2 * u) : u;
    const f = s.at(e, u * s.duration);
    simulate(filmT + u * s.duration);
    return place(f.pos, f.look, f.fov ?? 40, frames);
  };
  const view = (p: number[], l: number[], fov = 40, frames = 3) => place(new THREE.Vector3(...p), new THREE.Vector3(...l), fov, frames);
  const profile = (z: number, x0: number, x1: number, step: number) => { const o: number[] = []; for (let x = x0; x <= x1; x += step) o.push(Math.round(ground(x, z) * 10) / 10); return o; };
  const measure = () => { const ri = engine.renderer.info; ri.autoReset = false; ri.reset(); engine.render(1 / 30, 1 / 30); const r = { triangles: ri.render.triangles, calls: ri.render.calls }; ri.autoReset = true; return r; };
  w.__rachel = { engine, R, shot, view, profile, measure, pillar, THREE, simulate };
  w.__ready = true;
}
boot().catch((e) => { console.error(e); w.__error = String((e as Error)?.stack || e); });
