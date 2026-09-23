import * as THREE from 'three';

/**
 * A rift surface. Local frame: +Z is the front normal (the side you walk out
 * of), +Y is the portal's "up", X is its width axis.
 */
export interface RiftFrame {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  width: number;
  height: number;
}

const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _ca = new THREE.Vector3();
const _cb = new THREE.Vector3();

export function frameNormal(f: RiftFrame, out = new THREE.Vector3()) {
  return out.set(0, 0, 1).applyQuaternion(f.quaternion);
}

export function frameUp(f: RiftFrame, out = new THREE.Vector3()) {
  return out.set(0, 1, 0).applyQuaternion(f.quaternion);
}

/** Quaternion that carries orientation through `from` into `to`. */
export function passRotation(from: RiftFrame, to: RiftFrame, out = new THREE.Quaternion()) {
  _q.copy(from.quaternion).invert();
  return out.copy(to.quaternion).multiply(FLIP).multiply(_q);
}

export function passPoint(from: RiftFrame, to: RiftFrame, p: THREE.Vector3, out = new THREE.Vector3()) {
  _v.subVectors(p, from.position);
  _q.copy(from.quaternion).invert();
  _v.applyQuaternion(_q);
  _v.x = -_v.x;
  _v.z = -_v.z;
  return out.copy(_v).applyQuaternion(to.quaternion).add(to.position);
}

export function passDirection(from: RiftFrame, to: RiftFrame, d: THREE.Vector3, out = new THREE.Vector3()) {
  _q.copy(from.quaternion).invert();
  out.copy(d).applyQuaternion(_q);
  out.x = -out.x;
  out.z = -out.z;
  return out.applyQuaternion(to.quaternion);
}

/** Portal-local coordinates of a world point. */
export function toLocal(f: RiftFrame, p: THREE.Vector3, out = new THREE.Vector3()) {
  _q.copy(f.quaternion).invert();
  return out.subVectors(p, f.position).applyQuaternion(_q);
}

/**
 * Detects a crossing of the front face going backwards between two samples.
 * Returns the fraction along the segment where the crossing happened, or -1.
 */
export function crossing(f: RiftFrame, prev: THREE.Vector3, cur: THREE.Vector3, margin = 0): number {
  const a = toLocal(f, prev, _ca);
  const b = toLocal(f, cur, _cb);
  if (!(a.z > 0 && b.z <= 0)) return -1;
  const t = a.z / (a.z - b.z);
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  if (Math.abs(x) > f.width / 2 + margin) return -1;
  if (Math.abs(y) > f.height / 2 + margin) return -1;
  return t;
}

/** Build a frame whose front faces `normal`, with `up` as close as possible to `upHint`. */
export function orientFrame(normal: THREE.Vector3, upHint: THREE.Vector3, out = new THREE.Quaternion()) {
  const z = normal.clone().normalize();
  let x = new THREE.Vector3().crossVectors(upHint, z);
  if (x.lengthSq() < 1e-6) x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), z);
  if (x.lengthSq() < 1e-6) x = new THREE.Vector3(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  return out.setFromRotationMatrix(m);
}

/** Yaw (rotation about +Y, 0 = facing +Z) of a direction's horizontal part. */
export function yawOf(dir: THREE.Vector3) {
  return Math.atan2(dir.x, dir.z);
}
