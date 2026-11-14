// (ROADMAP 23.6) Lily's sketchbook as the film's own language - what the owner chose from the storyboard: a scene opens on a page
// of her sketchbook and its last picture turns into one; a shouted word in drawn letters with the lines of a run behind her; one
// picture cut in two panels whose gutter closes as the two of them meet; colour gone past the outlines when they do; a name on a
// scrap torn from her book, in her hand; her uncle's board in cold print. A sheet of its own over the game's picture (under the
// film's bars and its subtitles), drawn only while one of these is on it - and for the cold print, a pane that takes the colour
// out of what is behind it.
import * as THREE from 'three';
import { lang } from '../../core/lang.js';

const PAPER = '#fbf6e8';
const INK = '#3a3048';
const HAND = '"Gveret Levin", "Caveat", "Rubik", cursive';
const HAND_EN = '"Caveat", "Gveret Levin", cursive';
const SHOUT_HE = '800 {px}px "Rubik", "Heebo", sans-serif';
const SHOUT_EN = '400 {px}px "Permanent Marker", "Rubik", sans-serif';
// (the page is drawn on a sheet of 882 x 411, as the storyboard's was, and laid over the picture to cover it)
const PW = 882;
const PH = 411;
const _v = new THREE.Vector3();

function dice(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
const backOut = (t) => 1 + 2.70158 * (t - 1) * (t - 1) * (t - 1) + 1.70158 * (t - 1) * (t - 1);
const smooth = (t) => t * t * (3 - 2 * t);

// a felt pen's band across the page: a little unsteady, the paper showing along it
function band(g, r, y, col, x0 = 96, x1 = 846, w = 21) {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.globalAlpha = 0.86;
  g.beginPath();
  g.moveTo(x0 + (r() - 0.5) * 6, y + (r() - 0.5) * 4);
  const n = 4;
  for (let i = 1; i <= n; i++) g.lineTo(x0 + ((x1 - x0) * i) / n + (r() - 0.5) * 6, y + (r() - 0.5) * 3.2);
  g.stroke();
  g.globalAlpha = 0.5;
  g.strokeStyle = PAPER;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(x0 + 14, y - 5 + (r() - 0.5) * 2);
  g.lineTo(x1 - 18, y - 4 + (r() - 0.5) * 2);
  g.stroke();
  g.globalAlpha = 1;
}

function line(g, pts, col, w) {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i < pts.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, pts[i], pts[i + 1]);
  g.stroke();
}

function disc(g, x, y, r, fill, ink = INK, w = 2.4) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (ink) {
    g.strokeStyle = ink;
    g.lineWidth = w;
    g.stroke();
  }
}

function poly(g, pts, fill, ink, w = 2.4) {
  g.beginPath();
  for (let i = 0; i < pts.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, pts[i], pts[i + 1]);
  g.closePath();
  g.lineJoin = 'round';
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (ink) {
    g.strokeStyle = ink;
    g.lineWidth = w;
    g.stroke();
  }
}

// the paper itself: cream, ruled, a margin, the spiral's holes along its top
function paper(g, W, H, sc) {
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(80,130,200,0.24)';
  g.lineWidth = Math.max(1, 1.2 * sc);
  for (let y = 72 * sc; y < H; y += 24 * sc) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(220,80,90,0.34)';
  g.beginPath();
  g.moveTo(62 * sc, 0);
  g.lineTo(62 * sc, H);
  g.stroke();
  g.fillStyle = '#d8d0bc';
  for (let x = 26 * sc; x < W; x += 40 * sc) {
    g.beginPath();
    g.arc(x, 34 * sc, 6 * sc, 0, Math.PI * 2);
    g.fill();
  }
}

