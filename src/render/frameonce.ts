import * as THREE from 'three';

/**
 * Work three does in every render() call that only needs doing once per frame. A frame renders the scene
 * once for the main view and once more for each rift window's view; three recomputes every skeleton's
 * bone matrices (and re-uploads its bone texture) in each of those calls, although nothing moves between
 * them. (The scene graph's matrices: the game turns off `scene.matrixWorldAutoUpdate` and updates them
 * itself, once, before the frame's first render.)
 */
let frame = 0;

/** A frame's renders begin: each skeleton's bones are recomputed at most once from here on. */
export function beginRenderFrame() {
  frame++;
}

/** The frame count beginRenderFrame() has reached (tests). */
export function renderFrame() {
  return frame;
}

type Stamped = THREE.Skeleton & { renderFrame?: number };
const update = THREE.Skeleton.prototype.update;
THREE.Skeleton.prototype.update = function (this: Stamped) {
  if (this.renderFrame === frame) return;
  this.renderFrame = frame;
  update.call(this);
};
