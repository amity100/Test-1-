import * as THREE from 'three';
import { shared } from './materials.js';

// The night light map: warm pools of light under every street lamp, a glow on the sidewalk in
// front of each shop window, the bar's pink neon, the theater marquees. Painted once into a canvas
// (soft radial gradients) and sampled by the shaders at any world position.

const X0 = -232;
const Z0 = -162;
const W = 468;
const D = 328;
const RES = 2.2; // texels per metre

export class LightMap {
  constructor(world) {
    this.world = world;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(W * RES);
    this.canvas.height = Math.round(D * RES);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.NoColorSpace;
    this.tex.flipY = false;
    this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.paint();
    shared.uLightMap.value = this.tex;
    shared.uLightRect.value.set(X0, Z0, 1 / W, 1 / D);
  }

  // a lamp was rubbed out of the city: its light goes too
  refresh() {
    this.paint();
  }

  paint() {
    const g = this.canvas.getContext('2d');
    const cw = this.canvas.width;
    const chh = this.canvas.height;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000';
    g.fillRect(0, 0, cw, chh);
    g.globalCompositeOperation = 'lighter';
    const pool = (x, z, r, col, inten, sx = 1, sz = 1) => {
      const px = (x - X0) * RES;
      const py = (z - Z0) * RES;
      const rr = r * RES;
      g.save();
      g.translate(px, py);
      g.scale(sx, sz);
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, rr);
      const c = (a) => `rgba(${Math.round(col[0] * 255)}, ${Math.round(col[1] * 255)}, ${Math.round(col[2] * 255)}, ${a})`;
      grd.addColorStop(0, c(0.95 * inten));
      grd.addColorStop(0.35, c(0.6 * inten));
      grd.addColorStop(0.7, c(0.2 * inten));
      grd.addColorStop(1, c(0));
      g.fillStyle = grd;
      g.beginPath();
      g.arc(0, 0, rr, 0, Math.PI * 2);
      g.fill();
      g.restore();
    };
    const objects = this.world.objects;
    for (const l of this.world.lamps || []) {
      if (l.obj && objects && objects.list[l.obj] && objects.list[l.obj].state === 'gone') continue;
      pool(l.x, l.z, 7.5, [1, 0.8, 0.48], 0.85);
    }
    for (const s of this.world.shops || []) {
      // light spilling out of the shop window across the sidewalk
      pool(s.win[0] + s.nx * 0.6, s.win[2] + s.nz * 0.6, 4.2, [1, 0.78, 0.45], 0.7, 1 + Math.abs(s.rx) * 0.6, 1 + Math.abs(s.rz) * 0.6);
    }
    for (const l of this.world.lights || []) pool(l.x, l.z, l.r, l.col, l.i);
    const bar = this.world.bar;
    if (bar) pool(bar.x, bar.z, 6, [1, 0.42, 0.72], 0.9);
    this.tex.needsUpdate = true;
  }
}
