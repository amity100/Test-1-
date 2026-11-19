import * as THREE from 'three';
import { makeSurface } from '../render/materials.js';
import { Kit, linC } from './items.js';
import { damp } from '../core/util.js';

import { tr } from '../core/lang.js';
// The parachute you drew from its board: jump out of the helicopter (or off anything high) and
// it opens over you - on its own when the fall gets fast, or at a press of the jump button - and
// you drift down over the city, steering, until your feet touch the street again.

const GORES = 10;
const LINE = [0.16, 0.14, 0.2];
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

// how a drawn parachute flies: how fast it sinks and how well it steers
// (ROADMAP 28.3: a paraglider now - it sinks slowly and goes a long way; a badly drawn one still drops)
const FLY = {
  perfect: { sink: 1.5, speed: 12 },
  good: { sink: 2.0, speed: 10.5 },
  wonky: { sink: 3.8, speed: 7 },
  fail: { sink: 6.2, speed: 4.5 },
};

// (ROADMAP 28.3) the Driftfan's motor: a cage with a propeller in it, on your back
function fanModel() {
  const K = new Kit();
  const M = canopyMat();
  const dark = linC(0.16, 0.16, 0.2);
  K.torus(M, 0.42, 0.02, 0, 0, 0, dark, 0, 0);
  K.torus(M, 0.3, 0.012, 0, 0, 0, dark, 0, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    K.box(M, Math.cos(a) * 0.06 - 0.008, Math.sin(a) * 0.06 - 0.008, -0.01, Math.cos(a) * 0.42 + 0.008, Math.sin(a) * 0.42 + 0.008, 0.01, dark);
  }
  K.box(M, -0.09, -0.12, 0.02, 0.09, 0.12, 0.16, linC(0.86, 0.3, 0.2));
  const cage = K.build({ seed: 0.31 });
  cage.matrixAutoUpdate = true;
  const P = new Kit();
  P.box(M, -0.36, -0.035, -0.012, 0.36, 0.035, 0.012, linC(0.9, 0.82, 0.55));
  const prop = P.build({ seed: 0.32 });
  prop.matrixAutoUpdate = true;
  prop.position.z = -0.03;
  cage.add(prop);
  cage.userData.prop = prop;
  return cage;
}

let MAT = null;
function canopyMat() {
  if (!MAT) {
    MAT = makeSurface({ kind: 'paint', vcolor: true, gloss: 0.12, ang: 0.3, side: THREE.DoubleSide });
    MAT.userData.depth = null;
  }
  return MAT;
}

// (ROADMAP 11.8: one drawn freehand, in the colours it was drawn in - between white gores)
export function canopyModel(grade, colours = null) {
  const K = new Kit();
  const own = colours && colours.length ? colours.slice(0, 3).map((c) => linC(...c)) : null;
  const cols = own ? own.flatMap((c) => [c, linC(0.98, 0.96, 0.9)]) : [linC(1.0, 0.5, 0.18), linC(0.98, 0.96, 0.9), linC(0.95, 0.3, 0.42), linC(0.98, 0.96, 0.9), linC(0.3, 0.55, 0.92)];
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

  // (powered, ROADMAP 28.3: the Driftfan - the jump button held climbs)
  deploy(grade, colours = null, powered = false) {
    if (this.open) return;
    const game = this.game;
    this.grade = grade || 'good';
    this.powered = !!powered;
    if (this.fan) game.scene.remove(this.fan);
    this.fan = this.powered ? fanModel() : null;
    if (this.fan) game.scene.add(this.fan);
    if (this.group) game.scene.remove(this.group);
    this.group = canopyModel(this.grade, colours);
    game.scene.add(this.group);
    this.open = true;
    this.k = 0;
    game.audio.play('chute');
    game.hud.toast(this.powered ? (game.touch ? tr('המנוע עובד! ג׳ויסטיק לניווט, כפתור הקפיצה מוחזק — לטפס', 'The motor is running! Joystick to steer, hold the jump button to climb') : tr('המנוע עובד! WASD לניווט, רווח מוחזק — לטפס', 'The motor is running! WASD to steer, hold Space to climb')) : game.touch ? tr('המצנח נפתח! מנווטים עם הג׳ויסטיק', 'The parachute opened! Steer with the joystick') : tr('המצנח נפתח! מנווטים עם WASD', 'The parachute opened! Steer with WASD'), 'good', 2.4);
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
    if (this.fan) {
      this.game.scene.remove(this.fan);
      this.fan = null;
    }
    this.thrust = false;
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
      if (this.fan) {
        const f = this.fan;
        f.position.set(p.pos.x - Math.sin(p.yaw) * 0.32, p.pos.y + 1.12, p.pos.z - Math.cos(p.yaw) * 0.32);
        f.rotation.set(0, p.yaw, 0);
        f.userData.prop.rotation.z += dt * (this.thrust ? 46 : 16);
      }
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
