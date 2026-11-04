import * as THREE from 'three';

// (v5, ROADMAP 18) The prologue's comic moments - as the animated films that cut a comic book's own
// frames into the picture at the peaks of their action: an impact frame (the picture held for an
// instant in two inks, black and paper, lines bursting from the hit), speed lines streaming in from
// the edges as it goes, a sound word drawn big into the picture (BANG! SKRRT! VROOOM!) - popped in,
// held a moment, gone. Drawn over the film on a sheet of its own, under the words and the bars.

const _v = new THREE.Vector3();
const WORD_FONT = '"Permanent Marker", "Rubik", sans-serif';

export class Comic {
  constructor(game, root) {
    this.game = game;
    const c = document.createElement('canvas');
    c.id = 'pl-comic';
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    // (under the subtitles and the bars: first in the sheet)
    root.insertBefore(c, root.firstChild);
    this.cv = c;
    this.g = c.getContext('2d');
    this.words = [];
    this.speed = null;
    this.hit = null;
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    if (this.cv.width !== w || this.cv.height !== h) {
      this.cv.width = w;
      this.cv.height = h;
    }
    this.dpr = dpr;
  }

  // where a point of the world is on the sheet (0..1 across and down), or null behind the camera
  at(p) {
    const cam = this.game.camera;
    _v.set(p.x, p.y, p.z).project(cam);
    if (_v.z > 1) return null;
    return [(_v.x + 1) / 2, (1 - _v.y) / 2];
  }

  // a sound word: at a point of the world (or [u, v] on the sheet), its colours, its size (of the
  // sheet's height), a tilt; held for life seconds
  word(text, where, o = {}) {
    const uv = Array.isArray(where) ? where : this.at(where);
    if (!uv) return;
    this.words.push({ text, u: Math.min(0.88, Math.max(0.12, uv[0])), v: Math.min(0.82, Math.max(0.18, uv[1])), t: 0, life: o.life || 0.75, size: o.size || 0.09, fill: o.fill || '#ffd23f', ink: o.ink || '#16121e', burst: o.burst || '#ff4f6a', tilt: o.tilt !== undefined ? o.tilt : (Math.random() - 0.5) * 0.4, seed: Math.random() * 100 });
  }

  // speed lines: in from the edges towards a point of the world (or the middle of the sheet) for
  // life seconds; k how many and how dark
  lines(where = null, life = 1, k = 1) {
    this.speed = { where, t: 0, life, k };
  }

  // an impact frame: for an instant the picture in two inks (the film's own canvas, filtered), and
  // lines bursting from the hit (a point of the world, or the middle)
  impact(where = null, life = 0.12) {
    this.hit = { where, t: 0, life };
    const cv = this.game.renderer && this.game.renderer.domElement;
    if (cv) {
      cv.style.filter = 'grayscale(1) contrast(5) brightness(1.15)';
      this.filtered = cv;
    }
  }

