// (v5, ROADMAP 12.7) INKTRIS: the seven shapes of four squares fall into the well, one at a time;
// turn them, slide them, fill a row across and it is gone. The more rows at once, the more it pays;
// the more rows gone, the faster they fall. Up drops a shape at once.

import { CabGame, NEON, glowRect, glowText } from './cab.js';

const W = 10;
const H = 20;
const C = 26;
const X0 = 500 - (W * C) / 2;
const Y0 = 64;
const SHAPES = {
  I: { c: NEON.cyan, b: [[0, 1], [1, 1], [2, 1], [3, 1]], n: 4 },
  O: { c: NEON.yellow, b: [[1, 0], [2, 0], [1, 1], [2, 1]], n: 4 },
  T: { c: NEON.violet, b: [[1, 0], [0, 1], [1, 1], [2, 1]], n: 3 },
  S: { c: NEON.green, b: [[1, 0], [2, 0], [0, 1], [1, 1]], n: 3 },
  Z: { c: NEON.red, b: [[0, 0], [1, 0], [1, 1], [2, 1]], n: 3 },
  J: { c: NEON.blue, b: [[0, 0], [0, 1], [1, 1], [2, 1]], n: 3 },
  L: { c: NEON.orange, b: [[2, 0], [0, 1], [1, 1], [2, 1]], n: 3 },
};
const KEYS = Object.keys(SHAPES);
const PAYS = [0, 100, 300, 500, 800];

export class InkTris extends CabGame {
  constructor(o) {
    super(o);
    this.id = 'inktris';
    this.name = 'INKTRIS';
    this.title = 'INKTRIS · מכונת משחק';
    this.help = 'חצים לצדדים · למטה מהר · למעלה להפיל · רווח לסובב · Esc לצאת';
    this.helpTouch = 'החצים לזוז · A לסובב · למעלה להפיל';
    this.color = NEON.violet;
    this.tint = '#120a26';
    this.lives0 = 1;
    this.perTicket = 120;
  }

  reset() {
    this.well = Array.from({ length: H }, () => Array(W).fill(null));
    this.bag = [];
    this.next = this.draw7();
    this.lines = 0;
    this.level = 1;
    this.fallT = 0;
    this.das = 0;
    this.clearing = null;
    this.spawn();
  }