// her drawing: her and her dad, hand in hand on the pier, the giant wheel and the evening behind them (in the sheet's own
// 882 x 411) - all of it but its last touches (the heart, the words: lastTouches)
function meAndDad(g) {
  const r = dice(7);
  g.save();
  g.translate(0, 8);
  for (const y of [74, 98, 122]) band(g, r, y, '#a985e6');
  for (const y of [148, 172]) band(g, r, y, '#f76aa3');
  for (const y of [198, 222, 246, 270]) band(g, r, y, '#ffb64f');
  for (const y of [322, 346]) band(g, r, y, '#52abdc');
  for (const y of [372, 396]) band(g, r, y, '#3f83c6');
  line(g, [92, 300, 850, 302], INK, 3.2);
  for (let x = 110; x < 850; x += 46) line(g, [x, 301, x + 2, 352], INK, 2.2);
  // the wheel
  const cx = 652;
  const cy = 176;
  const R = 96;
  disc(g, cx, cy, R, PAPER, null);
  disc(g, cx, cy, R, null, '#e8457a', 11);
  disc(g, cx, cy, R + 6, null, INK, 2);
  disc(g, cx, cy, R - 6, null, INK, 2);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6 + 0.12;
    line(g, [cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R], INK, 2);
  }
  const cols = ['#ffc83d', '#8a5fe0', '#62c24a', '#ff8f2e', '#ff5d7e', '#45c2b8'];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 + 0.3;
    const x = cx + Math.cos(a) * (R + 3);
    const y = cy + Math.sin(a) * (R + 3);
    g.save();
    g.translate(x, y);
    g.rotate((r() - 0.5) * 0.18);
    g.fillStyle = cols[i % 6];
    g.fillRect(-13, -6, 26, 17);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.strokeRect(-13, -6, 26, 17);
    g.restore();
  }
  disc(g, cx, cy, 10, PAPER, INK, 2.4);
  line(g, [cx, cy, cx - 58, 300], INK, 4);
  line(g, [cx, cy, cx + 58, 300], INK, 4);
  disc(g, 812, 92, 30, '#ffd23f', INK, 2.6);
  // dad
  line(g, [287, 238, 282, 296], '#77665a', 13);
  line(g, [313, 238, 318, 296], '#77665a', 13);
  line(g, [272, 298, 292, 298], '#2c2530', 8);
  line(g, [308, 298, 330, 298], '#2c2530', 8);
  poly(g, [274, 160, 326, 160, 330, 240, 270, 240], '#30457c', '#232a45', 2.6);
  g.globalAlpha = 0.8;
  for (let i = 0; i < 7; i++) line(g, [276 + i * 8, 166 + (r() - 0.5) * 4, 273 + i * 8, 236 + (r() - 0.5) * 4], '#25376a', 3.4);
  g.globalAlpha = 1;
  poly(g, [293, 160, 300, 196, 307, 160], '#f6eeda', '#232a45', 1.6);
  line(g, [276, 166, 250, 216], '#30457c', 12);
  disc(g, 248, 221, 7, '#cf9a78', INK, 1.8);
  line(g, [324, 166, 366, 214], '#30457c', 12);
  disc(g, 300, 134, 24, '#cf9a78', INK, 2.6);
  g.beginPath();
  g.moveTo(276, 130);
  g.quadraticCurveTo(280, 100, 298, 104);
  g.quadraticCurveTo(296, 96, 306, 100);
  g.quadraticCurveTo(318, 94, 320, 108);
  g.quadraticCurveTo(328, 114, 324, 132);
  g.quadraticCurveTo(318, 116, 308, 118);
  g.quadraticCurveTo(298, 124, 290, 120);
  g.quadraticCurveTo(282, 122, 276, 130);
  g.closePath();
  g.fillStyle = '#3b2a22';
  g.fill();
  for (const [x, y] of [[289, 150], [294, 154], [300, 156], [306, 154], [311, 150], [291, 146], [309, 146], [297, 151], [303, 151]]) line(g, [x, y, x + 1, y + 3], '#4a372e', 1.6);
  disc(g, 292, 134, 2.4, '#2a1d17', null);
  disc(g, 308, 134, 2.4, '#2a1d17', null);
  g.strokeStyle = '#2a1d17';
  g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(291, 143);
  g.quadraticCurveTo(300, 151, 309, 143);
  g.stroke();
  // her
  line(g, [402, 262, 399, 296], '#77665a', 10);
  line(g, [420, 262, 423, 296], '#77665a', 10);
  line(g, [391, 298, 407, 298], '#f1ece4', 7);
  line(g, [416, 298, 433, 298], '#f1ece4', 7);
  poly(g, [394, 216, 428, 216, 434, 266, 388, 266], '#8f52b0', '#4d2c63', 2.4);
  g.globalAlpha = 0.8;
  for (let i = 0; i < 5; i++) line(g, [397 + i * 8, 221 + (r() - 0.5) * 4, 394 + i * 9, 262 + (r() - 0.5) * 4], '#7a419c', 3);
  g.globalAlpha = 1;
  line(g, [396, 222, 366, 214], '#8f52b0', 10);
  disc(g, 366, 214, 7.5, '#c58f6e', INK, 1.8);
  line(g, [426, 222, 452, 196], '#8f52b0', 10);
  disc(g, 455, 192, 6.5, '#c58f6e', INK, 1.8);
  disc(g, 411, 194, 19, '#c58f6e', INK, 2.4);
  for (let i = 0; i < 15; i++) {
    let x;
    let y;
    if (i < 11) {
      const a = Math.PI * (1.02 + (i / 14) * 0.96);
      x = 411 + Math.cos(a) * 20;
      y = 192 + Math.sin(a) * 20;
    } else [x, y] = [[389, 200], [433, 200], [387, 211], [435, 211]][i - 11];
    disc(g, x, y, 5.5 + r() * 2, null, '#4a2f22', 3.2);
  }
  disc(g, 405, 194, 2.2, '#2a1d17', null);
  disc(g, 418, 194, 2.2, '#2a1d17', null);
  g.beginPath();
  g.moveTo(402, 201);
  g.quadraticCurveTo(411, 211, 421, 201);
  g.closePath();
  g.fillStyle = PAPER;
  g.fill();
  g.strokeStyle = '#2a1d17';
  g.lineWidth = 2.2;
  g.stroke();
  g.restore();
}

