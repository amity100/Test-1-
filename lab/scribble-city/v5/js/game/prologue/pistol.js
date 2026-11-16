import * as THREE from 'three';
import { Kit, itemMats, linC } from '../items.js';
import { GUN_GRIP } from '../../render/heroshapes.js';

// (ROADMAP 23.18) A pistol in a man's hand - a thing in the scene, made as the city's things are (game/items.js Kit), not three pen
// lines drawn from his wrist: a dark slide over its frame, the grip raked back in his fist, the guard and the trigger, the sights,
// a hammer. A little bigger than life, as a film's prop is: read across a car park.
//
// Its own frame: the middle of the grip at the origin (the hollow of the fist that holds it), +z the muzzle's way, +y up.

const _h = new THREE.Vector3();
const _g = new THREE.Vector3();
const _x = new THREE.Vector3();
const _z = new THREE.Vector3();
const _e = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
// (how much bigger than life)
const BIG = 1.14;
// (the muzzle, and the top of the slide over the hand, in its own frame)
const MUZZLE = [0, 0.052, 0.124];

export class HeldPistol {
  constructor(game) {
    this.game = game;
    const M = itemMats();
    const K = new Kit();
    const steel = linC(0.085, 0.088, 0.105);
    const frame = linC(0.06, 0.06, 0.072);
    const wood = linC(0.2, 0.115, 0.07);
    const bright = linC(0.42, 0.44, 0.5);
    // the slide, the frame under it
    K.box(M.metal, -0.014, 0.036, -0.078, 0.014, 0.068, 0.116, steel);
    K.box(M.matte, -0.0125, 0.012, -0.062, 0.0125, 0.037, 0.1, frame);
    // (the light along the slide's top, its port on the right - a body's right is -x: up x ahead is its left)
    K.box(M.metal, -0.005, 0.068, -0.05, 0.005, 0.0688, 0.09, bright);
    K.box(M.metal, -0.0146, 0.049, 0.0, -0.0139, 0.062, 0.042, bright);
    // the barrel's mouth
    K.cyl(M.metal, 0.0068, 0.0068, 0.114, 0.124, linC(0.3, 0.3, 0.34), { y: 0.052, segs: 8 });
    K.cyl(M.matte, 0.0042, 0.0042, 0.1235, 0.1245, linC(0.01, 0.01, 0.012), { y: 0.052, segs: 8 });
    // the grip: raked back, its panels a little proud of it
    const grip = new THREE.BoxGeometry(0.026, 0.108, 0.044);
    grip.rotateX(0.22);
    grip.translate(0, -0.038, -0.022);
    K.add(M.matte, grip, frame);
    const panel = new THREE.BoxGeometry(0.031, 0.074, 0.03);
    panel.rotateX(0.22);
    panel.translate(0, -0.036, -0.022);
    K.add(M.matte, panel, wood);
    // the guard and the trigger
    K.torus(M.matte, 0.017, 0.0032, 0, -0.003, 0.034, frame, 0, Math.PI / 2);
    K.box(M.metal, -0.003, -0.014, 0.027, 0.003, 0.008, 0.033, bright);
    // the sights, the hammer
    K.box(M.matte, -0.002, 0.068, 0.1, 0.002, 0.075, 0.109, frame);
    K.box(M.matte, -0.009, 0.068, -0.07, 0.009, 0.075, -0.061, frame);
    K.box(M.matte, -0.004, 0.044, -0.089, 0.004, 0.066, -0.077, frame);
    this.grp = K.build({ seed: 0.37 });
    this.grp.matrixAutoUpdate = false;
    this.grp.visible = false;
    game.scene.add(this.grp);
    // (where its muzzle is, and which way it points, in the world: for the flash, the shot)
    this.muzzle = new THREE.Vector3();
    this.dir = new THREE.Vector3(0, 0, 1);
    // (the fist's way round it: render/people.js fig.grip - up the grip)
    this.grip = new THREE.Vector3(0, 1, 0);
  }

  // every frame, after the figure is posed: in his right fist, pointing where he aims (aim: a unit vector) - his fist shut
  // round its grip (fig.grip; fig.gripGun, a fist the grip's own size - render/people.js heroGunR), the gun where the fist's
  // hollow is: 0.07 down the hand from the wrist, out from the palm by its skin and the grip's round (render/heroshapes.js)
  place(fig, aim) {
    const j = fig && fig.j;
    if (!j || !j.handR || j.handR.lengthSq() === 0) {
      this.grp.visible = false;
      return false;
    }
    const S = fig.scale || 1;
    const hk = S * (fig._handK || 0.862);
    // (up the grip: straight up from the barrel)
    _z.copy(aim).normalize();
    _g.copy(UP).addScaledVector(_z, -UP.dot(_z));
    if (_g.lengthSq() < 1e-6) _g.set(1, 0, 0);
    _g.normalize();
    this.grip.copy(_g);
    fig.grip = this.grip;
    fig.gripGun = true;
    // (the hand's way: along his forearm, square to the grip)
    _h.subVectors(j.handR, j.elbowR);
    _h.addScaledVector(_g, -_h.dot(_g));
    if (_h.lengthSq() < 1e-8) _h.copy(_z);
    _h.normalize();
    _n.crossVectors(_g, _h);
    _e.copy(j.handR).addScaledVector(_h, 0.07 * hk).addScaledVector(_n, (0.012 + GUN_GRIP) * hk);
    _x.crossVectors(_g, _z).normalize();
    const k = BIG * S;
    _m.makeBasis(_x, _g, _z);
    _m.scale(_n.set(k, k, k));
    _m.setPosition(_e);
    this.grp.matrix.copy(_m);
    this.grp.matrixWorldNeedsUpdate = true;
    this.grp.visible = true;
    this.dir.copy(_z);
    this.muzzle.copy(_e).addScaledVector(_g, MUZZLE[1] * k).addScaledVector(_z, MUZZLE[2] * k);
    return true;
  }

  hide(fig) {
    this.grp.visible = false;
    if (fig && fig.grip === this.grip) fig.grip = null;
    if (fig) fig.gripGun = false;
  }

  dispose() {
    this.grp.visible = false;
    if (this.grp.parent) this.grp.parent.remove(this.grp);
  }
}
