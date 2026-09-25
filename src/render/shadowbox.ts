import * as THREE from 'three';

const _m = /*@__PURE__*/ new THREE.Matrix4();
const _o = /*@__PURE__*/ new THREE.Vector3();
const _up = /*@__PURE__*/ new THREE.Vector3(0, 1, 0);

/**
 * Where the sun's shadow box goes, in the light's own frame.
 *
 * The sun's direction never changes within a world, so its shadow camera's
 * orientation is fixed: its right and up axes are built once. The box centre
 * is then moved only in whole shadow-map texels across the light (its depth
 * along the light is left as it is). Static edges then land on the same texels
 * from frame to frame: no crawl or shimmer of shadow edges while walking or
 * turning. (Lighting doesn't change: the light's direction is the same.)
 */
export class ShadowBox {
  /** The shadow camera's right, up and backward (toward the sun) axes. */
  readonly right = new THREE.Vector3(1, 0, 0);
  readonly up = new THREE.Vector3(0, 1, 0);
  readonly back = new THREE.Vector3(0, 0, 1);

  /** The sun's direction (toward the sun). Same basis as three's camera.lookAt from the sun to its target. */
  setSun(sunDir: THREE.Vector3): void {
    _m.lookAt(_o.copy(sunDir).normalize(), new THREE.Vector3(), _up);
    _m.extractBasis(this.right, this.up, this.back);
  }

  /**
   * The box centre nearest `at` whose light-space x and y are whole multiples of
   * `texel` (metres per shadow-map texel: box width / map size). Its component
   * along the light is `at`'s. Writes `out` (may be `at`).
   */
  place(at: THREE.Vector3, texel: number, out: THREE.Vector3): THREE.Vector3 {
    const x = at.dot(this.right), y = at.dot(this.up), z = at.dot(this.back);
    if (!(texel > 0)) return out.copy(at);
    const sx = Math.round(x / texel) * texel, sy = Math.round(y / texel) * texel;
    return out.copy(this.right).multiplyScalar(sx).addScaledVector(this.up, sy).addScaledVector(this.back, z);
  }
}