// the drawing's last touches, as she makes them: the heart over their hands coloured in (k 0 to 0.6), then her words (to 1)
function lastTouches(g, k) {
  g.save();
  g.translate(0, 8);
  const kh = Math.min(1, k / 0.6);
  if (kh > 0) {
    g.save();
    g.translate(352, 126);
    g.rotate(-0.1);
    g.beginPath();
    g.moveTo(0, -8);
    g.bezierCurveTo(-9, -23, -30, -11, -17, 5);
    g.lineTo(0, 22);
    g.lineTo(17, 5);
    g.bezierCurveTo(30, -11, 9, -23, 0, -8);
    g.closePath();
    g.strokeStyle = '#b5325f';
    g.lineWidth = 2.2;
    g.stroke();
    // (coloured in back and forth, from its top down)
    g.clip();
    g.strokeStyle = '#ff5d8f';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    const rows = 9;
    const n = Math.ceil(rows * kh);
    for (let i = 0; i < n; i++) {
      const y = -22 + i * 5.2;
      const f = i === n - 1 ? rows * kh - (n - 1) : 1;
      const a = i % 2 ? 26 : -26;
      g.moveTo(a, y);
      g.lineTo(a + (-a * 2) * f, y + 2.6);
    }
    g.stroke();
    g.restore();
  }
  const kt = Math.max(0, (k - 0.6) / 0.4);
  if (kt > 0) {
    const he = lang() === 'he';
    const txt = he ? 'אני + אבא' : 'me + dad';
    g.save();
    g.translate(96, 52);
    g.rotate(-0.05);
    g.font = `31px ${he ? HAND : HAND_EN}`;
    g.fillStyle = '#c2385f';
    g.textBaseline = 'alphabetic';
    g.direction = he ? 'rtl' : 'ltr';
    g.textAlign = 'left';
    const w = g.measureText(txt).width;
    // (written from its first letter: for Hebrew, from the right)
    g.beginPath();
    if (he) g.rect(w * (1 - kt), -40, w * kt + 6, 60);
    else g.rect(-4, -40, w * kt + 6, 60);
    g.clip();
    g.fillText(txt, 0, 0);
    g.restore();
    if (kt >= 1) {
      g.save();
      g.translate(770, 398);
      g.rotate(-0.07);
      g.font = `27px ${HAND_EN}`;
      g.fillStyle = '#8455d6';
      g.direction = 'ltr';
      g.fillText('Lily ♥', 0, 0);
      g.restore();
    }
  }
  g.restore();
}

export class Sketch {
  constructor(game, root) {
    this.game = game;
    // (the cold pane first: under every sheet)
    const cold = document.createElement('div');
    cold.id = 'pl-cold';
    cold.style.cssText =
      'position:absolute;inset:0;pointer-events:none;opacity:0;visibility:hidden;' +
      'background-color:rgba(38,72,118,0.3);background-image:radial-gradient(circle, rgba(8,18,40,0.62) 0 28%, transparent 34%);background-size:1.05vw 1.05vw;' +
      '-webkit-backdrop-filter:grayscale(1) contrast(1.5) brightness(1.04);backdrop-filter:grayscale(1) contrast(1.5) brightness(1.04);';
    root.insertBefore(cold, root.firstChild);
    this.coldEl = cold;
    const c = document.createElement('canvas');
    c.id = 'pl-book';
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;visibility:hidden;';
    // (over the comic's own sheet, under the bars and the subtitles)
    const comic = root.querySelector('#pl-comic');
    root.insertBefore(c, comic ? comic.nextSibling : root.firstChild);
    this.cv = c;
    this.g = c.getContext('2d');
    this.shown = false;
    this.clock = 0;
    this.clear();
  }

