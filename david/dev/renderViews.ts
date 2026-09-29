// Dev-only harness: the real Engine (Bethlehem world) + Saul's house at Gibeah through ONE post chain.
// Checks engine.setView / restoreWorldView / crossfade / resetTemporal / precompileView, letterbox, film look,
// depth of field, and that no cut shows a black / unlit / half-initialised frame (watchdog on every frame).
//
// /dev/renderViews.html?q=high|desktop-high|mobile-high|...   window.__v: world(i), palace(name, u), frames(n, dt),
//   toPalace(fade, through), toWorld(fade, through), cut(fade), letterbox(r, s), film(a, s), dof(s), stats()
import * as THREE from 'three';
import { Engine, type BenchView } from '../src/core/Engine';
import { FrameWatchdog } from '../src/fx/Watchdog';
import { palaceView } from '../src/fx/views';
import { PalaceSet } from '../src/palace/PalaceSet';
import { LAYOUT } from '../src/world/Layout';

const win = window as unknown as Record<string, unknown>;
const app = document.getElementById('app')!;
const log = (s: string) => console.log('[views] ' + s);

async function main() {
  const t0 = performance.now();
  const engine = new Engine(app);
  win.__engine = engine;
  await engine.build(() => {});
  log(`world built ${(performance.now() - t0).toFixed(0)} ms, tier ${engine.quality.tier}`);
  const ground = (x: number, z: number) => engine.terrain.heightAt(x, z);
  const px = LAYOUT.start.x, pz = LAYOUT.start.z;
  const worldPoses: BenchView[] = [
    { pos: new THREE.Vector3(px - 3, ground(px - 3, pz - 5) + 2.2, pz - 5), look: new THREE.Vector3(LAYOUT.pasture.x, ground(LAYOUT.pasture.x, LAYOUT.pasture.z) + 1, LAYOUT.pasture.z) },
    { pos: new THREE.Vector3(px + 6, ground(px + 6, pz + 3) + 1.7, pz + 3), look: new THREE.Vector3(px - 60, ground(px - 60, pz - 40) + 12, pz - 40) },
  ];
  engine.setFov(42);
  await engine.warmup({ bench: false, precompile: true, views: worldPoses });
  const t1 = performance.now();
  const palace = await PalaceSet.create({ renderer: engine.renderer, quality: engine.quality, tex: engine.tex });
  engine.enforceTextureBudget(palace.scene);
  const gib = palaceView(palace);
  const shotPose = (s: { at: (u: number, t: number) => { pos: THREE.Vector3; look: THREE.Vector3; fov?: number } }, u: number) => {
    const f = s.at(u, u * 5);
    return { pos: f.pos.clone(), look: f.look.clone(), fov: f.fov };
  };
  const P = palace.shots;
  const palacePoses = [shotPose(P.establishingExterior, 0.8), shotPose(P.enterHall, 0.9), shotPose(P.throneReveal, 0.7)];
  await engine.precompileView(gib, palacePoses);
  log(`palace created + precompiled ${(performance.now() - t1).toFixed(0)} ms`);
  const cam = engine.camera;
  const watchdog = new FrameWatchdog(engine.renderer, 1);
  let frameNo = 0;
  const frames = (n: number, dt = 1 / 30) => {
    const ts = performance.now();
    for (let i = 0; i < n; i++) {
      engine.render(dt, dt);
      frameNo++;
      if (watchdog.afterFrame()) log('watchdog ' + JSON.stringify(watchdog.events[watchdog.events.length - 1]));
    }
    return { ms: Math.round(performance.now() - ts), mean: +watchdog.lastMean.toFixed(1), dark: +watchdog.lastDark.toFixed(3), black: watchdog.black, blotches: watchdog.blotches };
  };
  const place = (pos: THREE.Vector3, look: THREE.Vector3, fov?: number) => {
    cam.position.copy(pos);
    cam.lookAt(look);
    if (fov) engine.setFov(fov);
    cam.updateMatrixWorld();
    engine.focus.copy(look);
  };
  const palaceShot = (name: string, u: number) => {
    const s = name.startsWith('insert') ? P.detailInserts[+name.slice(6)] : (P as unknown as Record<string, typeof P.enterHall>)[name];
    const p = shotPose(s, u);
    place(p.pos, p.look, p.fov ?? 40);
  };
  win.__v = {
    engine, set: palace, watchdog,
    world: (i: number) => { const p = worldPoses[i]; place(p.pos, p.look, 42); },
    palace: palaceShot,
    frames,
    toPalace: (fade = 0, through?: number) => engine.setView(gib, { crossfade: fade, through }),
    toWorld: (fade = 0, through?: number) => engine.restoreWorldView({ crossfade: fade, through }),
    cut: (fade = 0) => engine.resetTemporal({ crossfade: fade }),
    letterbox: (r: number | null, s = 1.2) => engine.post.setLetterbox(r, s),
    film: (a: number, s = 1) => engine.post.setFilmLook(a, s),
    dof: (s: Record<string, unknown>) => engine.post.setDoF(s),
    exposure: () => engine.renderer.toneMappingExposure,
    /** render one more frame and read it back in the same task (the canvas has no preserveDrawingBuffer) */
    snap: () => {
      frames(1);
      return engine.renderer.domElement.toDataURL('image/png');
    },
    stats: () => {
      const info = engine.renderer.info;
      return { tier: engine.quality.tier, taa: engine.post.taaEnabled, dof: engine.post.dofAvailable, view: engine.view ? 'palace' : 'world', exposure: +engine.renderer.toneMappingExposure.toFixed(3), near: cam.near, calls: info.render.calls, bars: +engine.post.letterboxBars.toFixed(3), fading: engine.post.fading, mem: engine.memoryReport() };
    },
  };
  win.__ready = true;
}

main().catch((e) => {
  console.error(e);
  win.__error = String((e as Error)?.stack || e);
});
