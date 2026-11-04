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

  // (ROADMAP 18.9) a comic's page in the film, at its peak: the picture cut into panels on a sheet of
  // paper between the bars - each panel the film itself as it is drawn (its camera, cropped to the
  // panel) while it is the one being drawn, held still once the next one comes. panels: their corners
  // ([x, y] of the page between the bars, 0..1), clockwise from the top left
  page(panels) {
    this.pg = { panels: panels.map((q) => ({ pts: q, cv: null, on: false, t: 0, u: 0.5, v: 0.5, zoom: 1 })), t: 0, out: -1 };
  }

  // panel i the live one from now (o.u, o.v: the middle of its crop in the film's picture, 0..1; o.zoom:
  // more than 1 nearer)
  panel(i, o = {}) {
    const pg = this.pg;
    if (!pg || !pg.panels[i]) return;
    const q = pg.panels[i];
    q.on = true;
    q.t = 0;
    q.u = o.u !== undefined ? o.u : 0.5;
    q.v = o.v !== undefined ? o.v : 0.5;
    q.zoom = o.zoom || 1;
    pg.cur = i;
  }

  // the page gone (fade seconds): the film again
  endPage(fade = 0.3) {
    if (this.pg) this.pg.out = Math.max(0.01, fade);
  }

  // (game.js, right after a frame is drawn) the live panel's picture: the frame just drawn, cropped
  grab(src) {
    const pg = this.pg;
    if (!pg || pg.cur === undefined || pg.out >= 0) return;
    const q = pg.panels[pg.cur];
    const r = this.rect(q.pts);
    const W = Math.max(8, Math.round(r.w));
    const H = Math.max(8, Math.round(r.h));
    if (!q.cv || q.cv.width !== W || q.cv.height !== H) {
      q.cv = document.createElement('canvas');
      q.cv.width = W;
      q.cv.height = H;
    }
    // (the crop: the panel's own shape, as much of the film's height as is between the bars, less by
    // its zoom; round its middle, kept inside the picture)
    const sw = src.width;
    const sh = src.height;
    const ch = (sh * 0.77) / q.zoom;
    const cw = Math.min(sw, (ch * W) / H);
    const cx = Math.min(sw - cw, Math.max(0, q.u * sw - cw / 2));
    const cy = Math.min(sh - ch, Math.max(0, q.v * sh - ch / 2));
    try {
      q.cv.getContext('2d').drawImage(src, cx, cy, cw, ch, 0, 0, W, H);
    } catch (e) {
      // (nothing to take this frame)
      return;
    }
    // (a panel's first picture onto the sheet at once: not a frame of black ink before it)
    if (!q.shown) {
      q.shown = true;
      const g = this.g;
      const Wc = this.cv.width;
      g.save();
      g.beginPath();
      q.pts.forEach(([x, y], i) => (i ? g.lineTo(x * Wc, r.top + y * r.ph) : g.moveTo(x * Wc, r.top + y * r.ph)));
      g.closePath();
      g.clip();
      g.drawImage(q.cv, r.x, r.y, r.w, r.h);
      g.restore();
    }
  }

  // a panel's box on the sheet, in its pixels
  rect(pts) {
    const W = this.cv.width;
    const H = this.cv.height;
    const top = H * 0.115;
    const ph = H - top * 2;
    let x0 = 1e9;
    let y0 = 1e9;
    let x1 = -1e9;
    let y1 = -1e9;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x * W);
      x1 = Math.max(x1, x * W);
      y0 = Math.min(y0, top + y * ph);
      y1 = Math.max(y1, top + y * ph);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, top, ph };
  }

  drawPage(dt) {
    const pg = this.pg;
    const g = this.g;
    const W = this.cv.width;
    const H = this.cv.height;
    pg.t += dt;
    let a = Math.min(1, pg.t / 0.08);
    if (pg.out >= 0) {
      pg.outT = (pg.outT || 0) + dt;
      a = Math.max(0, 1 - pg.outT / pg.out);
      if (a <= 0) {
        this.pg = null;
        return;
      }
    }
    g.save();
    g.globalAlpha = a;
    // the sheet: paper, a faint dot of print over it
    g.fillStyle = '#f2e8d5';
    g.fillRect(0, 0, W, H);
    if (!this.dots) {
      const d = document.createElement('canvas');
      d.width = d.height = 12;
      const x = d.getContext('2d');
      x.fillStyle = 'rgba(190,120,90,0.16)';
      x.beginPath();
      x.arc(6, 6, 2.2, 0, Math.PI * 2);
      x.fill();
      this.dots = g.createPattern(d, 'repeat');
    }
    g.fillStyle = this.dots;
    g.fillRect(0, 0, W, H);
    const top = H * 0.115;
    const ph = H - top * 2;
    const ink = Math.max(3, H * 0.0065);
    for (const q of pg.panels) {
      if (!q.on) continue;
      q.t += dt;
      // (a panel comes in with a little pop: from a hair bigger, at once)
      const k = q.t < 0.07 ? 1.06 - (q.t / 0.07) * 0.06 : 1;
      const r = this.rect(q.pts);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      g.save();
      g.translate(cx, cy);
      g.scale(k, k);
      g.translate(-cx, -cy);
      g.beginPath();
      q.pts.forEach(([x, y], i) => (i ? g.lineTo(x * W, top + y * ph) : g.moveTo(x * W, top + y * ph)));
      g.closePath();
      g.save();
      g.clip();
      if (q.cv) g.drawImage(q.cv, r.x, r.y, r.w, r.h);
      else {
        g.fillStyle = '#16121e';
        g.fillRect(r.x, r.y, r.w, r.h);
      }
      g.restore();
      g.lineWidth = ink;
      g.lineJoin = 'round';
      g.strokeStyle = '#120e18';
      g.stroke();
      g.restore();
    }
    g.restore();
  }

  update(dt) {
    const g = this.g;
    if (this.pg) {
      this.resize();
      g.clearRect(0, 0, this.cv.width, this.cv.height);
      this.dirty = true;
      this.drawPage(dt);
      if (!this.words.length && !this.speed && !this.hit) return;
    }
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
    if (!this.pg) g.clearRect(0, 0, W, H);
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
    this.pg = null;
    this.words = [];
    this.speed = null;
    this.hit = null;
    if (this.filtered) this.filtered.style.filter = '';
    this.filtered = null;
    this.g.clearRect(0, 0, this.cv.width, this.cv.height);
  }
}