  clear() {
    this.pg = null;
    this.gut = null;
    this.sh = null;
    this.sp = null;
    this.spl = null;
    this.sc = null;
    this.fz = null;
    this.wantGrab = false;
    this.coldOn = false;
    this.coldHole = null;
    this.coldK = 0;
    this.coldVis = false;
    if (this.coldEl) {
      this.coldEl.style.opacity = '0';
      this.coldEl.style.visibility = 'hidden';
    }
    if (this.g) this.g.clearRect(0, 0, this.cv.width, this.cv.height);
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    if (this.cv.width !== w || this.cv.height !== h) {
      this.cv.width = w;
      this.cv.height = h;
      this.pageCv = null;
    }
    this.dpr = dpr;
  }

  // where a point of the world is on the sheet (0..1 across and down), or null behind the camera
  at(p) {
    _v.set(p.x, p.y, p.z).project(this.game.camera);
    if (_v.z > 1) return null;
    return [(_v.x + 1) / 2, (1 - _v.y) / 2];
  }

  // ---- a page of her sketchbook over the whole picture: her drawing, its last touches made over `draw` seconds
  page(draw = 2.4) {
    this.pg = { t: 0, draw, out: -1, outDur: 1 };
  }

  // the page falls away under the camera as it comes up off it (dur seconds): the film's own picture behind it
  pageOut(dur = 1.0) {
    if (this.pg) {
      this.pg.out = 0;
      this.pg.outDur = dur;
    }
  }

  pageSheet(W, H) {
    if (this.pageCv && this.pageCv.width === W && this.pageCv.height === H) return this.pageCv;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    const sc = Math.max(W / PW, H / PH);
    paper(g, W, H, sc);
    g.save();
    g.translate((W - PW * sc) / 2, (H - PH * sc) / 2);
    g.scale(sc, sc);
    meAndDad(g);
    g.restore();
    this.pageCv = cv;
    return cv;
  }

  drawPageNow(dt, W, H) {
    const p = this.pg;
    const g = this.g;
    p.t += dt;
    let e = 0;
    if (p.out >= 0) {
      p.out += dt;
      const k = Math.min(1, p.out / p.outDur);
      e = k * k * (3 - 2 * k);
      e *= e;
      if (k >= 1) {
        this.pg = null;
        return;
      }
    }
    const sc = Math.max(W / PW, H / PH);
    g.save();
    if (e > 0) {
      // (down and away, a little turned, growing as the camera's eye leaves it: and a shadow under its top edge)
      g.translate(W / 2, H / 2 + e * H * 1.12);
      g.rotate(e * 0.07);
      g.scale(1 + e * 0.16, 1 + e * 0.16);
      g.translate(-W / 2, -H / 2);
      g.shadowColor = 'rgba(10,6,20,0.55)';
      g.shadowBlur = 40 * this.dpr;
      g.shadowOffsetY = -6 * this.dpr;
    }
    g.drawImage(this.pageSheet(W, H), 0, 0);
    g.shadowColor = 'transparent';
    g.translate((W - PW * sc) / 2, (H - PH * sc) / 2);
    g.scale(sc, sc);
    lastTouches(g, Math.min(1, p.t / p.draw));
    g.restore();
  }

  // ---- one picture in two panels: a gutter of paper between two of its people (a, b: functions giving a point of the world),
  // slanted, as wide as they are far apart - and closed when they meet
  gutter(a, b) {
    this.gut = a ? { a, b, k: 0 } : null;
  }

  drawGutter(dt, W, H) {
    const q = this.gut;
    const ua = this.at(q.a());
    const ub = this.at(q.b());
    if (!ua || !ub) return;
    q.k = Math.min(1, q.k + dt / 0.18);
    const gap = Math.abs(ub[0] - ua[0]);
    // (nothing left of it a little before they touch)
    const wd = Math.max(0, Math.min(0.02, (gap - 0.1) * 0.06)) * q.k;
    // (and its two ink lines gone with it: closed, they were one black line down the picture)
    if (wd <= 0.0025) return;
    const mid = (ua[0] + ub[0]) / 2;
    const hw = (wd * W) / 2;
    const xt = (mid + 0.035) * W;
    const xb = (mid - 0.035) * W;
    const g = this.g;
    g.fillStyle = PAPER;
    g.beginPath();
    g.moveTo(xt - hw, 0);
    g.lineTo(xt + hw, 0);
    g.lineTo(xb + hw, H);
    g.lineTo(xb - hw, H);
    g.closePath();
    g.fill();
    g.strokeStyle = '#16121e';
    g.globalAlpha = Math.min(1, (wd - 0.0025) / 0.004);
    g.lineWidth = Math.max(1.5, 2 * this.dpr);
    g.beginPath();
    g.moveTo(xt - hw, 0);
    g.lineTo(xb - hw, H);
    g.moveTo(xt + hw, 0);
    g.lineTo(xb + hw, H);
    g.stroke();
    g.globalAlpha = 1;
  }

