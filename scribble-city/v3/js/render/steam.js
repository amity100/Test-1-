import { LineBatch } from './LineBatch.js';
import { AVES, STREETS } from '../world/layout.js';

// Curls of steam rising from the manholes, drawn as a few loose pencil loops.
export class Steam {
  constructor(scene, material) {
    this.vents = [];
    let k = 0;
    for (const x of AVES) {
      for (const z of STREETS) {
        k++;
        if (k % 3 === 2) continue; // two crossings in three
        this.vents.push({ x: x + 2.5, z: z + 1.8, ph: k * 1.37 });
      }
    }
    this.batch = new LineBatch(this.vents.length * 4 * 9 + 8, material, { dynamic: true });
    scene.add(this.batch.mesh);
    this.time = 0;
  }

  set visible(v) {
    this.batch.mesh.visible = v;
  }

  update(dt, camPos) {
    if (!this.batch.mesh.visible) return;
    this.time += dt;
    const b = this.batch;
    b.clear();
    for (const v of this.vents) {
      if (Math.abs(v.x - camPos.x) > 160 || Math.abs(v.z - camPos.z) > 160) continue;
      for (let s = 0; s < 4; s++) {
        // each puff rises for 4 s, curling and fading
        const life = ((this.time * 0.25 + s * 0.25 + v.ph * 0.13) % 1 + 1) % 1;
        const y0 = 0.2 + life * 3.6;
        const fade = Math.sin(Math.min(1, life * 1.4) * Math.PI) * 0.55;
        const rad = 0.18 + life * 0.75;
        const ph = v.ph + s * 1.9;
        let px = v.x;
        let py = y0;
        let pz = v.z;
        for (let i = 1; i <= 9; i++) {
          const t = i / 9;
          const a = ph + t * 5.2 + this.time * 0.6;
          const x = v.x + Math.cos(a) * rad * (0.6 + t * 0.5) + life * 0.6;
          const y = y0 + t * 1.1;
          const z = v.z + Math.sin(a) * rad * 0.6;
          b.push(px, py, pz, x, y, z, 0.32, 0.36, 0.5, fade * (1 - t * 0.5), 1.7, ph + i, 0.02, 0.03);
          px = x;
          py = y;
          pz = z;
        }
      }
    }
    b.commit();
  }
}
