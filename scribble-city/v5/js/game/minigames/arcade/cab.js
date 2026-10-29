// (v5, ROADMAP 12.7) What every cabinet in INK ARCADE has: the glass of its tube (dark, the lines
// on it glowing, the rows of the picture over them), its sounds (square waves, as they were), the
// count in, the score and the best, the lives, the end - and the tickets it pays out, by the score.
// A cabinet's game (invaders.js, penman.js, ...) is this with its own reset(), step(dt, inp) and
// render(g, W, H); played on its screen in the world (ui/minigame.js world mode, game/arcade.js).

import { MARKER } from '../ink2d.js';

export const NEON = { pink: '#ff4fa8', cyan: '#3ff0ff', yellow: '#ffe14a', green: '#5dff7a', orange: '#ff9a3c', violet: '#b07bff', red: '#ff4a4a', white: '#f6f4ff', blue: '#4f8bff' };
const BEST = 'scribble-city-v5-arcade-best';
export const FONT = (px) => `700 ${px}px ${MARKER}`;

// the city's sound card, played as the cabinets' were: a square wave and a sweep
export function chip(audio, kind, vol = 1) {
  if (!audio || !audio.ctx || !audio.enabled || audio.ctx.state !== 'running') return;
  const v = 0.07 * vol;
  switch (kind) {
    case 'shoot':
      audio.tone('square', 1200, 300, 0.09, v);
      break;
    case 'hit':
      audio.tone('square', 220, 60, 0.16, v * 1.2);
      audio.hiss(0.12, v * 1.4, 1200, 1);
      break;
    case 'boom':
      audio.hiss(0.45, v * 2.4, 600, 0.6, 'lowpass', 0, 120);
      audio.tone('sawtooth', 160, 40, 0.4, v);
      break;
    case 'pick':
      audio.tone('square', 660, 990, 0.05, v * 0.8);
      break;
    case 'blip':
      audio.tone('square', 440, 440, 0.04, v * 0.7);
      break;
    case 'bounce':
      audio.tone('square', 520, 520, 0.05, v);
      break;
    case 'wall':
      audio.tone('square', 260, 260, 0.05, v * 0.9);
      break;
    case 'line':
      audio.tone('square', 523, 1046, 0.18, v);
      audio.tone('square', 659, 1318, 0.18, v * 0.7, 0.06);
      break;
    case 'power':
      audio.tone('square', 300, 1200, 0.35, v);
      break;
    case 'die':
      audio.tone('square', 800, 90, 0.7, v * 1.2);
      break;
    case 'start':
      for (let i = 0; i < 4; i++) audio.tone('square', [523, 659, 784, 1046][i], [523, 659, 784, 1046][i], 0.09, v, i * 0.1);
      break;
    case 'over':
      for (let i = 0; i < 4; i++) audio.tone('square', [392, 330, 262, 196][i], [392, 330, 262, 196][i] * 0.98, 0.18, v, i * 0.2);
      break;
    case 'win':
      for (let i = 0; i < 6; i++) audio.tone('square', [523, 659, 784, 659, 784, 1046][i], [523, 659, 784, 659, 784, 1046][i], 0.1, v, i * 0.09);
      break;
    case 'engine':
      audio.tone('sawtooth', 90, 110, 0.08, v * 0.5);
      break;
    default:
      audio.tone('square', 440, 220, 0.06, v);
  }
}

export function bestOf(id) {
  try {
    return (JSON.parse(localStorage.getItem(BEST) || '{}') || {})[id] || 0;
  } catch (e) {
    return 0;
  }
}

export function saveBest(id, score) {
  try {
    const all = JSON.parse(localStorage.getItem(BEST) || '{}') || {};
    if (score > (all[id] || 0)) {
      all[id] = score;
      localStorage.setItem(BEST, JSON.stringify(all));
      return true;
    }
  } catch (e) {
    // (no room: the best stays in your head)
  }
  return false;
}

// a line in light: wide and faint under, thin and bright over
export function glowLine(g, pts, color, w = 4, close = false, fill = null) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  if (close) g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  g.strokeStyle = color;
  g.globalAlpha = 0.28;
  g.lineWidth = w * 3;
  g.stroke();
  g.globalAlpha = 1;
  g.lineWidth = w;
  g.stroke();
}

export function glowRect(g, x, y, w, h, color, lw = 3, fill = null) {
  if (fill) {
    g.fillStyle = fill;
    g.fillRect(x, y, w, h);
  }
  glowLine(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], color, lw, true);
}

export function glowCircle(g, x, y, r, color, lw = 3, fill = null) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  g.strokeStyle = color;
  g.globalAlpha = 0.3;
  g.lineWidth = lw * 3;
  g.stroke();
  g.globalAlpha = 1;
  g.lineWidth = lw;
  g.stroke();
}

export function glowText(g, s, x, y, px, color, align = 'center') {
  g.font = FONT(px);
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.globalAlpha = 0.35;
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) g.fillText(s, x + dx, y + dy);
  g.globalAlpha = 1;
  g.fillText(s, x, y);
}