  // ---- a shouted word in drawn letters: at [u, v] of the sheet, size of its height, a tilt; life seconds
  shout(text, uv, o = {}) {
    this.sh = { text, u: uv[0], v: uv[1], size: o.size || 0.2, tilt: o.tilt !== undefined ? o.tilt : -0.14, life: o.life || 1.2, t: 0, he: /[֐-׿]/.test(text) };
  }

  drawShout(dt, W, H) {
    const s = this.sh;
    s.t += dt;
    if (s.t >= s.life) {
      this.sh = null;
      return;
    }
    const g = this.g;
    const px = Math.round(s.size * H);
    const pop = s.t < 0.2 ? backOut(s.t / 0.2) : 1;
    const out = Math.max(0, 1 - (s.life - s.t) / 0.18);
    // (redrawn twelve times a second, a hand's width off each time: drawn letters, not print)
    const r = dice(1 + Math.floor(this.clock * 12) * 7919);
    g.save();
    g.globalAlpha = 1 - out;
    g.translate(s.u * W + (r() - 0.5) * px * 0.03, s.v * H + (r() - 0.5) * px * 0.03);
    g.rotate(s.tilt + (r() - 0.5) * 0.012);
    g.scale(pop, pop);
    g.font = (s.he ? SHOUT_HE : SHOUT_EN).replace('{px}', px);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.direction = s.he ? 'rtl' : 'ltr';
    g.lineJoin = 'round';
    g.fillStyle = '#2a1730';
    g.fillText(s.text, px * 0.05, px * 0.07);
    g.strokeStyle = '#2a1730';
    g.lineWidth = px * 0.17;
    g.strokeText(s.text, 0, 0);
    g.fillStyle = '#ffd23f';
    g.fillText(s.text, 0, 0);
    g.restore();
  }

  // ---- the lines of a run behind somebody (at: a function giving a point of the world; dir: +1 they go to the picture's right)
  speed(at, dir = 1, life = 1.2) {
    this.sp = at ? { at, dir, life, t: 0 } : null;
  }

