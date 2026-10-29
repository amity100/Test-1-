// (v5, ROADMAP 12.7) INK INVADERS: rows of ink blots, erasers and paper planes march down the page
// and drop smudges; you are the pen at the foot of it, firing drops of ink up at them, behind the
// paper wads (each shot eats a piece of one). A sharpener crosses the top now and then for the bonus.
// Clear the page and the next comes, lower and faster.

import { CabGame, NEON, glowLine, glowCircle, glowText } from './cab.js';

const COLS = 10;
const ROWS = 5;
const KIND = ['plane', 'eraser', 'eraser', 'blot', 'blot'];
const PTS = { plane: 30, eraser: 20, blot: 10 };
const PY = 548;

export class InkInvaders extends CabGame {
  constructor(o) {
    super(o);
    this.id = 'invaders';
    this.name = 'INK INVADERS';
    this.title = 'INK INVADERS · מכונת משחק';
    this.help = 'חצים לזוז · רווח לירות דיו · Esc לצאת';
    this.helpTouch = 'החצים לזוז · A לירות';
    this.color = NEON.cyan;
    this.tint = '#0b0a26';
    this.perTicket = 120;
  }

  reset() {
    this.wave = 0;
    this.px = 500;
    this.newWave();
  }

  newWave() {
    this.wave++;
    const y0 = 110 + Math.min(5, this.wave - 1) * 18;
    this.foes = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) this.foes.push({ c, r, x: 220 + c * 62, y: y0 + r * 46, kind: KIND[r], alive: true, pop: 0 });
    this.dir = 1;
    this.stepT = 0;
    this.frame = 0;
    this.shots = [];
    this.drops = [];
    this.dropT = 1.5;
    this.sharp = null;
    this.sharpT = 14 + Math.random() * 8;
    this.dead = 0;
    this.pops = [];
    // the paper wads, cells of 10 eaten one by one
    this.wads = [];
    for (let k = 0; k < 4; k++) {
      const x0 = 160 + k * 210;
      for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) if (!(j === 3 && i > 2 && i < 6)) this.wads.push({ x: x0 + i * 10, y: 470 + j * 10, hp: 2 });
    }
  }

  step(dt, inp) {
    // you: the pen, along the foot
    if (this.dead > 0) {
      this.dead -= dt;
      if (this.dead <= 0) {
        if (this.lives <= 0) return this.over();
        this.px = 500;
      }
    } else {
      const d = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      this.px = Math.max(40, Math.min(960, this.px + d * 430 * dt));
      // (a finger on the screen: the pen goes under it)
      if (inp.drag) this.px += Math.max(-430 * dt, Math.min(430 * dt, inp.drag.x - this.px));
      this.cool = (this.cool || 0) - dt;
      const fire = inp.hit.has('a') || inp.hit.has('up') || inp.taps.length > 0 || ((inp.a || (inp.drag && inp.drag.down)) && this.cool < -0.15);
      if (fire && this.cool <= 0 && this.shots.length < 2) {
        this.shots.push({ x: this.px, y: PY - 26 });
        this.cool = 0.32;
        this.sfx('shoot', 0.8);
      }
    }
    // the page marches: a step at a time, quicker the fewer are left
    const alive = this.foes.filter((f) => f.alive);
    if (!alive.length) {
      this.add(500 * this.wave);
      this.sfx('win');
      this.flash = 0.6;
      this.newWave();
      return;
    }
    this.stepT -= dt;
    if (this.stepT <= 0) {
      this.stepT = 0.045 + 0.55 * (alive.length / (COLS * ROWS)) * Math.max(0.55, 1 - this.wave * 0.08);
      this.frame ^= 1;
      let edge = false;
      for (const f of alive) if ((this.dir > 0 && f.x > 945) || (this.dir < 0 && f.x < 55)) edge = true;
      if (edge) {
        this.dir = -this.dir;
        for (const f of alive) f.y += 22;
      } else for (const f of alive) f.x += this.dir * 12;
      this.sfx('blip', 0.35);
      for (const f of alive) if (f.y > PY - 30) return this.over();
    }
    // they drop smudges, from the lowest in a column
    this.dropT -= dt;
    if (this.dropT <= 0) {
      this.dropT = Math.max(0.35, 1.1 - this.wave * 0.1) * (0.5 + Math.random());
      const cols = new Map();
      for (const f of alive) if (!cols.has(f.c) || cols.get(f.c).y < f.y) cols.set(f.c, f);
      const list = [...cols.values()];
      // (more often from over you)
      list.sort((a, b) => Math.abs(a.x - this.px) - Math.abs(b.x - this.px));
      const f = Math.random() < 0.5 ? list[0] : list[Math.floor(Math.random() * list.length)];
      if (f) this.drops.push({ x: f.x, y: f.y + 16, ph: Math.random() * 6 });
    }
    // the sharpener across the top
    this.sharpT -= dt;
    if (this.sharpT <= 0 && !this.sharp) {
      const from = Math.random() < 0.5 ? -1 : 1;
      this.sharp = { x: from < 0 ? -40 : 1040, v: -from * 170 };
      this.sharpT = 16 + Math.random() * 10;
    }
    if (this.sharp) {
      this.sharp.x += this.sharp.v * dt;
      if (this.sharp.x < -60 || this.sharp.x > 1060) this.sharp = null;
    }
    // your shots
    for (const s of this.shots) {
      s.y -= 720 * dt;
      if (s.y < 50) s.dead = true;
      if (this.hitWad(s.x, s.y)) s.dead = true;
      for (const f of alive) {
        if (!s.dead && Math.abs(s.x - f.x) < 24 && Math.abs(s.y - f.y) < 18) {
          f.alive = false;
          s.dead = true;
          this.add(PTS[f.kind]);
          this.pops.push({ x: f.x, y: f.y, t: 0.35, c: f.kind === 'plane' ? NEON.cyan : f.kind === 'eraser' ? NEON.pink : NEON.violet });
          this.sfx('hit', 0.8);
        }
      }
      if (!s.dead && this.sharp && Math.abs(s.x - this.sharp.x) < 34 && Math.abs(s.y - 78) < 16) {
        const pts = [100, 150, 200, 300][Math.floor(Math.random() * 4)];
        this.add(pts);
        this.pops.push({ x: this.sharp.x, y: 78, t: 0.8, c: NEON.yellow, txt: `${pts}` });
        this.sharp = null;
        s.dead = true;
        this.sfx('power');
      }
    }
    this.shots = this.shots.filter((s) => !s.dead);
    // their smudges
    for (const d of this.drops) {
      d.y += (260 + this.wave * 15) * dt;
      d.ph += dt * 14;
      if (d.y > 590) d.dead = true;
      if (this.hitWad(d.x, d.y)) d.dead = true;
      if (!d.dead && this.dead <= 0 && Math.abs(d.x - this.px) < 22 && Math.abs(d.y - PY) < 20) {
        d.dead = true;
        this.lives--;
        this.dead = 1.6;
        this.drops.length = 0;
        this.flash = 0.8;
        this.pops.push({ x: this.px, y: PY, t: 0.9, c: NEON.yellow, big: true });
        this.sfx('boom');
      }
    }
    this.drops = this.drops.filter((d) => !d.dead);
    for (const p of this.pops) p.t -= dt;
    this.pops = this.pops.filter((p) => p.t > 0);
  }

  hitWad(x, y) {
    for (const w of this.wads) {
      if (w.hp > 0 && x > w.x - 2 && x < w.x + 12 && y > w.y - 2 && y < w.y + 12) {
        w.hp--;
        return true;
      }
    }
    return false;
  }

  render(g) {
    // the ground line
    glowLine(g, [[20, 580], [980, 580]], NEON.green, 2);
    // the wads
    for (const w of this.wads) {
      if (w.hp <= 0) continue;
      g.fillStyle = w.hp > 1 ? '#e9e4d0' : '#9d977f';
      g.fillRect(w.x, w.y, 10, 10);
    }
    const fr = this.frame;
    for (const f of this.foes) if (f.alive) foe(g, f.kind, f.x, f.y, fr, this.t);
    if (this.sharp) sharpener(g, this.sharp.x, 78, this.t);
    for (const s of this.shots) glowLine(g, [[s.x, s.y], [s.x, s.y + 16]], NEON.cyan, 4);
    for (const d of this.drops) {
      const pts = [];
      for (let i = 0; i < 5; i++) pts.push([d.x + Math.sin(d.ph + i * 1.3) * 5, d.y - 18 + i * 5]);
      glowLine(g, pts, NEON.pink, 3);
    }
    if (this.dead <= 0) pen(g, this.px, PY);
    for (const p of this.pops) {
      const k = 1 - p.t / (p.big ? 0.9 : 0.35);
      if (p.txt) {
        glowText(g, p.txt, p.x, p.y, 26, p.c);
        continue;
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r0 = 6 + k * (p.big ? 40 : 18);
        glowLine(g, [[p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0], [p.x + Math.cos(a) * (r0 + 8), p.y + Math.sin(a) * (r0 + 8)]], p.c, 3);
      }
    }
    glowText(g, `PAGE ${this.wave}`, 960, 568, 18, NEON.green, 'right');
  }

  lifeIcon(g, x, y) {
    pen(g, x, y + 8, 0.6);
  }
}