  update(dt) {
    const g = this.g;
    if (!this.words.length && !this.speed && !this.hit) {
      if (this.dirty) {
        g.clearRect(0, 0, this.cv.width, this.cv.height);
        this.dirty = false;
      }
      return;
    }
    this.resize();
    const W = this.cv.width;
    const H = this.cv.height;
    g.clearRect(0, 0, W, H);
    this.dirty = true;
    // ---- the impact frame
    if (this.hit) {
      const h = this.hit;
      h.t += dt;
      if (h.t > h.life) {
        this.hit = null;
        if (this.filtered) this.filtered.style.filter = '';
        this.filtered = null;
      } else {
        const c = (h.where && this.at(h.where)) || [0.5, 0.5];
        this.burst(c[0] * W, c[1] * H, Math.max(W, H) * 0.9, 34, 1, 12345);
      }
    }
    // ---- speed lines
    if (this.speed) {
      const s = this.speed;
      s.t += dt;
      if (s.t > s.life) this.speed = null;
      else {
        const c = (s.where && this.at(s.where)) || [0.5, 0.5];
        const fade = Math.min(1, s.t / 0.12, (s.life - s.t) / 0.25);
        this.streaks(c[0] * W, c[1] * H, W, H, s.k * fade);
      }
    }
    // ---- the sound words
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i];
      w.t += dt;
      if (w.t > w.life) {
        this.words.splice(i, 1);
        continue;
      }
      // (popped in past its size and back, held, faded out at the end)
      const k = w.t < 0.08 ? (w.t / 0.08) * 1.25 : w.t < 0.16 ? 1.25 - ((w.t - 0.08) / 0.08) * 0.25 : 1;
      const a = Math.min(1, (w.life - w.t) / 0.18);
      this.drawWord(w, W, H, k, a);
    }
  }

  // lines from a point out past the edges: an impact's burst
  burst(x, y, R, n, alpha, seed) {
    const g = this.g;
    let s = seed;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s % 10000) / 10000;
    };
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = '#0c0a10';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.15;
      const r0 = R * (0.12 + rnd() * 0.18);
      const wdt = (0.006 + rnd() * 0.012) * R;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      g.lineTo(x + Math.cos(a + wdt / R) * R, y + Math.sin(a + wdt / R) * R);
      g.lineTo(x + Math.cos(a - wdt / R) * R, y + Math.sin(a - wdt / R) * R);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  // streaks in from the edges toward (x, y), never into its middle: a fresh set every frame, as the
  // films draw them
  streaks(x, y, W, H, k) {
    const g = this.g;
    const R = Math.hypot(W, H) * 0.62;
    const n = Math.round(46 * k);
    g.save();
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r1 = R * (0.98 + Math.random() * 0.2);
      const r0 = R * (0.42 + Math.random() * 0.36);
      g.globalAlpha = (0.25 + Math.random() * 0.45) * k;
      g.strokeStyle = Math.random() < 0.75 ? '#fffaf0' : '#16121e';
      g.lineWidth = (1 + Math.random() * 3.5) * this.dpr;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      g.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      g.stroke();
    }
    g.restore();
  }

  drawWord(w, W, H, k, a) {
    const g = this.g;
    const size = w.size * H * k;
    const x = w.u * W;
    const y = w.v * H;
    g.save();
    g.translate(x, y);
    g.rotate(w.tilt);
    g.globalAlpha = a;
    // (the words are English, left to right - the page round the sheet reads right to left, and would
    // put a BANG!'s mark in front of it)
    g.direction = 'ltr';
    // the burst behind it: a jagged star
    let s = Math.floor(w.seed * 1000) + 7;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s % 10000) / 10000;
    };
    g.font = `400 ${size}px ${WORD_FONT}`;
    const tw = g.measureText(w.text).width;
    const rx = tw * 0.62 + size * 0.35;
    const ry = size * 0.95;
    g.fillStyle = w.burst;
    g.strokeStyle = w.ink;
    g.lineWidth = size * 0.07;
    g.beginPath();
    const N = 18;
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      const r = i % 2 ? 0.78 + rnd() * 0.08 : 1.05 + rnd() * 0.18;
      const px = Math.cos(t) * rx * r;
      const py = Math.sin(t) * ry * r;
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.closePath();
    g.fill();
    g.stroke();
    // the word: fat ink outline, its fill, a light edge
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = size * 0.2;
    g.strokeStyle = w.ink;
    g.strokeText(w.text, 0, size * 0.04);
    g.fillStyle = w.fill;
    g.fillText(w.text, 0, size * 0.04);
    g.lineWidth = size * 0.03;
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.strokeText(w.text, -size * 0.02, 0);
    g.restore();
  }

  clear() {
    this.words = [];
    this.speed = null;
    this.hit = null;
    if (this.filtered) this.filtered.style.filter = '';
    this.filtered = null;
    this.g.clearRect(0, 0, this.cv.width, this.cv.height);
  }
}