  drawSpeed(dt, W, H) {
    const s = this.sp;
    s.t += dt;
    if (s.t >= s.life) {
      this.sp = null;
      return;
    }
    const uv = this.at(s.at());
    if (!uv) return;
    const g = this.g;
    const r = dice(3 + Math.floor(this.clock * 12) * 104729);
    const fade = Math.min(1, s.t / 0.1) * Math.min(1, (s.life - s.t) / 0.2);
    g.strokeStyle = '#ffffff';
    g.lineCap = 'round';
    for (let i = 0; i < 24; i++) {
      const y = (uv[1] + (r() - 0.5) * 0.62) * H;
      const x1 = (uv[0] - s.dir * (0.035 + r() * 0.07)) * W;
      const ln = (0.05 + r() * 0.2) * W;
      g.globalAlpha = (0.5 + r() * 0.45) * fade;
      g.lineWidth = (1.1 + r() * 2.6) * this.dpr;
      g.beginPath();
      g.moveTo(x1 - s.dir * ln, y);
      g.lineTo(x1, y + (r() - 0.5) * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // ---- colour gone past the outlines: a child's crayon strokes out from the two of them, all round (at: a function giving the
  // middle of them; top: one giving the top of their heads - how big they are in the picture); cols: [her side's, his side's]
  spill(at, top, o = {}) {
    this.spl = at ? { at, top, t: 0, life: o.life || 2.2, left: o.left || '#a45fd6', right: o.right || '#34488a', seed: 11 } : null;
  }

  drawSpill(dt, W, H) {
    const s = this.spl;
    s.t += dt;
    if (s.t >= s.life) {
      this.spl = null;
      return;
    }
    const c = this.at(s.at());
    const tp = this.at(s.top());
    if (!c || !tp) return;
    const g = this.g;
    const ry = Math.max(0.05 * H, Math.abs(tp[1] - c[1]) * H * 1.12);
    const rx = ry * 0.66;
    const cx = c[0] * W;
    const cy = c[1] * H;
    const r = dice(s.seed);
    const n = 58;
    const fade = Math.min(1, (s.life - s.t) / 0.45);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (let k = 0; k < n; k++) {
      const a = (Math.PI * 2 * k) / n + (r() - 0.5) * 0.08;
      const co = Math.cos(a);
      const si = Math.sin(a);
      const r0 = 1 + r() * 0.1;
      const ln = (0.17 + r() * 0.36) * ry * (si > 0.4 ? 0.6 : 1);
      const col = co < -0.35 ? [s.left, s.left, '#ffe45e', '#ff8fb8'][Math.floor(r() * 4)] : co > 0.35 ? [s.right, s.right, '#ffe45e', '#ffb24f'][Math.floor(r() * 4)] : ['#ffe45e', '#ff8fb8', '#ffb24f'][Math.floor(r() * 3)];
      const wd = (0.036 + r() * 0.02) * ry;
      const al = 0.7 + r() * 0.18;
      const order = r();
      if (si > 0.8) continue;
      // (each stroke in its turn, out from them - the first at once, the last a third of a second on)
      const grow = Math.max(0, Math.min(1, (s.t - order * 0.34) / 0.16));
      if (grow <= 0) continue;
      const x0 = cx + co * rx * r0;
      const y0 = cy + si * ry * r0;
      const x1 = x0 + co * ln * grow;
      const y1 = y0 + si * ln * grow;
      const px = -si * wd * 0.6;
      const py = co * wd * 0.6;
      g.strokeStyle = col;
      g.globalAlpha = al * fade;
      g.lineWidth = wd;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.lineTo(x0 + px, y0 + py);
      g.lineTo(x1 + px * 1.4, y1 + py * 1.4);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // ---- a name on a scrap torn from her sketchbook, in her hand: o.name, o.tag, o.col (the name's), o.side (-1 the picture's
  // left, 1 its right), o.v (how far down), o.life
  scrap(o) {
    this.sc = { name: o.name, tag: o.tag || '', col: o.col || '#c2385f', side: o.side || -1, v: o.v !== undefined ? o.v : 0.3, life: o.life || 1.9, t: 0, seed: Math.floor(Math.random() * 1e6) + 1 };
  }

  drawScrap(dt, W, H) {
    const s = this.sc;
    s.t += dt;
    if (s.t >= s.life) {
      this.sc = null;
      return;
    }
    const g = this.g;
    const he = /[֐-׿]/.test(s.name + s.tag);
    const h = 0.27 * H;
    g.font = `${Math.round(h * 0.19)}px ${he ? HAND : HAND_EN}`;
    const w = Math.max(h * 1.5, g.measureText(s.tag).width + h * 0.5);
    const pop = s.t < 0.22 ? backOut(s.t / 0.22) : 1;
    const out = Math.max(0, 1 - (s.life - s.t) / 0.16);
    const r = dice(s.seed);
    g.save();
    g.globalAlpha = Math.min(1, s.t / 0.08) * (1 - out);
    g.translate((s.side < 0 ? 0.045 * W + w / 2 : W - 0.045 * W - w / 2), s.v * H);
    g.rotate(s.side < 0 ? -0.085 : 0.07);
    g.scale(0.55 + 0.45 * pop, 0.55 + 0.45 * pop);
    // the scrap: its top torn off along the spiral's holes, its sides and foot nearly straight
    const pts = [];
    const n = 15;
    for (let i = 0; i <= n; i++) pts.push(-w / 2 + (w * i) / n, -h / 2 + (i % 2 ? 0.055 : 0) * h + (r() - 0.5) * 0.03 * h);
    pts.push(w / 2 - r() * 0.02 * w, 0, w / 2 - r() * 0.015 * w, h / 2 - r() * 0.02 * h, -w / 2 + r() * 0.02 * w, h / 2, -w / 2 + r() * 0.02 * w, 0);
    const shape = () => {
      g.beginPath();
      for (let i = 0; i < pts.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, pts[i], pts[i + 1]);
      g.closePath();
    };
    g.save();
    g.translate(0, 0.035 * h);
    shape();
    g.fillStyle = 'rgba(12,6,22,0.42)';
    g.fill();
    g.restore();
    shape();
    g.fillStyle = PAPER;
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(80,130,200,0.32)';
    g.lineWidth = Math.max(1, h * 0.012);
    for (let y = -h / 2 + h * 0.26; y < h / 2; y += h * 0.215) {
      g.beginPath();
      g.moveTo(-w / 2, y);
      g.lineTo(w / 2, y);
      g.stroke();
    }
    g.restore();
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.direction = he ? 'rtl' : 'ltr';
    g.fillStyle = s.col;
    g.font = `${Math.round(h * 0.5)}px ${he ? HAND : HAND_EN}`;
    g.fillText(s.name, 0, h * 0.13);
    g.fillStyle = '#5a4a66';
    g.font = `${Math.round(h * 0.19)}px ${he ? HAND : HAND_EN}`;
    g.fillText(s.tag, 0, h * 0.36);
    // (a strip of tape over its top)
    g.rotate(-0.12);
    g.fillStyle = 'rgba(255,224,130,0.78)';
    g.fillRect(-h * 0.2, -h * 0.56, h * 0.4, h * 0.12);
    g.restore();
  }

  // ---- cold print: the colour out of the picture behind, a print's dots over it, blue-grey - all but a round of it (hole: a
  // function giving a point of the world, its size of the picture's height) that stays as warm as it was
  cold(on, hole = null, size = 0.3) {
    this.coldOn = !!on;
    if (on) {
      this.coldHole = hole;
      this.coldSize = size;
    }
  }

  tickCold(dt) {
    const el = this.coldEl;
    if (!el) return;
    // (it comes over the picture, and goes, in a fifth of a second - on the film's own clock)
    const k0 = this.coldK || 0;
    const k = Math.max(0, Math.min(1, k0 + (this.coldOn ? dt : -dt) / 0.2));
    if (k !== k0 || (k > 0) !== this.coldVis) {
      this.coldK = k;
      this.coldVis = k > 0;
      el.style.opacity = String(k);
      el.style.visibility = k > 0 ? 'visible' : 'hidden';
    }
    if (k <= 0) return;
    let m = 'none';
    if (this.coldHole) {
      const uv = this.at(this.coldHole());
      if (uv) {
        // (the pane cut round it - a plain hole, hard-edged as print is: a soft mask over a pane that filters what is behind it
        // was not kept by every browser)
        const W = window.innerWidth;
        const H = window.innerHeight;
        const ry = this.coldSize * H;
        const rx = ry * 1.28;
        const cx = uv[0] * W;
        const cy = uv[1] * H;
        m = `path(evenodd, "M0 0H${W}V${H}H0Z M${(cx - rx).toFixed(1)} ${cy.toFixed(1)}a${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(2 * rx).toFixed(1)} 0a${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(-2 * rx).toFixed(1)} 0Z")`;
      }
    }
    if (m !== this.coldMask) {
      this.coldMask = m;
      el.style.clipPath = m;
    }
  }

  // ---- the film's picture as it is now, made a page of her sketchbook: taken (game.js calls grab with the frame just drawn),
  // its colours laid flat as a felt pen's, the paper showing between the strokes - held, and turned over the spiral at its top
  freeze(o = {}) {
    this.fz = { t: 0, inDur: o.in || 0.6, hold: o.hold || 1.3, turn: o.turn || 0.9, raw: null, page: null, turning: -1 };
    this.wantGrab = true;
  }

  grab(src) {
    this.wantGrab = false;
    const f = this.fz;
    if (!f) return;
    try {
      this.resize();
      const W = this.cv.width;
      const H = this.cv.height;
      const raw = document.createElement('canvas');
      raw.width = W;
      raw.height = H;
      raw.getContext('2d').drawImage(src, 0, 0, W, H);
      // (flat colour: a small copy, each of its colours brought to one of four steps and made stronger)
      const sw = Math.min(640, W);
      const shh = Math.max(8, Math.round((sw * H) / W));
      const small = document.createElement('canvas');
      small.width = sw;
      small.height = shh;
      const sg = small.getContext('2d');
      sg.filter = 'blur(1.2px)';
      sg.drawImage(raw, 0, 0, sw, shh);
      sg.filter = 'none';
      const im = sg.getImageData(0, 0, sw, shh);
      const d = im.data;
      const step = (v) => (v < 54 ? 26 : v < 118 ? 107 : v < 186 ? 184 : 255);
      for (let i = 0; i < d.length; i += 4) {
        const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
        d[i] = step(Math.max(0, Math.min(255, l + (d[i] - l) * 1.7 + 14)));
        d[i + 1] = step(Math.max(0, Math.min(255, l + (d[i + 1] - l) * 1.7 + 14)));
        d[i + 2] = step(Math.max(0, Math.min(255, l + (d[i + 2] - l) * 1.7 + 14)));
      }
      sg.putImageData(im, 0, 0);
      const page = document.createElement('canvas');
      page.width = W;
      page.height = H;
      const g = page.getContext('2d');
      const sc = Math.max(W / PW, H / PH);
      g.fillStyle = PAPER;
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'multiply';
      g.imageSmoothingEnabled = true;
      g.drawImage(small, 0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      // (the paper between a felt pen's bands, and through its strokes)
      g.fillStyle = 'rgba(251,246,232,0.7)';
      for (let y = 0.051 * W; y < H; y += 0.0555 * W) {
        g.save();
        g.translate(0, y);
        g.rotate(-0.012);
        g.fillRect(-10, 0, W + 20, 0.0045 * W);
        g.restore();
      }
      g.strokeStyle = 'rgba(251,246,232,0.2)';
      g.lineWidth = Math.max(1, 0.0025 * W);
      g.beginPath();
      for (let x = -H; x < W; x += 0.0115 * W) {
        g.moveTo(x, H);
        g.lineTo(x + H * 0.49, 0);
      }
      g.stroke();
      g.strokeStyle = 'rgba(80,130,200,0.3)';
      g.lineWidth = Math.max(1, 1.2 * sc);
      for (let y = 72 * sc; y < H; y += 24 * sc) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
      }
      g.fillStyle = '#cfc6b0';
      for (let x = 26 * sc; x < W; x += 40 * sc) {
        g.beginPath();
        g.arc(x, 34 * sc, 6 * sc, 0, Math.PI * 2);
        g.fill();
      }
      const he = lang() === 'he';
      g.save();
      g.translate(W - 60 * sc, 88 * sc);
      g.rotate(-0.07);
      g.font = `${Math.round(40 * sc)}px ${he ? HAND : HAND_EN}`;
      g.fillStyle = '#c2385f';
      g.textAlign = 'right';
      g.direction = he ? 'rtl' : 'ltr';
      g.fillText(he ? 'אני + אבא' : 'me + dad', 0, 0);
      g.restore();
      g.save();
      g.translate(W - 150 * sc, H - 44 * sc);
      g.rotate(-0.08);
      g.font = `${Math.round(34 * sc)}px ${HAND_EN}`;
      g.fillStyle = '#7a48d0';
      g.textAlign = 'right';
      g.direction = 'ltr';
      g.fillText('Lily ♥', 0, 0);
      g.restore();
      f.raw = raw;
      f.page = page;
    } catch (e) {
      // (the frame could not be taken: no page - the film goes on as it is)
      this.fz = null;
    }
  }

  // the picture was not taken (no frame drawn in time): no page
  noFreeze() {
    this.fz = null;
    this.wantGrab = false;
  }

  // is the page there, held (the script waits for it before it lets the film's time go on)
  get frozen() {
    return !!(this.fz && this.fz.page);
  }

  // the page turned over (dur seconds): the game's own picture behind it
  turn() {
    if (this.fz && this.fz.turning < 0) this.fz.turning = 0;
  }

  drawFreeze(dt, W, H) {
    const f = this.fz;
    if (!f.page) return;
    f.t += dt;
    const g = this.g;
    if (f.turning < 0) {
      const k = smooth(Math.min(1, f.t / f.inDur));
      g.drawImage(f.raw, 0, 0);
      g.globalAlpha = k;
      g.drawImage(f.page, 0, 0);
      g.globalAlpha = 1;
      return;
    }
    f.turning += dt;
    const k = Math.min(1, f.turning / f.turn);
    if (k >= 1) {
      this.fz = null;
      return;
    }
    // (up over the spiral at its top: its foot lifted, the page shorter and darker as it comes up - and gone over)
    const e = k * k;
    const hh = H * Math.cos(e * Math.PI * 0.5);
    g.drawImage(f.page, 0, 0, W, H, 0, 0, W, Math.max(1, hh));
    const sh = g.createLinearGradient(0, 0, 0, hh);
    sh.addColorStop(0, 'rgba(20,12,30,0)');
    sh.addColorStop(1, `rgba(20,12,30,${0.55 * e})`);
    g.fillStyle = sh;
    g.fillRect(0, 0, W, hh);
    g.fillStyle = `rgba(10,6,20,${0.35 * (1 - e)})`;
    g.fillRect(0, hh, W, Math.min(H - hh, 18 * this.dpr));
  }

  update(dt) {
    this.clock += dt;
    this.tickCold(dt);
    const busy = !!(this.pg || this.gut || this.sh || this.sp || this.spl || this.sc || (this.fz && this.fz.page));
    if (busy !== this.shown) {
      this.shown = busy;
      this.cv.style.visibility = busy ? 'visible' : 'hidden';
      if (!busy) this.g.clearRect(0, 0, this.cv.width, this.cv.height);
    }
    if (!busy) return;
    this.resize();
    const W = this.cv.width;
    const H = this.cv.height;
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.clearRect(0, 0, W, H);
    if (this.fz && this.fz.page) this.drawFreeze(dt, W, H);
    if (this.spl) this.drawSpill(dt, W, H);
    if (this.gut) this.drawGutter(dt, W, H);
    if (this.sp) this.drawSpeed(dt, W, H);
    if (this.sh) this.drawShout(dt, W, H);
    if (this.sc) this.drawScrap(dt, W, H);
    if (this.pg) this.drawPageNow(dt, W, H);
  }
}
