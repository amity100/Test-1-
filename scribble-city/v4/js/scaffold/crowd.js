import * as THREE from 'three';
import { FigureRenderer } from '../game/figure.js';
import { Doodle } from '../game/doodle.js';
import { heroLook, civilianLook, gangLook, copLook, swatLook, kidLook, elderLook, shopkeeperLook, friendLook } from '../game/looks.js';

// a test crowd: every kind of person, walking up and down the first boulevard's sidewalk
export class Crowd {
  constructor(scene) {
    this.fr = new FigureRenderer(scene);
    this.people = [];
    const looks = [heroLook(), civilianLook({ fem: true }), civilianLook(), gangLook('street'), gangLook('mob'), copLook(), swatLook(), kidLook(), elderLook(true), elderLook(false), shopkeeperLook('pizza'), friendLook(), civilianLook({ fem: true }), gangLook('biker'), civilianLook()];
    looks.forEach((L, i) => {
      const f = new Doodle(this.fr, L, { seed: i * 3.3 });
      f.pos.set(-7.5 + (i % 3) * 1.6, 0.15, 6 - Math.floor(i / 3) * 2.2);
      f.yaw = Math.PI;
      f.speed = i % 4 === 0 ? 0 : 1.3;
      if (i === 8) f.carry = 'cane';
      if (i === 1) f.carry = 'coffee';
      if (i === 12) f.carry = 'umbrella';
      if (i === 4) f.aim = 1;
      this.people.push(f);
    });
  }

  update(dt, camera) {
    this.fr.begin(camera);
    for (const f of this.people) {
      f.update(dt);
      f.draw(camera.position);
    }
    this.fr.end();
  }
}
