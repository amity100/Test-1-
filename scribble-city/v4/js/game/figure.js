import * as THREE from 'three';
import { LineBatch } from '../render/LineBatch.js';
import { makeLineMaterial } from '../render/materials.js';
import { PersonRenderer } from '../render/people.js';

/**
 * Everything that moves and is drawn anew every frame: the people (render/people.js) and the pen
 * lines in the air (what people draw, sparks, trails).
 */
export class FigureRenderer {
  constructor(scene) {
    this.scene = scene;
    this.mat = makeLineMaterial({ nudge: 0.0012, minWidth: 1.0 });
    this.batch = new LineBatch(9000, this.mat, { dynamic: true });
    this.batch.mesh.renderOrder = 15;
    this.batch.mesh.userData.dynamic = true;
    scene.add(this.batch.mesh);
    this.bodies = new PersonRenderer(scene);
    this.camPos = new THREE.Vector3();
  }

  begin(camera) {
    this.batch.clear();
    this.bodies.begin();
    this.camPos.copy(camera.position);
  }

  line(a, b, color, width, seed, alpha = 1, wobble = 0.02) {
    this.batch.push(a.x, a.y, a.z, b.x, b.y, b.z, color[0], color[1], color[2], alpha, width, seed, 0.03, wobble);
  }

  lineXYZ(ax, ay, az, bx, by, bz, color, width, seed, alpha = 1, wobble = 0.02, overshoot = 0.03) {
    this.batch.push(ax, ay, az, bx, by, bz, color[0], color[1], color[2], alpha, width, seed, overshoot, wobble);
  }

  end() {
    this.batch.commit();
    this.bodies.end();
  }

  // (every person casts a real shadow in the evening sun)
  shadow() {}
}