// the pen: a nib pointing up, gold
function pen(g, x, y, s = 1) {
  const P = (dx, dy) => [x + dx * s, y + dy * s];
  glowLine(g, [P(-20, 14), P(-12, -4), P(0, -24), P(12, -4), P(20, 14)], NEON.yellow, 3, true);
  glowLine(g, [P(0, -16), P(0, 2)], NEON.yellow, 2);
  glowCircle(g, x, y + 4 * s, 3 * s, NEON.yellow, 2);
}

// a sharpener: a box with its hole and blade
function sharpener(g, x, y, t) {
  glowLine(g, [[x - 30, y - 12], [x + 30, y - 12], [x + 30, y + 12], [x - 30, y + 12]], NEON.orange, 3, true);
  glowCircle(g, x - 10, y, 7, NEON.yellow, 2);
  glowLine(g, [[x + 6, y - 6], [x + 24, y - 6 + Math.sin(t * 10) * 3]], NEON.white, 2);
}

function foe(g, kind, x, y, fr, t) {
  if (kind === 'blot') {
    // an ink blot: a blob that wobbles, its eyes
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = 17 + Math.sin(a * 3 + fr * 1.7) * 3 + (i % 3 === 0 ? 3 : 0);
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.85]);
    }
    glowLine(g, pts, NEON.violet, 3, true, '#2a1460');
    g.fillStyle = '#fff';
    g.fillRect(x - 8, y - 5, 5, 6);
    g.fillRect(x + 3, y - 5, 5, 6);
    // (drips under it, the other step)
    glowLine(g, [[x - 6, y + 14], [x - 6, y + (fr ? 22 : 18)]], NEON.violet, 3);
    glowLine(g, [[x + 7, y + 14], [x + 7, y + (fr ? 18 : 23)]], NEON.violet, 3);
  } else if (kind === 'eraser') {
    // an eraser, tilting step to step, its brows down
    const a = fr ? 0.12 : -0.12;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const R = (dx, dy) => [x + dx * c - dy * s, y + dx * s + dy * c];
    glowLine(g, [R(-20, -12), R(20, -12), R(20, 12), R(-20, 12)], NEON.pink, 3, true, '#5a1838');
    glowLine(g, [R(0, -12), R(0, 12)], NEON.blue, 2);
    glowLine(g, [R(-12, -4), R(-5, -1)], NEON.white, 2);
    glowLine(g, [R(12, -4), R(5, -1)], NEON.white, 2);
  } else {
    // a paper plane, its wings up and down
    const w = fr ? 10 : 4;
    glowLine(g, [[x - 22, y - w], [x + 22, y + 2], [x - 22, y + 12], [x - 10, y + 2]], NEON.cyan, 3, true);
    glowLine(g, [[x - 10, y + 2], [x + 22, y + 2]], NEON.white, 2);
  }
}
