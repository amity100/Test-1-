import * as THREE from 'three';
import { makeSurface } from '../render/materials.js';
import { Kit, linC } from './items.js';
import { damp } from '../core/util.js';

// The parachute you drew from its board: jump out of the helicopter (or off anything high) and
// it opens over you - on its own when the fall gets fast, or at a press of the jump button - and
// you drift down over the city, steering, until your feet touch the street again.

const GORES = 10;
const LINE = [0.16, 0.14, 0.2];
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

// how a drawn parachute flies: how fast it sinks and how well it steers
const FLY = {
  perfect: { sink: 2.6, speed: 8.5 },
  good: { sink: 3.2, speed: 7.5 },
  wonky: { sink: 4.6, speed: 6 },
  fail: { sink: 6.5, speed: 4 },
};

let MAT = null;
function canopyMat() {
  if (!MAT) {
    MAT = makeSurface({ kind: 'paint', vcolor: true, gloss: 0.12, ang: 0.3, side: THREE.DoubleSide });
    MAT.userData.depth = null;
  }
  return MAT;
}

export function canopyModel(grade) {
  const K = new Kit();
  const cols = [linC(1.0, 0.5, 0.18), linC(0.98, 0.96, 0.9), linC(0.95, 0.3, 0.42), linC(0.98, 0.96, 0.9), linC(0.3, 0.55, 0.92)];
  const M = canopyMat();
  for (let k = 0; k < GORES; k++) {
    const g = new THREE.SphereGeometry(1, 4, 6, (k / GORES) * Math.PI * 2, (Math.PI * 2) / GORES, 0, Math.PI * 0.42);
    g.scale(3.4, 1.5, 2.7);
    K.add(M, g, cols[k % cols.length]);
  }
  const group = K.build({ seed: 0.57 });
  // a parachute drawn badly comes out lopsided
  if (grade === 'wonky' || grade === 'fail') group.children.forEach((m) => m.scale.set(1, grade === 'fail' ? 0.7 : 0.85, grade === 'fail' ? 0.75 : 0.9));
  group.matrixAutoUpdate = true;
  return group;
}

export class Parachute {
  constructor(game) {
    this.game = game;
    this.open = false;
    this.k = 0;
    this.group = null;
    this.grade = 'good';
    this.hem = [];
    for (let k = 0; k < GORES; k += 2) {
      const a = (k / GORES) * Math.PI * 2;
      // (the hem of the canopy, in its own frame)
      this.hem.push(new THREE.Vector3(Math.cos(a) * 3.4 * 0.97, 1.5 * Math.cos(Math.PI * 0.42), Math.sin(a) * 2.7 * 0.97));
    }
  }

  get fly() {
    return FLY[this.grade] || FLY.good;
  }

  deploy(grade) {
    if (this.open) return;
    const game = this.game;
    this.grade = grade || 'good';
    if (this.group) game.scene.remove(this.group);
    this.group = canopyModel(this.grade);
    game.scene.add(this.group);
    this.open = true;
    this.k = 0;
    game.audio.play('chute');
    game.hud.toast(game.touch ? 'המצנח נפתח! מנווטים עם הג׳ויסטיק' : 'המצנח נפתח! מנווטים עם WASD', 'good', 2.4);
  }

  // feet on the ground: the canopy sinks and folds away
  land() {
    if (!this.open) return;
    this.open = false;
    const p = this.game.player;
    this.game.fx.crumbs(p.pos.x, p.pos.y + 0.2, p.pos.z, 14, 2);
    p.fig.reachR = null;
    p.fig.reachL = null;
    this.fold = 1;
  }

  update(dt) {
    const g = this.group;
    if (!g) return;
    const p = this.game.player;
    // (into a vehicle, down, or dead: the canopy goes)
    if (this.open && (p.mode !== 'foot' || p.onGround)) this.land();
    if (this.open) {
      // it blooms open with a little overshoot
      this.k = Math.min(1, this.k + dt / 0.55);
      const t = this.k - 1;
      const s = 1 + 2.2 * t * t * t + 1.2 * t * t;
      const sp = Math.hypot(p.vel.x, p.vel.z);
      g.position.set(p.pos.x - p.vel.x * 0.05, p.pos.y + 3.3, p.pos.z - p.vel.z * 0.05);
      g.rotation.set(-Math.min(0.25, sp * 0.025), p.yaw, 0, 'YXZ');
      g.scale.setScalar(Math.max(0.15, s));
      // the hands hold the toggles over the shoulders
      const j = p.fig.j;
      p.fig.reachR = _a.copy(j.shoulderR).add(_b.set(0, 0.55, 0)).clone();
      p.fig.reachL = _a.copy(j.shoulderL).add(_b.set(0, 0.55, 0)).clone();
    } else {
      // folding away
      this.fold = Math.max(0, (this.fold || 0) - dt * 2.2);
      g.position.y = damp(g.position.y, p.pos.y + 0.4, 3, dt);
      g.scale.set(this.fold, this.fold * 0.4, this.fold);
      if (this.fold <= 0) {
        this.game.scene.remove(g);
        this.group = null;
      }
    }
  }

  // the lines from the hem to the harness
  draw(fr) {
    const g = this.group;
    if (!g || !this.open) return;
    g.updateMatrixWorld(true);
    const j = this.game.player.fig.j;
    this.hem.forEach((h, i) => {
      _a.copy(h).applyMatrix4(g.matrixWorld);
      const s = (h.x > 0) === true ? j.shoulderL : j.shoulderR;
      fr.lineXYZ(_a.x, _a.y, _a.z, s.x, s.y + 0.1, s.z, LINE, 1.4, 61 + i, 0.9, 0.004, 0);
    });
  }
}
