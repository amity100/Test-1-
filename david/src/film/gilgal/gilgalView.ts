import type * as THREE from 'three';
import type { ViewSpec } from '../../core/Engine';
import type { GilgalSet } from './GilgalSet';

/**
 * ViewSpec for the Gilgal set, ready for `engine.setView(...)` (same pattern as palaceView in src/fx/views.ts):
 *
 *   const { GilgalSet } = await import('./film/gilgal/GilgalSet');          // lazy: film-only content
 *   const gilgal = await GilgalSet.create({ renderer: engine.renderer, quality: engine.quality, tex: engine.tex });
 *   engine.enforceTextureBudget(gilgal.scene);
 *   const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 90000);
 *   const view = gilgalView(gilgal, { camera: cam });
 *   await engine.precompileView(view, poses);                            // poses from gilgal.shots.list[i].shot.at(u, t)
 *   engine.setView(view, { crossfade: 0 });                              // hard cut on the shofar blast (shot 6)
 *   each frame: gilgal.setBeat(name, shotTime); set cam from the shot; engine.render(dt, gdt)
 *   engine.resetTemporal() on every cut; engine.restoreWorldView(...) after shot 13; gilgal.dispose().
 *
 * Only a type import of the set: this module does not pull the Gilgal code into bundles that don't use it.
 */
export function gilgalView(set: GilgalSet, opts: { camera?: THREE.PerspectiveCamera; near?: number; far?: number } = {}): ViewSpec {
  return {
    scene: set.scene,
    camera: opts.camera,
    sky: set.sky,
    exposure: () => set.exposure,
    update: (dt, cam) => set.update(dt, cam),
    configurePost: (post) => set.configurePost(post),
    near: opts.near ?? 0.05,
    far: opts.far ?? 90000,
    onLeave: () => set.leave(),
  };
}
