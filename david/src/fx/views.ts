import type * as THREE from 'three';
import type { ViewSpec } from '../core/Engine';
import type { PalaceSet } from '../palace/PalaceSet';

/**
 * ViewSpec for Saul's house at Gibeah (src/palace), ready for `engine.setView(...)`:
 *
 *   const palace = await PalaceSet.create({ renderer: engine.renderer, quality: engine.quality, tex: engine.tex });
 *   engine.enforceTextureBudget(palace.scene);
 *   const gibeah = palaceView(palace);
 *   await engine.precompileView(gibeah, [{ pos, look }, ...]);   // behind the loading screen
 *   ...
 *   engine.setView(gibeah, { crossfade: 1.2 });                   // Bethlehem -> Gibeah dissolve
 *   engine.resetTemporal();                                       // every camera cut inside the palace
 *   engine.restoreWorldView({ crossfade: 1.2 });                  // back to David's fields
 *
 * The set's own per-frame update runs through the view (flames, lamp flicker, interior exposure blend, sun shadow
 * framing, sky dome); its exposure is read every frame; its haze / god-ray settings come from configurePost; the
 * near plane is 0.08 m for the detail inserts; leaving the view puts the game's sun back into the shared uniforms.
 * Only a type import: this module does not pull the palace code into bundles that don't use it.
 */
export function palaceView(palace: PalaceSet, opts: { camera?: THREE.PerspectiveCamera; near?: number } = {}): ViewSpec {
  return {
    scene: palace.scene,
    camera: opts.camera,
    sky: palace.sky,
    exposure: () => palace.exposure,
    update: (dt, cam) => palace.update(dt, cam),
    configurePost: (post) => palace.configurePost(post),
    near: opts.near ?? 0.08,
    onLeave: () => palace.restoreSharedSun(),
  };
}
