// (v5, ROADMAP 12.7) BRICK SKETCH: a wall of sticky notes, an eraser at the foot to keep a drop of
// ink bouncing into them; each note it hits is gone (the top rows' take two). Some drop a capsule as
// they go - a wider eraser, two more drops, a slower page. Three drops lost and it is over.

import { CabGame, NEON, glowLine, glowCircle, glowRect, glowText } from './cab.js';

const COLS = 13;
const ROWS = 6;
const BW = 66;
const BH = 24;
const BX = 45;
const BY = 96;
const PY = 556;
const NOTE = [NEON.pink, NEON.orange, NEON.yellow, NEON.green, NEON.cyan, NEON.violet];
const LAYOUTS = [
  (c, r) => true,
  (c, r) => (c + r) % 2 === 0 || r < 2,
  (c, r) => Math.abs(c - 6) <= r + 1,
  (c, r) => c % 3 !== 1 || r % 2 === 0,
];

export class BrickSketch extends CabGame {
  constructor(o) {
    super(o);
    this.id = 'bricks';
    this.name = 'BRICK SKETCH';
    this.title = 'BRICK SKETCH · מכונת משחק';
    this.help = 'חצים להזיז את המחק · רווח לשחרר · Esc לצאת';
    this.helpTouch = 'אצבע על המסך, או החצים, להזיז את המחק · A לשחרר';
    this.color = NEON.orange;
    this.tint = '#1a0e14';
    this.perTicket = 150;
  }

  reset() {
    this.page = 0;
    this.px = 500;
    this.nextPage();
  }

