import * as THREE from 'three';
import { buildPenGunModel, buildM4Model, buildBigEraserModel } from './items.js';
import { WEAPON_DEFS } from './weapons.js';
import { groundHeight } from '../world/layout.js';

// Gear dropped by officers (pen-pistols, paint M4s, big school erasers): it tumbles to the
// ground and waits there, slowly turning, until you walk over it.

const BUILD = { pen: buildPenGunModel, m4: buildM4Model, bigEraser: buildBigEraserModel };
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(1, 1, 1);

export class Pickups {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  reset() {
    for (const it of this.list) this.game.scene.remove(it.model.group);
    this.list = [];
  }

  drop(id, x, y, z) {
    const build = BUILD[id];
    if (!build) return null;
    const model = build(this.game.mats);
    this.game.scene.add(model.group);
    const a = Math.random() * Math.PI * 2;
    const it = {
      id, model, t: 0,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(Math.cos(a) * 1.5, 3.2, Math.sin(a) * 1.5),
      yaw: Math.random() * 6, roll: 0, landed: false,
    };
    this.list.push(it);
    while (this.list.length > 10) this.remove(this.list[0]);
    return it;
  }

  remove(it) {
    this.game.scene.remove(it.model.group);
    const i = this.list.indexOf(it);
    if (i >= 0) this.list.splice(i, 1);
  }

  update(dt) {
    const game = this.game;
    const p = game.player;
    for (const it of this.list.slice()) {
      it.t += dt;
      const g = groundHeight(it.pos.x, it.pos.z);
      if (!it.landed) {
        it.vel.y -= 16 * dt;
        it.pos.addScaledVector(it.vel, dt);
        it.roll += dt * 9;
        if (it.pos.y <= g + 0.12) {
          it.pos.y = g + 0.12;
          it.landed = true;
          game.fx.crumbs(it.pos.x, it.pos.y, it.pos.z, 6, 1.4, true);
        }
      } else {
        it.yaw += dt * 1.2;
        it.pos.y = g + 0.22 + Math.sin(it.t * 3) * 0.06;
        it.roll *= Math.exp(-6 * dt);
      }
      _e.set(0.3 + it.roll, it.yaw, Math.PI / 2 * (it.landed ? 0 : 1), 'YXZ');
      _q.setFromEuler(_e);
      it.model.group.matrix.compose(it.pos, _q, _s);
      it.model.group.matrixWorldNeedsUpdate = true;
      // walk over it to take it
      if (it.landed && p.mode === 'foot' && Math.hypot(p.pos.x - it.pos.x, p.pos.z - it.pos.z) < 1.3) {
        this.take(it);
        continue;
      }
      if (it.t > 50) this.remove(it);
    }
  }

  take(it) {
    const game = this.game;
    const def = WEAPON_DEFS[it.id];
    this.game.scene.remove(it.model.group);
    const i = this.list.indexOf(it);
    if (i >= 0) this.list.splice(i, 1);
    it.model.group.matrix.identity();
    game.weapons.add(def, 'good', it.model, undefined);
    game.weapons.current.popAt = game.time;
    game.hud.updateWeapon();
    game.hud.toast(`הרמת ${def.name}!`, 'good', 2);
    game.audio.play('ding', 0.6);
  }

  // a scribbled ring on the ground so you can spot it
  draw(fr) {
    for (const it of this.list) {
      if (!it.landed) continue;
      const y = groundHeight(it.pos.x, it.pos.z) + 0.03;
      const r = 0.55 + Math.sin(it.t * 3) * 0.05;
      let px = it.pos.x + r;
      let pz = it.pos.z;
      for (let k = 1; k <= 10; k++) {
        const a = (k / 10) * Math.PI * 2 + it.t * 0.5;
        const nx = it.pos.x + Math.cos(a) * r;
        const nz = it.pos.z + Math.sin(a) * r;
        fr.lineXYZ(px, y, pz, nx, y, nz, [0.95, 0.75, 0.2], 2.4, k + it.t, 0.8, 0.03, 0);
        px = nx;
        pz = nz;
      }
    }
  }
}