// the tube: dark glass, a little lighter in its middle
export function tube(g, W, H, tint = '#0b0820') {
  g.fillStyle = '#05040b';
  g.fillRect(0, 0, W, H);
  const gr = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.62);
  gr.addColorStop(0, tint);
  gr.addColorStop(1, '#05040b');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
}

// the rows of the picture over it all, and its rounded corners' shadow
let _rows = null;
export function scanlines(g, W, H) {
  if (!_rows) {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 6;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0.26)';
    x.fillRect(0, 0, 4, 2);
    _rows = c;
  }
  const p = g.createPattern(_rows, 'repeat');
  g.fillStyle = p;
  g.fillRect(0, 0, W, H);
  const gr = g.createRadialGradient(W / 2, H / 2, H * 0.55, W / 2, H / 2, W * 0.66);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
}

export class CabGame {
  // o: { cab (the cabinet's name in the world), fee (a game again) }
  constructor(o = {}) {
    this.o = o;
    this.pad = 'pad';
    this.lives0 = 3;
  }

  start(api) {
    this.api = api;
    this.touch = !!api.game.touch;
    this.best = bestOf(this.id);
    this.tickets = 0;
    this.games = 0;
    this.fresh();
  }

  fresh() {
    this.scene = 'ready';
    this.readyT = 2.4;
    this.t = 0;
    this.score = 0;
    this.lives = this.lives0;
    this.flash = 0;
    this.overTitle = null;
    this.games++;
    this.reset();
    this.sfx('start');
    this.api.status(`שיא: ${this.best}`);
  }

  sfx(kind, vol = 1) {
    chip(this.api.audio, kind, vol);
  }

  add(n) {
    this.score += n;
  }

  // the end of a game: its tickets out of the slot, the best kept
  over() {
    if (this.scene === 'over') return;
    this.scene = 'over';
    this.overT = 0;
    this.won = this.ticketsFor(this.score);
    this.tickets += this.won;
    this.newBest = saveBest(this.id, this.score);
    if (this.newBest) this.best = this.score;
    this.sfx('over');
  }

  ticketsFor(score) {
    return Math.max(1, Math.min(80, Math.round(score / (this.perTicket || 100))));
  }

  result() {
    return { score: this.score, tickets: this.tickets, games: this.games, best: this.best };
  }

  update(dt, inp) {
    this.t += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    if (this.scene === 'ready') {
      this.readyT -= dt;
      if (this.readyT <= 0) this.scene = 'play';
      return;
    }
    if (this.scene === 'play') {
      this.step(Math.min(dt, 1 / 30), inp);
      return;
    }
    // the end: A (or a tap) a game again, B away from the cabinet
    this.overT += dt;
    if (this.overT < 1) return;
    const again = inp.hit.has('a') || inp.hit.has('enter') || inp.taps.length > 0;
    if (again) {
      const fee = this.o.fee || 1;
      const m = this.api.money;
      if (!m || m.pay(fee, this.o.cab || 'ARCADE')) {
        if (this.api.audio) this.api.audio.play('coins', 0.4);
        this.fresh();
      } else this.api.finish(this.result());
    } else if (inp.hit.has('b')) this.api.finish(this.result());
  }

  draw(g, W, H) {
    tube(g, W, H, this.tint);
    this.render(g, W, H);
    // the score along the top
    if (this.hud !== false) {
      glowText(g, `${this.score}`, 30, 26, 30, NEON.white, 'left');
      glowText(g, `HI ${Math.max(this.best, this.score)}`, W / 2, 26, 26, NEON.yellow);
      if (this.lives0 > 1) {
        for (let i = 0; i < Math.max(0, this.lives - 1); i++) this.lifeIcon(g, W - 40 - i * 36, 26);
      }
    }
    if (this.scene === 'ready') {
      const k = Math.ceil(this.readyT / 0.8);
      g.fillStyle = 'rgba(5,4,11,0.55)';
      g.fillRect(0, H / 2 - 90, W, 180);
      glowText(g, this.name, W / 2, H / 2 - 36, 56, this.color || NEON.pink);
      glowText(g, k > 0 ? `${k}` : 'GO!', W / 2, H / 2 + 40, 48, NEON.white);
    }
    if (this.scene === 'over') {
      g.fillStyle = 'rgba(5,4,11,0.72)';
      g.fillRect(0, 0, W, H);
      glowText(g, this.overTitle || 'GAME OVER', W / 2, 150, 72, NEON.pink);
      glowText(g, `SCORE ${this.score}`, W / 2, 245, 40, NEON.white);
      if (this.newBest) glowText(g, 'NEW HIGH SCORE!', W / 2, 300, 34, NEON.yellow);
      glowText(g, `+${this.won} TICKETS`, W / 2, 370, 44, NEON.green);
      if (this.overT > 1 && Math.floor(this.t * 2) % 2 === 0) glowText(g, this.touch ? 'TAP: AGAIN $1 · B: LEAVE' : 'A: AGAIN $1   B: LEAVE', W / 2, 480, 30, NEON.cyan);
    }
    if (this.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${this.flash * 0.35})`;
      g.fillRect(0, 0, W, H);
    }
    scanlines(g, W, H);
  }

  lifeIcon(g, x, y) {
    glowCircle(g, x, y, 10, this.color || NEON.yellow, 3);
  }
}
