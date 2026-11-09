import * as THREE from 'three';
import { makeSpriteMaterial, getSpriteGeometry, makeLineMaterial, shared } from './materials.js';
import { LineBatch } from './LineBatch.js';
import { RNG } from '../core/util.js';

// Sky doodles living "at infinity": a few pen-drawn clouds and birds.
export class Sky {
  constructor(scene, atlas) {
    this.atlas = atlas;
    const geo = getSpriteGeometry();
    const mk = (rect, w, h) => {
      const m = makeSpriteMaterial(atlas.texture, { noFog: true, transparent: true });
      m.uniforms.uRect.value.set(...atlas.rects[rect]);
      m.uniforms.uSize.value.set(w, h);
      m.uniforms.uPivot.value.set(0.5, 0.5);
      m.uniforms.uMode.value = 1;
      m.depthWrite = false;
      const mesh = new THREE.Mesh(geo, m);
      mesh.frustumCulled = false;
      mesh.renderOrder = -500;
      // (the pen sky draws its own clouds: these paper ones stay in the drawer)
      mesh.visible = false;
      return mesh;
    };
    const rng = new RNG(99);
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const w = rng.float(150, 260);
      const c = mk(rng.chance(0.5) ? 'cloud0' : 'cloud1', w, w * 0.5);
      this.clouds.push({ mesh: c, az: rng.float(0, Math.PI * 2), el: rng.float(0.1, 0.32), dist: rng.float(800, 950), speed: rng.float(0.004, 0.012) });
    }
    // the magic world's weather: more (and lower) clouds come in as the sky clouds over
    this.rainClouds = [];
    for (let i = 0; i < 16; i++) {
      const w = rng.float(220, 380);
      const c = mk(rng.chance(0.5) ? 'cloud0' : 'cloud1', w, w * 0.45);
      c.visible = false;
      this.rainClouds.push({ mesh: c, az: rng.float(0, Math.PI * 2), el: rng.float(0.05, 0.22), dist: rng.float(700, 900), speed: rng.float(0.006, 0.016), th: 0.12 + (i / 16) * 0.6 });
    }
    this.birdMat = makeLineMaterial({ widthScale: 1 });
    this.birds = new LineBatch(80, this.birdMat, { dynamic: true });
    scene.add(this.birds.mesh);
    this.flock = [];
    for (let i = 0; i < 7; i++) this.flock.push({ r: rng.float(30, 70), h: rng.float(35, 60), ph: rng.float(0, 6.28), sp: rng.float(0.08, 0.16) * (rng.chance(0.5) ? 1 : -1), flap: rng.float(0, 6) });
    this.time = 0;
    this.center = new THREE.Vector3();
  }

  update(dt, camera, focus) {
    this.time += dt;
    const cp = camera.position;
    for (const c of this.clouds) {
      c.az += c.speed * dt;
      c.mesh.position.set(cp.x + Math.cos(c.az) * Math.cos(c.el) * c.dist, cp.y + Math.sin(c.el) * c.dist, cp.z + Math.sin(c.az) * Math.cos(c.el) * c.dist);
    }
    const over = shared.uMagic.value > 0.5 ? shared.uOvercast.value : 0;
    for (const c of this.rainClouds) {
      const a = Math.min(1, Math.max(0, (over - c.th) * 3));
      c.mesh.visible = false;
      if (a <= 0.01) continue;
      c.az += c.speed * dt * (1 + shared.uWind.value.z);
      c.mesh.material.uniforms.uAlpha.value = a;
      c.mesh.position.set(cp.x + Math.cos(c.az) * Math.cos(c.el) * c.dist, cp.y + Math.sin(c.el) * c.dist, cp.z + Math.sin(c.az) * Math.cos(c.el) * c.dist);
    }
    // birds circle around a slowly following center
    this.center.lerp(focus, 1 - Math.exp(-0.2 * dt));
    const b = this.birds;
    b.clear();
    for (const f of this.flock) {
      const a = f.ph + this.time * f.sp;
      const x = this.center.x + Math.cos(a) * f.r;
      const z = this.center.z + Math.sin(a) * f.r;
      const y = f.h + Math.sin(this.time * 0.7 + f.ph) * 2;
      const dx = -Math.sin(a) * Math.sign(f.sp);
      const dz = Math.cos(a) * Math.sign(f.sp);
      const flap = Math.sin(this.time * 8 + f.flap) * 0.6;
      const s = 1.3;
      const px = -dz;
      const pz = dx;
      b.push(x, y, z, x + px * s - dx * 0.4, y + 0.4 + flap, z + pz * s - dz * 0.4, 0.15, 0.15, 0.2, 0.9, 2.2, f.ph, 0.02, 0.05);
      b.push(x, y, z, x - px * s - dx * 0.4, y + 0.4 + flap, z - pz * s - dz * 0.4, 0.15, 0.15, 0.2, 0.9, 2.2, f.ph + 1, 0.02, 0.05);
    }
    b.commit();
  }
}