  nextPage() {
    this.page++;
    const L = LAYOUTS[(this.page - 1) % LAYOUTS.length];
    this.notes = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!L(c, r)) continue;
        this.notes.push({ x: BX + c * (BW + 4), y: BY + r * (BH + 8), hp: r < 2 && this.page > 1 ? 2 : 1, c: NOTE[r], r, tilt: (Math.random() - 0.5) * 0.06 });
      }
    }
    this.caps = [];
    this.wide = 0;
    this.slow = 0;
    this.newBall();
  }

  newBall() {
    this.balls = [{ x: this.px, y: PY - 20, vx: 0, vy: 0, held: true }];
    this.heldT = 2;
  }

  step(dt, inp) {
    const pw = this.wide > 0 ? 180 : 116;
    const d = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    this.px += d * 720 * dt;
    if (inp.drag) this.px += Math.max(-900 * dt, Math.min(900 * dt, inp.drag.x - this.px));
    this.px = Math.max(20 + pw / 2, Math.min(980 - pw / 2, this.px));
    if (this.wide > 0) this.wide -= dt;
    if (this.slow > 0) this.slow -= dt;
    const sp = (440 + this.page * 25) * (this.slow > 0 ? 0.7 : 1);
    for (const b of this.balls) {
      if (b.held) {
        b.x = this.px;
        b.y = PY - 20;
        this.heldT -= dt;
        if (inp.hit.has('a') || inp.hit.has('up') || inp.taps.length || this.heldT <= 0) {
          b.held = false;
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
          b.vx = Math.cos(a) * sp;
          b.vy = Math.sin(a) * sp;
          this.sfx('bounce');
        }
        continue;
      }
      // (its speed kept to the page's)
      const v = Math.hypot(b.vx, b.vy) || 1;
      b.vx *= sp / v;
      b.vy *= sp / v;
      // in small steps: a fast drop does not pass through a note
      const n = Math.ceil((v * dt) / 8);
      for (let i = 0; i < n && !b.dead; i++) this.move(b, dt / n, pw);
    }
    this.balls = this.balls.filter((b) => !b.dead);
    if (!this.balls.length) {
      this.lives--;
      this.sfx('die');
      this.flash = 0.5;
      if (this.lives <= 0) return this.over();
      this.wide = 0;
      this.newBall();
    }
    // the capsules, falling
    for (const c of this.caps) {
      c.y += 170 * dt;
      if (c.y > PY - 12 && c.y < PY + 12 && Math.abs(c.x - this.px) < pw / 2 + 14) {
        c.dead = true;
        this.sfx('power');
        this.add(50);
        if (c.k === 'W') this.wide = 12;
        else if (c.k === 'S') this.slow = 10;
        else {
          const b0 = this.balls.find((b) => !b.held) || this.balls[0];
          for (const a of [-0.5, 0.5]) this.balls.push({ x: b0.x, y: b0.y, vx: Math.cos(-Math.PI / 2 + a) * sp, vy: Math.sin(-Math.PI / 2 + a) * sp, held: false });
        }
      }
      if (c.y > 610) c.dead = true;
    }
    this.caps = this.caps.filter((c) => !c.dead);
    if (!this.notes.length) {
      this.add(1000);
      this.flash = 0.6;
      this.sfx('win');
      this.nextPage();
    }
  }

  move(b, dt, pw) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < 28) {
      b.x = 28;
      b.vx = Math.abs(b.vx);
      this.sfx('wall', 0.4);
    }
    if (b.x > 972) {
      b.x = 972;
      b.vx = -Math.abs(b.vx);
      this.sfx('wall', 0.4);
    }
    if (b.y < 66) {
      b.y = 66;
      b.vy = Math.abs(b.vy);
      this.sfx('wall', 0.4);
    }
    // off the eraser: the angle by where it met it
    if (b.vy > 0 && b.y > PY - 18 && b.y < PY + 4 && Math.abs(b.x - this.px) < pw / 2 + 8) {
      const k = Math.max(-1, Math.min(1, (b.x - this.px) / (pw / 2)));
      const a = -Math.PI / 2 + k * 1.05;
      const v = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(a) * v;
      b.vy = Math.sin(a) * v;
      b.y = PY - 18;
      this.sfx('bounce', 0.7);
    }
    if (b.y > 610) b.dead = true;
    for (const nt of this.notes) {
      if (b.x > nt.x - 8 && b.x < nt.x + BW + 8 && b.y > nt.y - 8 && b.y < nt.y + BH + 8) {
        // (from the side it came: the nearer edge)
        const dx = Math.min(Math.abs(b.x - (nt.x - 8)), Math.abs(b.x - (nt.x + BW + 8)));
        const dy = Math.min(Math.abs(b.y - (nt.y - 8)), Math.abs(b.y - (nt.y + BH + 8)));
        if (dx < dy) b.vx = -b.vx;
        else b.vy = -b.vy;
        b.x += Math.sign(b.vx) * 2;
        b.y += Math.sign(b.vy) * 2;
        nt.hp--;
        if (nt.hp <= 0) {
          nt.dead = true;
          this.add((ROWS - nt.r) * 10);
          if (Math.random() < 0.12) this.caps.push({ x: nt.x + BW / 2, y: nt.y + BH / 2, k: ['W', 'M', 'S'][Math.floor(Math.random() * 3)] });
          this.sfx('hit', 0.5);
        } else this.sfx('blip');
        break;
      }
    }
    this.notes = this.notes.filter((n) => !n.dead);
  }

  render(g) {
    glowLine(g, [[20, 600], [20, 60], [980, 60], [980, 600]], NEON.orange, 3);
    for (const n of this.notes) {
      g.save();
      g.translate(n.x + BW / 2, n.y + BH / 2);
      g.rotate(n.tilt);
      g.fillStyle = n.hp > 1 ? '#3a3a52' : 'rgba(0,0,0,0)';
      glowRect(g, -BW / 2, -BH / 2, BW, BH, n.hp > 1 ? NEON.white : n.c, 3, n.hp > 1 ? 'rgba(246,244,255,0.15)' : 'rgba(255,255,255,0.06)');
      // (the note's fold, its line of writing)
      glowLine(g, [[BW / 2 - 12, BH / 2], [BW / 2, BH / 2 - 10]], n.c, 2);
      glowLine(g, [[-BW / 2 + 8, -2], [BW / 2 - 18, -2]], n.c, 1.5);
      g.restore();
    }
    for (const c of this.caps) {
      const col = c.k === 'W' ? NEON.green : c.k === 'M' ? NEON.pink : NEON.cyan;
      glowRect(g, c.x - 18, c.y - 9, 36, 18, col, 2, 'rgba(0,0,0,0.5)');
      glowText(g, c.k, c.x, c.y + 1, 16, col);
    }
    const pw = this.wide > 0 ? 180 : 116;
    // the eraser: pink, its blue end
    glowRect(g, this.px - pw / 2, PY, pw, 18, NEON.pink, 3, '#5a1838');
    glowRect(g, this.px + pw / 2 - 30, PY, 30, 18, NEON.blue, 3, '#1b2a7a');
    for (const b of this.balls) glowCircle(g, b.x, b.y, 9, NEON.cyan, 3, '#bff8ff');
    if (this.balls.some((b) => b.held)) glowText(g, this.touch ? 'TAP TO LAUNCH' : 'SPACE TO LAUNCH', 500, 470, 28, NEON.yellow);
    glowText(g, `PAGE ${this.page}`, 960, 590, 16, NEON.orange, 'right');
  }

  lifeIcon(g, x, y) {
    glowCircle(g, x, y, 8, NEON.cyan, 2, '#bff8ff');
  }
}