  draw7() {
    if (!this.bag.length) {
      this.bag = KEYS.slice();
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }

  spawn() {
    const k = this.next;
    this.next = this.draw7();
    const S = SHAPES[k];
    this.cur = { k, b: S.b.map((p) => p.slice()), n: S.n, x: k === 'O' ? 3 : 3, y: 0 };
    if (this.hits(this.cur.b, this.cur.x, this.cur.y)) this.over();
  }

  hits(b, x, y) {
    for (const [i, j] of b) {
      const cx = x + i;
      const cy = y + j;
      if (cx < 0 || cx >= W || cy >= H) return true;
      if (cy >= 0 && this.well[cy][cx]) return true;
    }
    return false;
  }

  turn(dir) {
    const c = this.cur;
    if (c.k === 'O') return;
    const n = c.n;
    const b = c.b.map(([i, j]) => (dir > 0 ? [n - 1 - j, i] : [j, n - 1 - i]));
    // (against a wall or the heap: nudged aside if that frees it)
    for (const dx of [0, -1, 1, -2, 2]) {
      if (!this.hits(b, c.x + dx, c.y)) {
        c.b = b;
        c.x += dx;
        this.sfx('blip', 0.5);
        return;
      }
    }
  }

  slide(dx) {
    const c = this.cur;
    if (!this.hits(c.b, c.x + dx, c.y)) {
      c.x += dx;
      return true;
    }
    return false;
  }

  lock() {
    const c = this.cur;
    for (const [i, j] of c.b) if (c.y + j >= 0) this.well[c.y + j][c.x + i] = SHAPES[c.k].c;
    const full = [];
    for (let y = 0; y < H; y++) if (this.well[y].every((v) => v)) full.push(y);
    if (full.length) {
      this.clearing = { rows: full, t: 0.3 };
      this.add(PAYS[full.length] * this.level);
      this.sfx(full.length === 4 ? 'win' : 'line');
      if (full.length === 4) this.flash = 0.6;
    } else this.sfx('wall', 0.5);
    this.spawn();
  }

  step(dt, inp) {
    if (this.clearing) {
      this.clearing.t -= dt;
      if (this.clearing.t <= 0) {
        for (const y of this.clearing.rows) {
          this.well.splice(y, 1);
          this.well.unshift(Array(W).fill(null));
        }
        this.lines += this.clearing.rows.length;
        this.level = 1 + Math.floor(this.lines / 8);
        this.clearing = null;
      }
    }
    const c = this.cur;
    if (!c) return;
    if (inp.hit.has('a') || inp.hit.has('enter')) this.turn(1);
    if (inp.hit.has('b')) this.turn(-1);
    // (taps: on the left half or the right a step that way, in the middle a turn)
    for (const [x] of inp.taps) {
      if (x < 380) this.slide(-1);
      else if (x > 620) this.slide(1);
      else this.turn(1);
    }
    // sideways: a step, then, held, steps quickly
    for (const [k, dx] of [['left', -1], ['right', 1]]) {
      if (inp.hit.has(k)) {
        this.slide(dx);
        this.das = -0.17;
      } else if (inp[k]) {
        this.das += dt;
        while (this.das > 0.05) {
          this.das -= 0.05;
          this.slide(dx);
        }
      }
    }
    if (inp.hit.has('up')) {
      let n = 0;
      while (!this.hits(c.b, c.x, c.y + 1)) {
        c.y++;
        n++;
      }
      this.add(n * 2);
      this.lock();
      return;
    }
    const every = inp.down ? 0.04 : Math.max(0.07, 0.75 - (this.level - 1) * 0.07);
    this.fallT += dt;
    while (this.fallT > every) {
      this.fallT -= every;
      if (this.hits(c.b, c.x, c.y + 1)) {
        this.lock();
        return;
      }
      c.y++;
      if (inp.down) this.add(1);
    }
  }

  cell(g, x, y, color, ghost = false) {
    const px = X0 + x * C;
    const py = Y0 + y * C;
    if (ghost) {
      g.globalAlpha = 0.35;
      glowRect(g, px + 3, py + 3, C - 6, C - 6, color, 2);
      g.globalAlpha = 1;
      return;
    }
    g.fillStyle = color;
    g.globalAlpha = 0.35;
    g.fillRect(px + 2, py + 2, C - 4, C - 4);
    g.globalAlpha = 1;
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.strokeRect(px + 3, py + 3, C - 6, C - 6);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(px + 5, py + 5, 5, 5);
  }

  render(g) {
    // the well
    glowRect(g, X0 - 6, Y0 - 4, W * C + 12, H * C + 10, NEON.violet, 3, 'rgba(20,10,40,0.6)');
    g.strokeStyle = 'rgba(176,123,255,0.08)';
    g.lineWidth = 1;
    for (let x = 1; x < W; x++) {
      g.beginPath();
      g.moveTo(X0 + x * C, Y0);
      g.lineTo(X0 + x * C, Y0 + H * C);
      g.stroke();
    }
    const blink = this.clearing && Math.floor(this.clearing.t * 20) % 2 === 0;
    for (let y = 0; y < H; y++) {
      const going = this.clearing && this.clearing.rows.includes(y);
      for (let x = 0; x < W; x++) if (this.well[y][x]) this.cell(g, x, y, going && blink ? NEON.white : this.well[y][x]);
    }
    const c = this.cur;
    if (c && this.scene !== 'over') {
      let gy = c.y;
      while (!this.hits(c.b, c.x, gy + 1)) gy++;
      for (const [i, j] of c.b) if (gy + j >= 0) this.cell(g, c.x + i, gy + j, SHAPES[c.k].c, true);
      for (const [i, j] of c.b) if (c.y + j >= 0) this.cell(g, c.x + i, c.y + j, SHAPES[c.k].c);
    }
    // the next, the rows, the level
    glowText(g, 'NEXT', 780, 110, 30, NEON.cyan);
    const n = SHAPES[this.next];
    for (const [i, j] of n.b) {
      g.fillStyle = n.c;
      g.globalAlpha = 0.4;
      g.fillRect(730 + i * 26, 140 + j * 26, 24, 24);
      g.globalAlpha = 1;
      g.strokeStyle = n.c;
      g.lineWidth = 3;
      g.strokeRect(731 + i * 26, 141 + j * 26, 22, 22);
    }
    glowText(g, 'LINES', 220, 140, 30, NEON.cyan);
    glowText(g, `${this.lines}`, 220, 186, 40, NEON.white);
    glowText(g, 'LEVEL', 220, 270, 30, NEON.cyan);
    glowText(g, `${this.level}`, 220, 316, 40, NEON.white);
  }
}
