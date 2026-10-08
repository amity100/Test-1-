import * as THREE from 'three';
import { Sketcher, makeCanvas, FONT_NOTE, BLACK2D, RED2D, INK2D } from '../render/sketch2d.js';

// Hand-drawn speech bubbles over people's heads (what they shout, in English).

const W = 512;
const H = 200;
const MAX = 10;

export class Bubbles {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.cache = new Map();
    this.pool = [];
  }

  texture(text, tone) {
    const key = tone + '|' + text;
    let tex = this.cache.get(key);
    if (tex) return tex;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const sk = new Sketcher(g, text.length * 7 + tone.length);
    g.font = `700 64px ${FONT_NOTE}`;
    const tw = Math.min(W - 70, g.measureText(text).width);
    const bw = tw + 64;
    const bh = 112;
    const x0 = (W - bw) / 2;
    const y0 = 14;
    // bubble body with a little tail down to the speaker
    const pts = [];
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([W / 2 + Math.cos(a) * (bw / 2 + Math.sin(a * 3) * 3), y0 + bh / 2 + Math.sin(a) * (bh / 2 + Math.cos(a * 2) * 2)]);
    }
    const tail = [[W / 2 - 34, y0 + bh - 8], [W / 2 - 46, H - 16], [W / 2 - 4, y0 + bh - 4]];
    g.save();
    g.fillStyle = tone === 'alarm' ? '#fff6ef' : '#fbf8f0';
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath();
    g.fill();
    g.beginPath();
    tail.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath();
    g.fill();
    g.restore();
    const ink = tone === 'alarm' ? RED2D : tone === 'cop' ? INK2D : BLACK2D;
    sk.stroke(pts, { closed: true, width: 4.5, color: BLACK2D, jitter: 1.4 });
    sk.stroke(tail, { width: 4, color: BLACK2D, jitter: 1 });
    sk.text(text, W / 2, y0 + bh / 2 + 4, { size: 64, color: ink, font: FONT_NOTE, weight: 700, dir: 'ltr', maxWidth: W - 70 });
    tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    if (this.cache.size > 80) {
      const first = this.cache.keys().next().value;
      this.cache.get(first).dispose();
      this.cache.delete(first);
    }
    this.cache.set(key, tex);
    return tex;
  }

  // who: anything with a fig (head joint) or a pos; tone: 'plain' | 'alarm' | 'cop'
  say(who, text, tone = 'plain', life = 1.9) {
    for (const b of this.list) {
      if (b.who === who) {
        b.t = b.life;
      }
    }
    if (this.list.length >= MAX) this.list[0].t = this.list[0].life;
    let s = this.pool.pop();
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false, toneMapped: false }));
      s.renderOrder = 40;
      s.center.set(0.5, 0);
    }
    s.material.map = this.texture(text, tone);
    s.material.needsUpdate = true;
    s.material.opacity = 0;
    this.scene.add(s);
    this.list.push({ who, sprite: s, t: 0, life, rise: Math.random() * 0.1 });
  }

  update(dt, camera) {
    const keep = [];
    for (const b of this.list) {
      b.t += dt;
      const s = b.sprite;
      if (b.t >= b.life + 0.25) {
        this.scene.remove(s);
        this.pool.push(s);
        continue;
      }
      keep.push(b);
      const w = b.who;
      const head = w.fig && w.fig.j && w.fig.parts && w.fig.parts.head > 0.5 ? w.fig.j.headC : null;
      const x = head ? head.x : w.pos.x;
      const y = head ? head.y + 0.42 : w.pos.y + 2.3;
      const z = head ? head.z : w.pos.z;
      const cp = camera.position;
      const d = Math.hypot(cp.x - x, cp.y - y, cp.z - z);
      // grows a little with distance so it stays readable, pops in with a bounce
      const k = Math.min(1, b.t / 0.16);
      const pop = 1 + Math.sin(k * Math.PI) * 0.18;
      const size = Math.max(1.5, d * 0.24) * pop;
      s.position.set(x, y + b.rise + Math.min(0.15, b.t * 0.1), z);
      s.scale.set(size, size * (H / W), 1);
      s.material.opacity = Math.min(1, b.t / 0.08) * Math.min(1, (b.life + 0.25 - b.t) / 0.25);
      s.visible = d < 70;
    }
    this.list = keep;
  }

  clear() {
    for (const b of this.list) {
      this.scene.remove(b.sprite);
      this.pool.push(b.sprite);
    }
    this.list = [];
  }
}
