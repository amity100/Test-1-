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
// (ROADMAP 23.8: a name card's own letters - a film's title type: heavy, narrow, upright)
const CARD_FONT = '"Anton", "Rubik", "Arial Narrow", sans-serif';

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
    // (the card's letters loaded before the first card: a sheet drawn with a font not yet here is drawn with another)
    try {
      if (document.fonts && document.fonts.load) document.fonts.load('40px "Anton"');
    } catch (e) {
      // (no font loading here: the next in line is used)
    }
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
  // (round 9) a flash over the whole picture (life seconds, colour, how strong at first)
  flash(life = 0.16, col = '#ffffff', a = 0.9) {
    this.fx = { t: 0, life, col, a };
  }

  // (round 13) a picture of the film kept now (the frame just drawn - game.js), for a memory later
  keepNext() {
    this.wantKeep = true;
  }

  keep(src) {
    this.wantKeep = false;
    try {
      // (round 22b: a phone's at a third - its picture read back from the graphics card and bleached a
      // pixel at a time held a frame of the film for a tenth of a second and more; a memory, soft)
      const div = this.game && this.game.touch ? 3 : 2;
      const W = Math.max(8, Math.round(src.width / div));
      const H = Math.max(8, Math.round(src.height / div));
      const cv = this.memCv || (this.memCv = document.createElement('canvas'));
      cv.width = W;
      cv.height = H;
      const c2 = cv.getContext('2d', { willReadFrequently: true });
      c2.drawImage(src, 0, 0, W, H);
      // (bleached once, here, as a memory is: nearly grey, a little sepia, light - a canvas filter at
      // each frame cost a phone, and Safari draws without one)
      try {
        const im = c2.getImageData(0, 0, W, H);
        const d = im.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const gg = d[i + 1];
          const b = d[i + 2];
          const l = 0.299 * r + 0.587 * gg + 0.114 * b;
          let R = r + (l - r) * 0.85;
          let G = gg + (l - gg) * 0.85;
          let B = b + (l - b) * 0.85;
          R = R * 0.65 + (0.393 * R + 0.769 * G + 0.189 * B) * 0.35;
          G = G * 0.65 + (0.349 * R + 0.686 * G + 0.168 * B) * 0.35;
          B = B * 0.65 + (0.272 * R + 0.534 * G + 0.131 * B) * 0.35;
          d[i] = Math.max(0, Math.min(255, (R * 1.55 - 128) * 0.85 + 128));
          d[i + 1] = Math.max(0, Math.min(255, (G * 1.55 - 128) * 0.85 + 128));
          d[i + 2] = Math.max(0, Math.min(255, (B * 1.55 - 128) * 0.85 + 128));
        }
        c2.putImageData(im, 0, 0);
      } catch (e) {
        // (its colours as they were)
      }
      this.memOk = true;
    } catch (e) {
      this.memOk = false;
    }
  }

  // (round 13) inside somebody's head: the picture kept, over the screen for a breath - bleached, its
  // colours gone to the paper's, shaking a little, then gone
  memory(life = 0.55, a = 0.85) {
    if (this.memOk) this.mem = { t: 0, life, a };
  }

  // (round 13) a heart heard in somebody's head: the picture's edges closing in dark on each beat -
  // lub, dub - and opening again (beats: how many; per: seconds a beat; col: the dark's [r, g, b]; k:
  // how far; vol: the heart's own sound with it, core/audio.js heartbeat)
  pulse(beats = 2, o = {}) {
    this.pu = { t: 0, n: -1, per: o.per || 0.82, life: beats * (o.per || 0.82) + 0.15, col: o.col || [34, 6, 16], k: o.k !== undefined ? o.k : 1, vol: o.vol !== undefined ? o.vol : 0.75 };
  }

  word(text, where, o = {}) {
    const uv = Array.isArray(where) ? where : this.at(where);
    if (!uv) return;
    // (round 23, the review: kept above the band at the foot of the picture - what to do next in the
    // game, the subtitles in the film; a SPLAT! there was drawn over the goal's words)
    this.words.push({ text, u: Math.min(0.88, Math.max(0.12, uv[0])), v: Math.min(0.62, Math.max(0.18, uv[1])), t: 0, life: o.life || 0.75, size: o.size || 0.09, fill: o.fill || '#ffd23f', ink: o.ink || '#16121e', burst: o.burst || '#ff4f6a', tilt: o.tilt !== undefined ? o.tilt : (Math.random() - 0.5) * 0.4, seed: Math.random() * 100 });
  }

  // speed lines: in from the edges towards a point of the world (or the middle of the sheet) for
  // life seconds; k how many and how dark
  lines(where = null, life = 1, k = 1) {
    this.speed = { where, t: 0, life, k };
  }

  // (ROADMAP 23.9, the owner's word: comic effects, yes - "but grown-up, as a grown-up anime's") a place and an hour typed into
  // the picture's lower corner as a scene opens, a crime film's way: lines (the first the place, in the title's type), life (s)
  stamp(lines, o = {}) {
    this.stp = { lines: lines.map((x) => String(x).toUpperCase()), t: 0, life: o.life || 3.2, side: o.side || -1, v: o.v !== undefined ? o.v : 0.74 };
  }

  // an anime's cut-in: the picture closed down to a slanted strip across its middle - a pair of eyes - and opened again.
  // life (s), o.h (the strip's height, of the picture's), o.slant (radians), o.v (its middle, down the picture)
  strip(life = 1.4, o = {}) {
    this.stz = { t: 0, life, h: o.h !== undefined ? o.h : 0.3, slant: o.slant !== undefined ? o.slant : -0.07, v: o.v !== undefined ? o.v : 0.5 };
  }

  // (ROADMAP 18.9) a freeze frame's card - as the animated films bring their people in: the picture
  // held, its colours pushed towards the card's, a comic's print of dots over one side, an ink frame
  // round it, and across it a brush-stroke slab with the name on it, big, in ink, and a line under it
  // (who they are); a stroke from the slab to them. o: name, tag, col (the slab's), at (a point of
  // the world, or a function giving one: whose card), side (-1 the slab on the left, 1 the right),
  // life (s)
  card(o) {
    this.cd = { name: String(o.name || '').toUpperCase(), tag: String(o.tag || '').toUpperCase(), col: o.col || '#ff5a7a', at: o.at || null, side: o.side || 0, life: o.life || 1.8, t: 0, v: o.v, placed: false, lead: !!o.lead };
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
    // (ROADMAP 23.10: this.dark - a film's black between its panels, their edges a thin light line: the scenes in the game's own
    // look, grown-up. Cream paper with a print's dots between them was a comic book's page)
    g.fillStyle = this.dark ? '#08060d' : '#f2e8d5';
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
    if (!this.dark) {
      g.fillStyle = this.dots;
      g.fillRect(0, 0, W, H);
    }
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
      g.lineWidth = this.dark ? Math.max(1.5, ink * 0.45) : ink;
      g.lineJoin = 'round';
      g.strokeStyle = this.dark ? 'rgba(255,250,240,0.85)' : '#120e18';
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
    const busy = !!(this.pg || this.words.length || this.speed || this.hit || rubbing || this.cd || this.fl || this.fx || this.mem || this.pu || this.stp || this.stz);
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
    if (!this.words.length && !this.speed && !this.hit && !rubbing && !this.cd && !this.fl && !this.fx && !this.mem && !this.pu && !this.stp && !this.stz) {
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
    // ---- an eye cut-in's strip: the picture above and below it gone to black
    if (this.stz) {
      const z = this.stz;
      z.t += dt;
      if (z.t > z.life) this.stz = null;
      else this.drawStrip(z, W, H);
    }
    // ---- a place's stamp
    if (this.stp) {
      const q = this.stp;
      q.t += dt;
      if (q.t > q.life) this.stp = null;
      else this.drawStamp(q, W, H);
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
    // ---- (round 13) the heart: the edges in dark on its beats
    if (this.pu) {
      const p = this.pu;
      p.t += dt;
      if (p.t > p.life) this.pu = null;
      else {
        const n = Math.floor(p.t / p.per);
        if (n !== p.n) {
          p.n = n;
          if (p.vol > 0 && this.game.audio && n * p.per < p.life - 0.3) this.game.audio.play('heartbeat', p.vol);
        }
        const ph = p.t - n * p.per;
        const b = Math.exp(-ph * 8) + (ph > 0.24 ? 0.65 * Math.exp(-(ph - 0.24) * 8) : 0);
        const a = Math.min(1, b) * p.k * Math.min(1, (p.life - p.t) / 0.35, p.t / 0.04);
        const R = Math.hypot(W, H) / 2;
        const gr = g.createRadialGradient(W / 2, H / 2, R * (0.58 - 0.16 * a), W / 2, H / 2, R);
        const [r0, g0, b0] = p.col;
        gr.addColorStop(0, `rgba(${r0},${g0},${b0},0)`);
        gr.addColorStop(0.55, `rgba(${r0},${g0},${b0},${(0.45 * a).toFixed(3)})`);
        gr.addColorStop(1, `rgba(${r0},${g0},${b0},${(0.92 * a).toFixed(3)})`);
        g.save();
        g.fillStyle = gr;
        g.fillRect(0, 0, W, H);
        g.restore();
      }
    }
    // ---- (round 13) a memory: the kept picture, bleached, a little shaken, over everything a breath
    if (this.mem && this.memCv) {
      const m = this.mem;
      m.t += dt;
      if (m.t > m.life) this.mem = null;
      else {
        const k = m.t / m.life;
        // (a soft one, round 13: up slowly, held, down slowly - a memory coming, not a flash)
        const soft = m.a < 0.6;
        const up = soft ? 0.35 : 0.15;
        const a = (k < up ? k / up : 1 - (k - up) / (1 - up)) * m.a;
        const j = (1 - k) * (soft ? 1.5 : 6);
        g.save();
        g.globalAlpha = a;
        g.drawImage(this.memCv, (Math.random() - 0.5) * j, (Math.random() - 0.5) * j, W, H);
        g.restore();
      }
    }
    // ---- (round 9) a flash of light: a cut's punch, over everything, gone in a breath
    if (this.fx) {
      const x = this.fx;
      x.t += dt;
      if (x.t > x.life) this.fx = null;
      else {
        g.save();
        g.globalAlpha = Math.max(0, 1 - x.t / x.life) * x.a;
        g.fillStyle = x.col;
        g.fillRect(0, 0, W, H);
        g.restore();
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
      for (let i = 0; i < n; i++) M.push([Math.random() * Math.PI * 2, 0.3 + Math.random() * 0.22, 0.004 + Math.random() * 0.011]);
      f.marks = M;
    }
    const fade = Math.min(1, f.t / 0.1, (f.life - f.t) / 0.3);
    const R = Math.hypot(W, H) * 0.75;
    const sx = 1.0;
    const sy = 0.78;
    g.save();
    g.globalAlpha = 0.9 * fade;
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

  // (ROADMAP 23.8, the owner's word: the names "cool, as an animated film's - like what was before, only not hiding the people,
  // and looking good"; and the game a crime story, grown-up. It was a brush-stroke slab across half the picture, the picture
  // tinted to its colour and framed in ink - across her face, in a close shot.) A freeze frame's name as a crime film gives it:
  // the picture held; on the side its person is NOT, the edge of the picture darkened, a slanted block of their colour wiped in
  // from it with the name on it in a title's heavy type, a rule and a line under it (who they are), a thin line from it to them.
  // Never over a face: its side and its width are taken from where they are in the picture.
  drawCard(c, W, H) {
    const g = this.g;
    const t = c.t;
    const top = H * 0.115;
    const bot = H - top;
    if (!c.placed) {
      c.placed = true;
      const p = typeof c.at === 'function' ? c.at() : c.at;
      const q = p && this.at(p);
      c.hu = q ? q[0] : null;
      c.hv = q ? q[1] : null;
      if (q) c.side = q[0] > 0.5 ? -1 : 1;
      else if (!c.side) c.side = -1;
      // (as wide as there is room for, up to a body's width short of them)
      const room = q ? (c.side < 0 ? q[0] : 1 - q[0]) - 0.15 : 0.5;
      c.w = Math.max(0.24, Math.min(0.44, room - 0.035));
      if (c.v === undefined) c.v = 0.58;
    }
    const sd = c.side;
    const out = Math.max(0, Math.min(1, (c.life - t) / 0.16));
    const ease = (x) => 1 - (1 - x) * (1 - x) * (1 - x);
    const k1 = ease(Math.min(1, t / 0.16));
    const k2 = ease(Math.max(0, Math.min(1, (t - 0.14) / 0.2)));
    const m = W * 0.04;
    const bw = c.w * W;
    // the name's size: a sixth of the picture's height, less if the name is long
    let fs = H * 0.165;
    g.font = `${Math.round(fs)}px ${CARD_FONT}`;
    const tw0 = g.measureText(c.name).width;
    if (tw0 > bw * 0.82) fs *= (bw * 0.82) / tw0;
    const bh = fs * 1.16;
    const cy = top + (bot - top) * c.v;
    const sk = bh * 0.2;
    g.save();
    // the picture's click: a breath of white as it is held
    if (t < 0.09) {
      g.globalAlpha = 0.3 * (1 - t / 0.09);
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
    }
    // the edge of the picture on its side, darkened: the name read, the person left in the light
    g.globalAlpha = Math.min(1, t / 0.14) * out;
    const x0 = sd < 0 ? 0 : W;
    const sg = g.createLinearGradient(x0, 0, x0 - sd * W * 0.62, 0);
    sg.addColorStop(0, 'rgba(8,6,14,0.82)');
    sg.addColorStop(0.5, 'rgba(8,6,14,0.5)');
    sg.addColorStop(1, 'rgba(8,6,14,0)');
    g.fillStyle = sg;
    g.fillRect(sd < 0 ? 0 : W * 0.38, 0, W * 0.62, H);
    // (it leaves the way it came: back to its edge)
    g.translate(-sd * (1 - out) * W * 0.12, 0);
    // the block: from x1 (its outer end, by the edge) to x2 (its inner end, towards them), slanted
    const xa = sd < 0 ? m : W - m - bw;
    const xb = xa + bw;
    const clipX = sd < 0 ? xa - sk : xb + sk - (bw + 2 * sk) * k1;
    g.save();
    g.beginPath();
    g.rect(clipX, cy - bh, (bw + 2 * sk) * k1, bh * 2.4);
    g.clip();
    const block = (dx, dy) => {
      g.beginPath();
      g.moveTo(xa + sk * 0.5 + dx, cy - bh / 2 + dy);
      g.lineTo(xb + sk * 0.5 + dx, cy - bh / 2 + dy);
      g.lineTo(xb - sk * 0.5 + dx, cy + bh / 2 + dy);
      g.lineTo(xa - sk * 0.5 + dx, cy + bh / 2 + dy);
      g.closePath();
    };
    block(H * 0.012, H * 0.014);
    g.fillStyle = 'rgba(6,4,10,0.85)';
    g.fill();
    block(0, 0);
    g.fillStyle = c.col;
    g.fill();
    // (a print's dots along its inner end: the drawn world's own grain, a little of it)
    g.save();
    block(0, 0);
    g.clip();
    g.fillStyle = 'rgba(8,6,14,0.22)';
    const dot = Math.max(3, H * 0.011);
    for (let yy = cy - bh / 2 + dot * 0.6; yy < cy + bh / 2; yy += dot * 1.5) {
      for (let i = 0; i < 9; i++) {
        const xx = sd < 0 ? xb - i * dot * 1.5 - ((yy / dot) % 2) * dot * 0.6 : xa + i * dot * 1.5 + ((yy / dot) % 2) * dot * 0.6;
        const r = dot * 0.46 * (1 - i / 9);
        g.beginPath();
        g.arc(xx, yy, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
    // the name on it: dark on a light block, light on a dark one
    const rgb = /^#([0-9a-f]{6})$/i.test(c.col) ? [1, 3, 5].map((i) => parseInt(c.col.slice(i, i + 2), 16)) : [200, 60, 60];
    const lightBlock = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11 > 150;
    g.font = `${Math.round(fs)}px ${CARD_FONT}`;
    g.textBaseline = 'alphabetic';
    g.textAlign = 'center';
    g.direction = 'ltr';
    g.fillStyle = lightBlock ? '#15101c' : '#fffaf0';
    g.fillText(c.name, (xa + xb) / 2, cy + fs * 0.37);
    g.restore();
    // a bar at its outer end
    g.fillStyle = '#fffaf0';
    const bx = sd < 0 ? xa - sk * 0.5 - H * 0.02 : xb + sk * 0.5 + H * 0.008;
    g.fillRect(bx, cy - bh * 0.62 * k1, H * 0.012, bh * 1.24 * k1);
    // the line under it: a rule drawn out from its outer end, and who they are
    if (k2 > 0 && c.tag) {
      const ty = cy + bh / 2 + H * 0.03;
      const ts = Math.max(11, H * 0.046);
      g.globalAlpha = k2 * out;
      g.fillStyle = 'rgba(255,250,240,0.9)';
      const rl = bw * 0.96 * k2;
      g.fillRect(sd < 0 ? xa - sk * 0.5 : xb - sk * 0.5 - rl, ty, rl, Math.max(1.5, H * 0.004));
      g.font = `600 ${Math.round(ts)}px "Rubik", "Heebo", sans-serif`;
      try {
        g.letterSpacing = `${(ts * 0.09).toFixed(1)}px`;
      } catch (e) {
        // (no letter spacing on this canvas: as the font sets it)
      }
      g.textAlign = sd < 0 ? 'left' : 'right';
      g.textBaseline = 'top';
      // (no wider than the block: a long line a little smaller)
      const tw = g.measureText(c.tag).width;
      if (tw > bw * 1.04) g.font = `600 ${Math.round((ts * bw * 1.04) / tw)}px "Rubik", "Heebo", sans-serif`;
      g.fillStyle = '#fffaf0';
      g.fillText(c.tag, sd < 0 ? xa - sk * 0.5 : xb - sk * 0.5, ty + H * 0.02 + (1 - k2) * H * 0.012);
      try {
        g.letterSpacing = '0px';
      } catch (e) {
        // (as above)
      }
    }
    // a thin line from its inner end to them: to their shoulder's side, not their face
    if (c.lead && c.hu !== null && k2 > 0) {
      const ax = sd < 0 ? xb + sk * 0.5 + H * 0.012 : xa - sk * 0.5 - H * 0.012;
      const ay = cy - bh * 0.5;
      const ex = (c.hu + sd * 0.085) * W;
      const ey = Math.min(bot - H * 0.04, (c.hv + 0.115) * H);
      if (Math.abs(ex - ax) > W * 0.03) {
        g.globalAlpha = 0.9 * k2 * out;
        g.strokeStyle = '#fffaf0';
        g.fillStyle = '#fffaf0';
        g.lineWidth = Math.max(1.5, H * 0.0045);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(ax + (ex - ax) * k2, ay + (ey - ay) * k2);
        g.stroke();
        if (k2 >= 1) {
          g.beginPath();
          g.arc(ex, ey, H * 0.011, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.restore();
  }

  drawStrip(z, W, H) {
    const g = this.g;
    // (shut in a seventh of a second, open again in a fifth)
    const kin = Math.min(1, z.t / 0.14);
    const kout = Math.min(1, (z.life - z.t) / 0.2);
    const e = (x) => 1 - (1 - x) * (1 - x) * (1 - x);
    const k = Math.min(e(kin), e(kout));
    // (from wider than the picture down to the strip)
    const half = (0.75 + (z.h / 2 - 0.75) * k) * H;
    const cy = z.v * H;
    const dy = Math.tan(z.slant) * W * 0.5;
    g.save();
    g.fillStyle = '#07050c';
    g.beginPath();
    g.moveTo(-2, -2);
    g.lineTo(W + 2, -2);
    g.lineTo(W + 2, cy - half + dy);
    g.lineTo(-2, cy - half - dy);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(-2, H + 2);
    g.lineTo(W + 2, H + 2);
    g.lineTo(W + 2, cy + half + dy);
    g.lineTo(-2, cy + half - dy);
    g.closePath();
    g.fill();
    // (a thin light line along each edge of it)
    g.globalAlpha = 0.85 * k;
    g.strokeStyle = '#fffaf0';
    g.lineWidth = Math.max(1.5, H * 0.004);
    g.beginPath();
    g.moveTo(-2, cy - half - dy);
    g.lineTo(W + 2, cy - half + dy);
    g.moveTo(-2, cy + half - dy);
    g.lineTo(W + 2, cy + half + dy);
    g.stroke();
    g.restore();
  }

  drawStamp(q, W, H) {
    const g = this.g;
    const out = Math.max(0, Math.min(1, (q.life - q.t) / 0.4));
    const x = q.side < 0 ? W * 0.055 : W * 0.945;
    const y0 = q.v * H;
    const fs = H * 0.074;
    g.save();
    g.globalAlpha = out;
    g.textAlign = q.side < 0 ? 'left' : 'right';
    g.textBaseline = 'alphabetic';
    g.direction = 'ltr';
    // (typed: so many letters a second, the lines one after the other)
    let n = Math.floor(q.t * 26);
    g.fillStyle = '#fffaf0';
    g.fillRect(q.side < 0 ? x - H * 0.03 : x + H * 0.018, y0 - fs * 0.82, H * 0.012, fs * 0.9 + (q.lines.length - 1) * H * 0.058);
    g.shadowColor = 'rgba(6,4,10,0.7)';
    g.shadowBlur = H * 0.012;
    g.shadowOffsetY = H * 0.004;
    for (let i = 0; i < q.lines.length && n > 0; i++) {
      const ln = q.lines[i];
      const txt = ln.slice(0, Math.min(ln.length, n));
      n -= ln.length + 4;
      if (i === 0) {
        g.font = `${Math.round(fs)}px ${CARD_FONT}`;
        g.fillText(txt, x, y0);
      } else {
        const ts = Math.max(11, H * 0.042);
        g.font = `600 ${Math.round(ts)}px "Rubik", "Heebo", sans-serif`;
        try {
          g.letterSpacing = `${(ts * 0.14).toFixed(1)}px`;
        } catch (e2) {
          // (no letter spacing on this canvas)
        }
        g.fillText(txt, x, y0 + i * H * 0.058 + H * 0.004);
        try {
          g.letterSpacing = '0px';
        } catch (e2) {
          // (as above)
        }
      }
    }
    g.restore();
  }

  // (ROADMAP 23.21, the owner's word: the sound words stay - "cool, like a comic's" - and may be made a little better.) As a
  // comic's letterer draws one: each letter set by hand - a little turned, a little up or down, the word growing louder
  // towards its end; a hard shadow under it; its burst two stars, one over the other, the under one the shadow's; and for
  // its first fifth of a second it shakes
  drawWord(w, W, H, k, a) {
    const g = this.g;
    const size = w.size * H * k;
    const sh = Math.max(0, 1 - w.t / 0.2);
    const x = w.u * W + Math.sin(w.t * 95 + w.seed) * size * 0.07 * sh;
    const y = w.v * H + Math.cos(w.t * 78 + w.seed * 2) * size * 0.06 * sh;
    g.save();
    g.translate(x, y);
    g.rotate(w.tilt);
    g.globalAlpha = a;
    // (the words are English, left to right - the page round the sheet reads right to left, and would
    // put a BANG!'s mark in front of it)
    g.direction = 'ltr';
    let s = Math.floor(w.seed * 1000) + 7;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s % 10000) / 10000;
    };
    // ---- the letters: where each stands, how big, how turned
    const chars = Array.from(w.text);
    const n = chars.length;
    const L = [];
    let tw = 0;
    for (let i = 0; i < n; i++) {
      const u = n > 1 ? i / (n - 1) : 0.5;
      const sz = size * (0.88 + 0.26 * u);
      g.font = `400 ${sz}px ${WORD_FONT}`;
      const cw = g.measureText(chars[i]).width * 0.94;
      L.push({ ch: chars[i], sz, cw, x: tw + cw / 2, dy: (rnd() - 0.5) * size * 0.1 - u * size * 0.05, rot: (rnd() - 0.5) * 0.13 });
      tw += cw;
    }
    for (const l of L) l.x -= tw / 2;
    // ---- the burst behind it: a jagged star, and its shadow
    const rx = tw * 0.6 + size * 0.42;
    const ry = size * 1.02;
    const N = 22;
    const star = [];
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      const r = i % 2 ? 0.74 + rnd() * 0.1 : 1.04 + rnd() * 0.26;
      star.push([Math.cos(t) * rx * r, Math.sin(t) * ry * r]);
    }
    const path = (dx, dy, kk) => {
      g.beginPath();
      for (let i = 0; i < N; i++) {
        const px = star[i][0] * kk + dx;
        const py = star[i][1] * kk + dy;
        if (i) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.closePath();
    };
    g.lineJoin = 'miter';
    g.fillStyle = w.ink;
    path(size * 0.1, size * 0.12, 1);
    g.fill();
    g.fillStyle = w.burst;
    g.strokeStyle = w.ink;
    g.lineWidth = size * 0.07;
    path(0, 0, 1);
    g.fill();
    g.stroke();
    // (a lighter heart to it)
    g.globalAlpha = a * 0.28;
    g.fillStyle = '#fffaf0';
    path(0, 0, 0.72);
    g.fill();
    g.globalAlpha = a;
    // ---- the word: its shadow, a fat ink outline, its fill, a light edge
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const each = (fn) => {
      for (const l of L) {
        g.save();
        g.translate(l.x, l.dy + size * 0.04);
        g.rotate(l.rot);
        g.font = `400 ${l.sz}px ${WORD_FONT}`;
        fn(l);
        g.restore();
      }
    };
    g.fillStyle = w.ink;
    g.strokeStyle = w.ink;
    each((l) => {
      g.lineWidth = l.sz * 0.2;
      g.strokeText(l.ch, l.sz * 0.075, l.sz * 0.095);
    });
    each((l) => {
      g.lineWidth = l.sz * 0.2;
      g.strokeText(l.ch, 0, 0);
    });
    g.fillStyle = w.fill;
    each((l) => g.fillText(l.ch, 0, 0));
    g.strokeStyle = 'rgba(255,255,255,0.65)';
    each((l) => {
      g.lineWidth = l.sz * 0.03;
      g.strokeText(l.ch, -l.sz * 0.02, -l.sz * 0.035);
    });
    g.restore();
  }

  clear() {
    this.mem = null;
    this.pu = null;
    this.pg = null;
    this.rubSrc = null;
    this.cd = null;
    this.stp = null;
    this.stz = null;
    this.fl = null;
    this.fx = null;
    this.words = [];
    this.speed = null;
    this.hit = null;
    if (this.filtered) this.filtered.style.filter = '';
    this.filtered = null;
    this.g.clearRect(0, 0, this.cv.width, this.cv.height);
  }
}
