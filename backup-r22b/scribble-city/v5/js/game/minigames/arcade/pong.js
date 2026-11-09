// (v5, ROADMAP 12.7) PAPER PONG: a ball of paper between two rulers, you on the left, the machine on
// the right; past a ruler is a point. First to seven. The ball quicker with each hit, and off the
// ruler's end it flies at an angle.

import { CabGame, NEON, glowLine, glowCircle, glowRect, glowText } from './cab.js';

const TOP = 70;
const BOT = 585;
const PH = 96;
const WIN = 7;

export class PaperPong extends CabGame {
  constructor(o) {
    super(o);
    this.id = 'pong';
    this.name = 'PAPER PONG';
    this.title = 'PAPER PONG · מכונת משחק';
    this.help = 'למעלה ולמטה להזיז את הסרגל · Esc לצאת';
    this.helpTouch = 'החצים, או אצבע על המסך, להזיז את הסרגל';
    this.color = NEON.white;
    this.tint = '#0a1422';
    this.lives0 = 1;
    this.perTicket = 80;
    this.hud = false;
  }

  reset() {
    this.me = { y: (TOP + BOT) / 2, s: 0 };
    this.cpu = { y: (TOP + BOT) / 2, s: 0 };
    this.trail = [];
    this.serve(1);
  }

  serve(dir) {
    this.ball = { x: 500, y: (TOP + BOT) / 2, vx: 0, vy: 0, wait: 1, dir };
    this.trail.length = 0;
  }

  step(dt, inp) {
    const b = this.ball;
    // you: keys, or a finger where the ruler should be
    const d = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    this.me.y += d * 560 * dt;
    if (inp.drag) this.me.y += Math.max(-700 * dt, Math.min(700 * dt, inp.drag.y - this.me.y));
    this.me.y = Math.max(TOP + PH / 2, Math.min(BOT - PH / 2, this.me.y));
    // the machine: after where the ball will be, not quite as quick as you
    const lvl = this.me.s + this.cpu.s;
    let want = (TOP + BOT) / 2;
    if (b.vx > 0) {
      const t = (930 - b.x) / b.vx;
      let y = b.y + b.vy * t;
      const span = BOT - TOP - 20;
      y = y - TOP - 10;
      y = ((y % (2 * span)) + 2 * span) % (2 * span);
      if (y > span) y = 2 * span - y;
      want = y + TOP + 10 + Math.sin(this.t * 1.7) * 26;
    }
    const cs = 330 + lvl * 18;
    this.cpu.y += Math.max(-cs * dt, Math.min(cs * dt, want - this.cpu.y));
    this.cpu.y = Math.max(TOP + PH / 2, Math.min(BOT - PH / 2, this.cpu.y));
    if (b.wait > 0) {
      b.wait -= dt;
      if (b.wait <= 0) {
        const a = (Math.random() - 0.5) * 0.9;
        b.vx = Math.cos(a) * 470 * b.dir;
        b.vy = Math.sin(a) * 470;
      }
      return;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    this.trail.push([b.x, b.y]);
    if (this.trail.length > 10) this.trail.shift();
    if (b.y < TOP + 10) {
      b.y = TOP + 10;
      b.vy = Math.abs(b.vy);
      this.sfx('wall', 0.6);
    }
    if (b.y > BOT - 10) {
      b.y = BOT - 10;
      b.vy = -Math.abs(b.vy);
      this.sfx('wall', 0.6);
    }
    // off a ruler: quicker, at an angle by where it met it
    for (const [p, x, s] of [[this.me, 62, 1], [this.cpu, 938, -1]]) {
      if ((s > 0 ? b.vx < 0 && b.x < x + 10 && b.x > x - 14 : b.vx > 0 && b.x > x - 10 && b.x < x + 14) && Math.abs(b.y - p.y) < PH / 2 + 10) {
        const k = (b.y - p.y) / (PH / 2);
        const sp = Math.min(980, Math.hypot(b.vx, b.vy) * 1.06);
        const a = k * 0.95;
        b.vx = Math.cos(a) * sp * s;
        b.vy = Math.sin(a) * sp;
        b.x = x + s * 11;
        this.sfx('bounce');
        if (s > 0) this.add(10);
      }
    }
    if (b.x < 0 || b.x > 1000) {
      const mine = b.x > 1000;
      if (mine) {
        this.me.s++;
        this.add(100);
        this.sfx('pick');
      } else {
        this.cpu.s++;
        this.sfx('hit');
      }
      if (this.me.s >= WIN || this.cpu.s >= WIN) {
        this.overTitle = this.me.s >= WIN ? 'YOU WIN!' : 'CPU WINS';
        if (this.me.s >= WIN) {
          this.add(500);
          this.sfx('win');
        }
        this.over();
        return;
      }
      this.serve(mine ? -1 : 1);
    }
  }

  render(g) {
    for (let y = TOP; y < BOT; y += 30) glowLine(g, [[500, y], [500, y + 14]], 'rgba(246,244,255,0.5)', 3);
    glowLine(g, [[20, TOP], [980, TOP]], NEON.white, 2);
    glowLine(g, [[20, BOT], [980, BOT]], NEON.white, 2);
    glowText(g, `${this.me.s}`, 400, 130, 72, NEON.cyan);
    glowText(g, `${this.cpu.s}`, 600, 130, 72, NEON.pink);
    glowText(g, 'YOU', 400, 42, 24, NEON.cyan);
    glowText(g, 'CPU', 600, 42, 24, NEON.pink);
    // the rulers, their marks
    for (const [p, x, c] of [[this.me, 62, NEON.cyan], [this.cpu, 938, NEON.pink]]) {
      glowRect(g, x - 9, p.y - PH / 2, 18, PH, c, 3, 'rgba(255,255,255,0.08)');
      for (let i = 1; i < 8; i++) glowLine(g, [[x - 9, p.y - PH / 2 + i * 12], [x - (i % 2 ? 3 : 0), p.y - PH / 2 + i * 12]], c, 1.5);
    }
    const b = this.ball;
    this.trail.forEach(([x, y], i) => {
      g.globalAlpha = (i / this.trail.length) * 0.35;
      g.fillStyle = NEON.white;
      g.beginPath();
      g.arc(x, y, 8, 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;
    // (a crumpled ball: a circle and its creases)
    glowCircle(g, b.x, b.y, 11, NEON.white, 3, '#d8d4c4');
    glowLine(g, [[b.x - 6, b.y - 3], [b.x, b.y + 1], [b.x + 5, b.y - 5]], '#8a8470', 1.5);
    if (this.scene === 'over') return;
    if (b.wait > 0) glowText(g, 'READY', 500, 330, 30, NEON.yellow);
  }
}
