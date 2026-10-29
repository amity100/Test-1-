// (v5, ROADMAP 12.7) DOODLE SNAKE: a line of marker that eats doodles - an apple, a star, a heart -
// and grows with each, a little faster too; into the frame or into itself and it is over. Now and
// then a golden pencil, for a few seconds only.

import { CabGame, NEON, glowLine, glowCircle, glowRect, glowText } from './cab.js';

const GW = 30;
const GH = 17;
const S = 30;
const OX = 50;
const OY = 72;
const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const FOODS = ['apple', 'star', 'heart', 'bean'];

export class DoodleSnake extends CabGame {
  constructor(o) {
    super(o);
    this.id = 'snake';
    this.name = 'DOODLE SNAKE';
    this.title = 'DOODLE SNAKE · מכונת משחק';
    this.help = 'חצים לפנות · Esc לצאת';
    this.helpTouch = 'החצים לפנות';
    this.color = NEON.green;
    this.tint = '#06180e';
    this.lives0 = 1;
    this.perTicket = 60;
  }

  reset() {
    this.body = [[10, 8], [9, 8], [8, 8], [7, 8]];
    this.dir = [1, 0];
    this.queue = [];
    this.speed = 7.5;
    this.acc = 0;
    this.eaten = 0;
    this.gold = null;
    this.goldT = 12;
    this.dying = 0;
    this.food = this.place();
  }

  place() {
    for (let k = 0; k < 400; k++) {
      const x = Math.floor(Math.random() * GW);
      const y = Math.floor(Math.random() * GH);
      if (!this.body.some(([a, b]) => a === x && b === y) && !(this.gold && this.gold.x === x && this.gold.y === y)) return { x, y, kind: FOODS[Math.floor(Math.random() * FOODS.length)] };
    }
    return { x: 0, y: 0, kind: 'apple' };
  }

  step(dt, inp) {
    if (this.dying > 0) {
      this.dying -= dt;
      if (this.dying <= 0) this.over();
      return;
    }
    for (const k of ['left', 'right', 'up', 'down']) {
      if (!inp.hit.has(k)) continue;
      const d = DIRS[k];
      const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
      if (d[0] !== -last[0] || d[1] !== -last[1]) this.queue.push(d);
    }
    // (a swipe)
    if (inp.drag && Math.hypot(inp.drag.x - inp.drag.x0, inp.drag.y - inp.drag.y0) > 30) {
      const dx = inp.drag.x - inp.drag.x0;
      const dy = inp.drag.y - inp.drag.y0;
      const d = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
      const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
      if (d[0] !== -last[0] || d[1] !== -last[1]) this.queue.push(d);
      inp.drag.x0 = inp.drag.x;
      inp.drag.y0 = inp.drag.y;
    }
    this.goldT -= dt;
    if (this.goldT <= 0 && !this.gold) {
      const p = this.place();
      this.gold = { x: p.x, y: p.y, t: 6 };
      this.goldT = 14 + Math.random() * 10;
    }
    if (this.gold) {
      this.gold.t -= dt;
      if (this.gold.t <= 0) this.gold = null;
    }
    this.acc += dt * this.speed;
    while (this.acc >= 1) {
      this.acc -= 1;
      if (this.queue.length) this.dir = this.queue.shift();
      const [hx, hy] = this.body[0];
      const nx = hx + this.dir[0];
      const ny = hy + this.dir[1];
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || this.body.slice(0, -1).some(([a, b]) => a === nx && b === ny)) {
        this.dying = 1;
        this.flash = 0.7;
        this.sfx('die');
        return;
      }
      this.body.unshift([nx, ny]);
      let grow = false;
      if (nx === this.food.x && ny === this.food.y) {
        grow = true;
        this.eaten++;
        this.add(10 + Math.floor(this.speed - 7) * 2);
        this.speed = Math.min(16, this.speed + 0.3);
        this.food = this.place();
        this.sfx('pick');
      }
      if (this.gold && nx === this.gold.x && ny === this.gold.y) {
        grow = true;
        this.add(50);
        this.gold = null;
        this.flash = 0.3;
        this.sfx('power');
      }
      if (!grow) this.body.pop();
    }
  }

  render(g) {
    glowRect(g, OX - 4, OY - 4, GW * S + 8, GH * S + 8, NEON.green, 3);
    g.fillStyle = 'rgba(93,255,122,0.06)';
    for (let y = 0; y < GH; y++) for (let x = (y % 2); x < GW; x += 2) g.fillRect(OX + x * S, OY + y * S, S, S);
    doodle(g, this.food.kind, OX + (this.food.x + 0.5) * S, OY + (this.food.y + 0.5) * S, this.t);
    if (this.gold && (this.gold.t > 2 || Math.floor(this.t * 6) % 2)) pencil(g, OX + (this.gold.x + 0.5) * S, OY + (this.gold.y + 0.5) * S);
    // the snake: one line through the middles of its squares, the head a step on by the clock
    const pts = this.body.map(([x, y]) => [OX + (x + 0.5) * S, OY + (y + 0.5) * S]);
    const col = this.dying > 0 && Math.floor(this.t * 10) % 2 ? NEON.white : NEON.green;
    glowLine(g, pts, col, 14);
    g.strokeStyle = '#063a18';
    g.lineWidth = 4;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    const [hx, hy] = pts[0];
    glowCircle(g, hx, hy, 11, NEON.green, 3, '#0d5a28');
    for (const s of [-1, 1]) {
      const ex = hx + this.dir[0] * 4 - this.dir[1] * s * 5;
      const ey = hy + this.dir[1] * 4 + this.dir[0] * s * 5;
      g.fillStyle = '#fff';
      g.fillRect(ex - 3, ey - 3, 6, 6);
    }
    glowText(g, `LENGTH ${this.body.length}`, 950, 590, 16, NEON.green, 'right');
  }
}

function doodle(g, kind, x, y, t) {
  const b = Math.sin(t * 5) * 1.5;
  if (kind === 'apple') {
    glowCircle(g, x, y + 2 + b, 10, NEON.red, 3, '#5a1414');
    glowLine(g, [[x, y - 8 + b], [x + 3, y - 14 + b]], NEON.green, 2);
  } else if (kind === 'star') {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 5 : 12;
      pts.push([x + Math.cos(a) * r, y + b + Math.sin(a) * r]);
    }
    glowLine(g, pts, NEON.yellow, 2, true, '#5a4a10');
  } else if (kind === 'heart') {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      pts.push([x + 0.7 * 16 * Math.pow(Math.sin(a), 3) * 0.75, y + b - 0.7 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 0.75]);
    }
    glowLine(g, pts, NEON.pink, 2, true, '#5a1438');
  } else {
    g.save();
    g.translate(x, y + b);
    g.rotate(0.5);
    g.beginPath();
    g.ellipse(0, 0, 7, 11, 0, 0, Math.PI * 2);
    g.fillStyle = '#4a2a14';
    g.fill();
    g.strokeStyle = NEON.orange;
    g.lineWidth = 2;
    g.stroke();
    g.beginPath();
    g.moveTo(0, -9);
    g.quadraticCurveTo(-4, 0, 0, 9);
    g.stroke();
    g.restore();
  }
}

function pencil(g, x, y) {
  glowLine(g, [[x - 13, y + 6], [x + 7, y - 14], [x + 13, y - 8], [x - 7, y + 12]], NEON.yellow, 3, true, '#6a5210');
  glowLine(g, [[x - 13, y + 6], [x - 16, y + 15], [x - 7, y + 12]], NEON.white, 2);
}
