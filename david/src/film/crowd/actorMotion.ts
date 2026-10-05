/*
 * Shared motion helpers of the film's full-actor soldiers (host1): the P6 Philistine vanguard (HostVanguard) and, from
 * wave 6, the Israelite heroes of Gilgal (ArmyHeroes) — a damped angular spring (a carried spear's lag, a shield's
 * swing) and the FOOT LOCK on the capture's contact flags. Pure functions of the bones: no allocation per frame.
 */
import * as THREE from 'three';

/** a damped 2-D angular spring (forward, sideways) */
export class Swing {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  constructor(public k: number, public c: number) {}
  step(dt: number, x0: number, y0: number, ax: number, ay: number) {
    // semi-implicit Euler in small substeps (stiff spring, frame dt up to 1/20)
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.vx += (-this.k * (this.x - x0) - this.c * this.vx + ax) * h;
      this.vy += (-this.k * (this.y - y0) - this.c * this.vy + ay) * h;
      this.x += this.vx * h;
      this.y += this.vy * h;
    }
  }
  reset(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = this.vy = 0;
  }
}

/**
 * FOOT LOCK — the capture's contact flags (heel / ball per foot, tools/mocap) pin the foot to the plain while it bears
 * weight: on heel strike the ankle's ground point is recorded and held (the leg solved back onto it by two-bone IK, the
 * knee in its own bend plane, the foot's orientation kept); when the heel lifts and the ball still bears, the ball is
 * held instead (the ankle rises and rolls over it); on lift-off the correction eases out in ~0.12 s. The in-place take
 * time-warped to the ground speed leaves ~10-20 cm/s of residual drift at the ankle (measured on the bench); this takes
 * it to the capture's own roll.
 */
export class FootLock {
  private mode: 0 | 1 | 2 = 0; // free / heel / ball
  private readonly lock = new THREE.Vector3();
  /** the correction applied last frame (world), eased out after lift-off */
  private readonly off = new THREE.Vector3();
  constructor(private readonly heelBit: number, private readonly ballBit: number) {}
  reset() {
    this.mode = 0;
    this.off.set(0, 0, 0);
  }
  apply(contacts: number, thigh: THREE.Object3D, shin: THREE.Object3D, foot: THREE.Object3D, toe: THREE.Object3D | undefined, dt: number) {
    const heel = (contacts & this.heelBit) !== 0, ball = (contacts & this.ballBit) !== 0;
    foot.getWorldPosition(_fa);
    if (toe) toe.getWorldPosition(_ft);
    const want = heel ? 1 : ball && toe ? 2 : 0;
    if (want !== this.mode) {
      // a new phase: hold the point where it is NOW (with last frame's correction, so nothing jumps)
      if (want === 1) this.lock.copy(_fa).add(this.off);
      else if (want === 2) this.lock.copy(toe ? _ft : _fa).add(this.off);
      this.mode = want;
    }
    if (this.mode === 0) {
      this.off.multiplyScalar(Math.exp(-dt / 0.05));
    } else {
      // horizontal correction only (the height is the foot IK's); never more than 15 cm (a bad contact flag)
      _fd.copy(this.lock).sub(this.mode === 1 ? _fa : _ft).setY(0);
      if (_fd.lengthSq() > 0.15 * 0.15) {
        this.mode = 0;
        this.off.multiplyScalar(Math.exp(-dt / 0.05));
      } else this.off.copy(_fd);
    }
    if (this.off.lengthSq() < 1e-8) return;
    // two-bone IK: the ankle to (ankle + off), the knee in its current plane, the foot's world orientation kept
    foot.getWorldQuaternion(_fq);
    thigh.getWorldPosition(_fh);
    shin.getWorldPosition(_fk);
    _ftg.copy(_fa).add(this.off);
    const la = _fh.distanceTo(_fk), lb = _fk.distanceTo(_fa);
    _fd.copy(_ftg).sub(_fh);
    const d = THREE.MathUtils.clamp(_fd.length(), Math.abs(la - lb) + 1e-4, la + lb - 1e-4);
    _fd.normalize();
    // bend plane: the current knee's offset from the hip-ankle line
    _fp.copy(_fk).sub(_fh);
    _fp.addScaledVector(_fd, -_fp.dot(_fd));
    if (_fp.lengthSq() < 1e-8) return;
    _fp.normalize();
    const x = (la * la - lb * lb + d * d) / (2 * d);
    const y = Math.sqrt(Math.max(0, la * la - x * x));
    _fk2.copy(_fh).addScaledVector(_fd, x).addScaledVector(_fp, y);
    rotWorld(thigh, _fq2.setFromUnitVectors(_fv.copy(_fk).sub(_fh).normalize(), _fv2.copy(_fk2).sub(_fh).normalize()));
    shin.getWorldPosition(_fk);
    foot.getWorldPosition(_fa);
    rotWorld(shin, _fq2.setFromUnitVectors(_fv.copy(_fa).sub(_fk).normalize(), _fv2.copy(_ftg).sub(_fk).normalize()));
    setWorldQuat(foot, _fq);
  }
}

const _fa = new THREE.Vector3(), _ft = new THREE.Vector3(), _fd = new THREE.Vector3(), _fh = new THREE.Vector3(), _fk = new THREE.Vector3();
const _fk2 = new THREE.Vector3(), _ftg = new THREE.Vector3(), _fp = new THREE.Vector3(), _fv = new THREE.Vector3(), _fv2 = new THREE.Vector3();
const _fq = new THREE.Quaternion(), _fq2 = new THREE.Quaternion(), _rwP = new THREE.Quaternion(), _rwW = new THREE.Quaternion();
/** apply a world-space rotation to a bone (children follow) */
function rotWorld(bone: THREE.Object3D, dq: THREE.Quaternion) {
  bone.updateWorldMatrix(true, false);
  bone.getWorldQuaternion(_rwW);
  bone.parent!.getWorldQuaternion(_rwP);
  _rwW.premultiply(dq);
  bone.quaternion.copy(_rwP.invert().multiply(_rwW));
  bone.updateMatrixWorld(true);
}
function setWorldQuat(bone: THREE.Object3D, qw: THREE.Quaternion) {
  bone.parent!.updateWorldMatrix(true, false);
  bone.parent!.getWorldQuaternion(_rwP);
  bone.quaternion.copy(_rwP.invert().multiply(qw));
  bone.updateMatrixWorld(true);
}

