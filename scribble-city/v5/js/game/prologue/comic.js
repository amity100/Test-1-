import * as THREE from 'three';

// (v5, ROADMAP 18) The prologue's comic moments - as the animated films that cut a comic book's own
// frames into the picture at the peaks of their action: an impact frame (the picture held for an
// instant in two inks, black and paper, lines bursting from the hit), speed lines streaming in from
// the edges as it goes, a sound word drawn big into the picture (BANG! SKRRT! VROOOM!) - popped in,
// held a moment, gone. Drawn over the film on a sheet of its own, under the words and the bars.

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();
const _f = new THREE.Vector3();
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

  // (ROADMAP 18.9) a freeze frame's card - as the animated films bring their people in: the picture
  // held, its colours pushed towards the card's, a comic's print of dots over one side, an ink frame
  // round it, and across it a brush-stroke slab with the name on it, big, in ink, and a line under it
  // (who they are); a stroke from the slab to them. o: name, tag, col (the slab's), at (a point of
  // the world, or a function giving one: whose card), side (-1 the slab on the left, 1 the right),
  // life (s)
  card(o) {
    this.cd = { name: o.name, tag: o.tag || '', col: o.col || '#ff5a7a', at: o.at || null, side: o.side || -1, life: o.life || 1.8, t: 0, seed: Math.random() * 1000, v: o.v !== undefined ? o.v : 0.66 };
  }

  // (ROADMAP 18.9) an anime's focus lines: dark strokes rushing in from all round the picture at a
  // face (a point of the world), leaving it clear - for the moment something lands on somebody; drawn
  // anew twelve times a second. k how many and how dark
  focus(where, life = 1, k = 1) {
    this.fl = { where, t: 0, life, k, key: -1, marks: null };
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

  // (ROADMAP 18.9) the eraser's own marks as it rubs - nothing of an eraser seen, only what it does:
  // quick strokes of paper-white back and forth along its rubbing, round where it is, a puff of its
  // dust - drawn anew twelve times a second, as an animated film's effects are. src: game/prologue/
  // set.js eraser ({ pos, dir, along, on, w }); null: none
  rub(src) {
    this.rubSrc = src;
    this.rubKey = -1;
  }

  drawRub(W, H) {
    const X = this.rubSrc;
    // (only where the camera looks at it: never behind it, nor off at the edge of the picture)
    const cam = this.game.camera;
    cam.getWorldDirection(_f);
    _d.copy(X.pos).sub(cam.position).normalize();
    if (_d.dot(_f) < Math.cos(((cam.fov || 50) * Math.PI) / 180)) return;
    const c = this.at(X.pos);
    if (!c) return;
    const a = this.at(_v.copy(X.pos).addScaledVector(X.dir, X.w * 0.45));
    const b = this.at(_v.copy(X.pos).addScaledVector(X.along, X.w * 0.5));
    if (!a || !b) return;
    const cx = c[0] * W;
    const cy = c[1] * H;
    const dx = (a[0] - c[0]) * W;
    const dy = (a[1] - c[1]) * H;
    const ax = (b[0] - c[0]) * W;
    const ay = (b[1] - c[1]) * H;
    // (a new set of marks twelve times a second, the same ones between)
    const key = Math.floor((this.clock || 0) * 12);
    if (key !== this.rubKey || !this.rubMarks) {
      this.rubKey = key;
      const M = [];
      for (let i = 0; i < 9; i++) {
        const o = (Math.random() * 2 - 1) * 0.95;
        const q = (Math.random() * 2 - 1) * 0.35;
        const len = 0.45 + Math.random() * 0.6;
        const n = 3 + Math.floor(Math.random() * 3);
        const pts = [];
        for (let k = 0; k <= n; k++) {
          const f = -len + (2 * len * k) / n;
          const side = (k % 2 ? 1 : -1) * (0.05 + Math.random() * 0.06);
          pts.push([o + side, q + f]);
        }
        M.push({ pts, w: 1.5 + Math.random() * 4, a: 0.55 + Math.random() * 0.4 });
      }
      const D = [];
      for (let i = 0; i < 7; i++) D.push([(Math.random() * 2 - 1) * 1.1, (Math.random() * 2 - 1) * 0.8, 2 + Math.random() * 6]);
      this.rubMarks = { M, D };
    }
    const g = this.g;
    const P = (u, v) => [cx + ax * u + dx * v, cy + ay * u + dy * v];
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const pass of [0, 1]) {
      for (const m of this.rubMarks.M) {
        g.beginPath();
        m.pts.forEach(([u, v], i) => {
          const [x, y] = P(u, v);
          if (i) g.lineTo(x, y);
          else g.moveTo(x, y);
        });
        // (under each mark a shadow of the eraser's pink; over it the paper's white)
        g.globalAlpha = pass ? m.a : m.a * 0.35;
        g.strokeStyle = pass ? '#fffaf2' : '#ff86ad';
        g.lineWidth = (m.w + (pass ? 0 : 3.5)) * this.dpr;
        g.stroke();
      }
    }
    g.fillStyle = '#fff6f0';
    for (const [u, v, r] of this.rubMarks.D) {
      const [x, y] = P(u, v);
      g.globalAlpha = 0.35;
      g.beginPath();
      g.arc(x, y, r * this.dpr, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
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
    this.clock = (this.clock || 0) + dt;
    // (the eraser done: its marks with it)
    if (this.rubSrc && !this.rubSrc.on) this.rubSrc = null;
    const rubbing = !!(this.rubSrc && !this.pg);
    // (the sheet hidden while it has nothing on it, shown again as soon as it has: a sheet only cleared
    // could still be shown as it last was)
    const busy = !!(this.pg || this.words.length || this.speed || this.hit || rubbing || this.cd || this.fl);
    if (busy !== this.shown) {
      this.shown = busy;
      this.cv.style.visibility = busy ? 'visible' : 'hidden';
    }
    if (this.pg) {
      this.resize();
      g.clearRect(0, 0, this.cv.width, this.cv.height);
      this.dirty = true;
      this.drawPage(dt);
      if (!this.words.length && !this.speed && !this.hit) return;
    }
    if (!this.words.length && !this.speed && !this.hit && !rubbing && !this.cd && !this.fl) {
      // (nothing of its own: the sheet kept clear, whatever was on it)
      g.clearRect(0, 0, this.cv.width, this.cv.height);
      this.dirty = false;
      return;
    }
    this.resize();
    const W = this.cv.width;
    const H = this.cv.height;
    if (!this.pg) g.clearRect(0, 0, W, H);
    this.dirty = true;
    if (rubbing) this.drawRub(W, H);
    // ---- the focus lines, under the rest
    if (this.fl) {
      const f = this.fl;
      f.t += dt;
      if (f.t > f.life) this.fl = null;
      else this.drawFocus(f, W, H);
    }
    // ---- a freeze frame's card
    if (this.cd) {
      const c = this.cd;
      c.t += dt;
      if (c.t > c.life) this.cd = null;
      else this.drawCard(c, W, H);
    }
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

  drawFocus(f, W, H) {
    const g = this.g;
    const p = typeof f.where === 'function' ? f.where() : f.where;
    const c = (p && this.at(p)) || [0.5, 0.42];
    const x = c[0] * W;
    const y = c[1] * H;
    const key = Math.floor((this.clock || 0) * 12);
    if (key !== f.key || !f.marks) {
      f.key = key;
      const M = [];
      const n = Math.round(150 * f.k);
      for (let i = 0; i < n; i++) M.push([Math.random() * Math.PI * 2, 0.3 + Math.random() * 0.22, 0.0015 + Math.random() * 0.006]);
      f.marks = M;
    }
    const fade = Math.min(1, f.t / 0.1, (f.life - f.t) / 0.3);
    const R = Math.hypot(W, H) * 0.75;
    const sx = 1.0;
    const sy = 0.78;
    g.save();
    g.globalAlpha = 0.82 * fade;
    g.fillStyle = '#0c0a12';
    for (const [a, r0f, wdt] of f.marks) {
      // (a wedge from past the edge in to near the face: thin at its inner end)
      const r0 = R * r0f;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      g.beginPath();
      g.moveTo(x + ca * r0 * sx, y + sa * r0 * sy);
      g.lineTo(x + Math.cos(a + wdt) * R, y + Math.sin(a + wdt) * R);
      g.lineTo(x + Math.cos(a - wdt) * R, y + Math.sin(a - wdt) * R);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  drawCard(c, W, H) {
    const g = this.g;
    const t = c.t;
    const fade = Math.min(1, (c.life - t) / 0.18);
    const top = H * 0.115;
    const bot = H - top;
    let s = Math.floor(c.seed);
    const rnd = () => {
      s = (s * 16807 + 11) % 2147483647;
      return (s % 10000) / 10000;
    };
    g.save();
    g.globalAlpha = fade;
    // the picture held, pushed toward the card's colour - and a comic's dots over the side it is on
    g.fillStyle = c.col;
    g.globalAlpha = 0.18 * fade;
    g.fillRect(0, top, W, bot - top);
    g.globalAlpha = 0.5 * fade;
    const dot = Math.max(5, H * 0.012);
    g.fillStyle = '#0c0a12';
    const x0 = c.side < 0 ? 0 : W * 0.5;
    for (let yy = top + dot; yy < bot; yy += dot * 1.6) {
      for (let xx = x0 + ((yy / (dot * 1.6)) % 2) * dot * 0.8; xx < x0 + W * 0.5; xx += dot * 1.6) {
        // (bigger towards the outer edge: the print fading out into the picture)
        const e = c.side < 0 ? 1 - xx / (W * 0.5) : (xx - W * 0.5) / (W * 0.5);
        const r = dot * 0.42 * Math.max(0, e - 0.15);
        if (r < 0.6) continue;
        g.beginPath();
        g.arc(xx, yy, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    // the ink frame round the held picture
    g.globalAlpha = fade;
    g.strokeStyle = '#0c0a12';
    g.lineWidth = Math.max(4, H * 0.012);
    g.strokeRect(g.lineWidth / 2, top + g.lineWidth / 2, W - g.lineWidth, bot - top - g.lineWidth);
    // the slab: a brush stroke across, wiped in from its side
    const wipe = Math.min(1, t / 0.16);
    const sw = W * 0.46;
    const sh = H * 0.16;
    const cy = top + (bot - top) * c.v;
    const sx0 = c.side < 0 ? W * 0.04 : W * 0.96 - sw;
    const sxW = sw * wipe;
    const sxs = c.side < 0 ? sx0 : sx0 + sw - sxW;
    g.save();
    g.translate(0, cy);
    g.rotate(-0.045 * c.side);
    g.beginPath();
    const n = 18;
    for (let i = 0; i <= n; i++) g.lineTo(sxs + (sxW * i) / n, -sh / 2 + (rnd() - 0.5) * sh * 0.12);
    for (let i = n; i >= 0; i--) g.lineTo(sxs + (sxW * i) / n, sh / 2 + (rnd() - 0.5) * sh * 0.12);
    g.closePath();
    g.fillStyle = c.col;
    g.fill();
    g.lineWidth = Math.max(3, H * 0.006);
    g.strokeStyle = '#0c0a12';
    g.stroke();
    // (a dry-brush edge: streaks of paper through it)
    g.globalAlpha = 0.35 * fade;
    g.strokeStyle = '#fff6e8';
    for (let i = 0; i < 9; i++) {
      const yy = (rnd() - 0.5) * sh * 0.8;
      g.lineWidth = 1 + rnd() * 2.5;
      g.beginPath();
      g.moveTo(sxs + sxW * rnd() * 0.3, yy);
      g.lineTo(sxs + sxW * (0.6 + rnd() * 0.4), yy + (rnd() - 0.5) * 4);
      g.stroke();
    }
    g.globalAlpha = fade;
    // the name: big, white, inked, popped in past its size and back
    if (t > 0.1) {
      const k = t < 0.18 ? 1.3 - ((t - 0.1) / 0.08) * 0.3 : 1;
      const fs = sh * 0.62 * k;
      g.font = `${Math.round(fs)}px ${WORD_FONT}`;
      g.textBaseline = 'middle';
      g.textAlign = 'center';
      const tx = sx0 + sw / 2;
      g.lineJoin = 'round';
      g.lineWidth = fs * 0.16;
      g.strokeStyle = '#0c0a12';
      g.strokeText(c.name, tx, -sh * 0.08);
      g.fillStyle = '#fffaf0';
      g.fillText(c.name, tx, -sh * 0.08);
      if (c.tag) {
        const ts = sh * 0.2;
        g.font = `${Math.round(ts)}px ${WORD_FONT}`;
        g.lineWidth = ts * 0.22;
        g.strokeText(c.tag, tx, sh * 0.33);
        g.fillStyle = '#ffe9a8';
        g.fillText(c.tag, tx, sh * 0.33);
      }
    }
    g.restore();
    // a stroke from the slab to them
    const p = typeof c.at === 'function' ? c.at() : c.at;
    const q = p && this.at(p);
    if (q && t > 0.14) {
      const ax = c.side < 0 ? sx0 + sw * 0.85 : sx0 + sw * 0.15;
      const ay = cy - sh * 0.5;
      g.strokeStyle = '#0c0a12';
      g.lineWidth = Math.max(3, H * 0.005);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(ax, ay);
      g.quadraticCurveTo((ax + q[0] * W) / 2, ay - H * 0.06, q[0] * W, q[1] * H + H * 0.05);
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
    this.rubSrc = null;
    this.cd = null;
    this.fl = null;
    this.words = [];
    this.speed = null;
    this.hit = null;
    if (this.filtered) this.filtered.style.filter = '';
    this.filtered = null;
    this.g.clearRect(0, 0, this.cv.width, this.cv.height);
  }
}
