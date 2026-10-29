// (v5, ROADMAP 12.7) AIR HOCKEY, on the table itself: the game is the table's face (ui/minigame.js,
// a flat screen, along: its right the far end), you at its near end with your mallet, the one at
// the far end after the puck with theirs. The mallet follows your finger or the mouse on the table,
// or the arrows; the puck flies off it, off the rails. First to seven goals.

import { CabGame, NEON, glowText } from './cab.js';

const X0 = 26;
const X1 = 974;
const Y0 = 26;
const Y1 = 574;
const GOAL = [214, 386];
const RP = 24;
const RM = 36;
const WIN = 7;

export class AirHockey extends CabGame {
  constructor(o) {
    super(o);
    this.id = 'hockey';
    this.name = 'AIR HOCKEY';
    this.title = 'AIR HOCKEY · הוקי אוויר';
    this.help = 'העכבר על השולחן מזיז את המחבט · או החצים · Esc לצאת';
    this.helpTouch = 'אצבע על השולחן מזיזה את המחבט';
    this.color = NEON.cyan;
    this.lives0 = 1;
    this.hud = false;
    this.pointer = true;
  }

  reset() {
    this.me = { x: 160, y: 300, vx: 0, vy: 0 };
    this.cpu = { x: 840, y: 300, vx: 0, vy: 0 };
    this.goals = [0, 0];
    this.serve(1);
  }

  serve(to) {
    this.puck = { x: to > 0 ? 420 : 580, y: 300, vx: 0, vy: 0 };
    this.pause = 0.8;
  }

  // the hand on the table: where your mallet is (ui/minigame.js handsMove)
  handAt() {
    return [this.me.x, this.me.y];
  }

  ticketsFor() {
    return this.goals[0] * 2 + (this.goals[0] >= WIN ? 20 : 2);
  }

  step(dt, inp) {
    const m = this.me;
    const ox = m.x;
    const oy = m.y;
    // your mallet: under the finger, the mouse, or by the arrows
    const at = inp.drag || inp.hover;
    if (at) {
      m.x += (at.x - m.x) * Math.min(1, dt * 22);
      m.y += (at.y - m.y) * Math.min(1, dt * 22);
    }
    const kx = (inp.up ? 1 : 0) - (inp.down ? 1 : 0);
    const ky = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    m.x += kx * 760 * dt;
    m.y += ky * 760 * dt;
    m.x = Math.max(X0 + RM, Math.min(500 - RM, m.x));
    m.y = Math.max(Y0 + RM, Math.min(Y1 - RM, m.y));
    m.vx = (m.x - ox) / dt;
    m.vy = (m.y - oy) / dt;
    // theirs: back to guard the goal, out to strike when the puck is on their side
    const c = this.cpu;
    const cx0 = c.x;
    const cy0 = c.y;
    const p = this.puck;
    const lvl = Math.min(6, this.goals[0] + this.goals[1]);
    let tx = 880;
    let ty = 300 + (p.y - 300) * 0.6;
    if (p.x > 500 && (p.vx > -150 || p.x > 760)) {
      tx = p.x + 30;
      ty = p.y + (p.y > 300 ? 10 : -10);
    }
    const sp = 430 + lvl * 40;
    const dx = tx - c.x;
    const dy = ty - c.y;
    const dd = Math.hypot(dx, dy) || 1;
    const mv = Math.min(dd, sp * dt);
    c.x += (dx / dd) * mv;
    c.y += (dy / dd) * mv;
    c.x = Math.max(500 + RM, Math.min(X1 - RM, c.x));
    c.y = Math.max(Y0 + RM, Math.min(Y1 - RM, c.y));
    c.vx = (c.x - cx0) / dt;
    c.vy = (c.y - cy0) / dt;
    if (this.o.moveCpu) this.o.moveCpu((c.y - 300) / 300);
    if (this.pause > 0) {
      this.pause -= dt;
      return;
    }
    // the puck, in a few small steps
    const n = 3;
    for (let i = 0; i < n; i++) {
      const h = dt / n;
      p.x += p.vx * h;
      p.y += p.vy * h;
      const f = Math.exp(-0.25 * h);
      p.vx *= f;
      p.vy *= f;
      if (p.y < Y0 + RP) {
        p.y = Y0 + RP;
        p.vy = Math.abs(p.vy) * 0.92;
        this.sfx('wall', 0.5);
      }
      if (p.y > Y1 - RP) {
        p.y = Y1 - RP;
        p.vy = -Math.abs(p.vy) * 0.92;
        this.sfx('wall', 0.5);
      }
      const inGoal = p.y > GOAL[0] && p.y < GOAL[1];
      if (p.x < X0 + RP && !inGoal) {
        p.x = X0 + RP;
        p.vx = Math.abs(p.vx) * 0.92;
        this.sfx('wall', 0.5);
      }
      if (p.x > X1 - RP && !inGoal) {
        p.x = X1 - RP;
        p.vx = -Math.abs(p.vx) * 0.92;
        this.sfx('wall', 0.5);
      }
      if (p.x < X0 - 10 || p.x > X1 + 10) {
        const mine = p.x > 500;
        this.goals[mine ? 0 : 1]++;
        this.score = this.goals[0] * 100;
        this.flash = 0.5;
        this.sfx(mine ? 'win' : 'boom');
        this.goalT = 1.4;
        this.goalBy = mine ? 0 : 1;
        if (this.goals[0] >= WIN || this.goals[1] >= WIN) {
          this.overTitle = this.goals[0] >= WIN ? 'YOU WIN!' : 'THEY WIN';
          if (this.goals[0] >= WIN) this.score += 500;
          this.over();
          return;
        }
        this.serve(mine ? -1 : 1);
        return;
      }
      for (const q of [m, c]) {
        const ddx = p.x - q.x;
        const ddy = p.y - q.y;
        const d = Math.hypot(ddx, ddy);
        if (d < RP + RM && d > 0) {
          const nx = ddx / d;
          const ny = ddy / d;
          p.x = q.x + nx * (RP + RM + 0.5);
          p.y = q.y + ny * (RP + RM + 0.5);
          const rv = (p.vx - q.vx) * nx + (p.vy - q.vy) * ny;
          if (rv < 0) {
            p.vx -= 1.9 * rv * nx;
            p.vy -= 1.9 * rv * ny;
            this.sfx(Math.abs(rv) > 700 ? 'hit' : 'bounce', 0.7);
          }
        }
      }
      const s = Math.hypot(p.vx, p.vy);
      if (s > 1700) {
        p.vx *= 1700 / s;
        p.vy *= 1700 / s;
      }
    }
    if (this.goalT > 0) this.goalT -= dt;
  }

  render(g) {
    paintTable(g, 1, { puck: [this.puck.x, this.puck.y], m: [[this.me.x, this.me.y], [this.cpu.x, this.cpu.y]], goals: this.goals });
    if (this.goalT > 0 && this.scene === 'play') glowText(g, this.goalBy === 0 ? 'GOAL!' : 'THEIR GOAL', 500, 300, 80, this.goalBy === 0 ? NEON.green : NEON.red);
  }

  draw(g, W, H) {
    // (no tube: the table's own face, lit; the end of a game over it as on the cabinets)
    this.render(g, W, H);
    if (this.scene === 'ready') glowText(g, `${Math.max(1, Math.ceil(this.readyT / 0.8))}`, 500, 300, 90, NEON.yellow);
    if (this.scene === 'over') {
      g.fillStyle = 'rgba(5,4,11,0.6)';
      g.fillRect(0, 0, W, H);
      glowText(g, this.overTitle || 'GAME OVER', 500, 200, 76, NEON.pink);
      glowText(g, `${this.goals[0]} : ${this.goals[1]}`, 500, 300, 60, NEON.white);
      glowText(g, `+${this.won} TICKETS`, 500, 390, 44, NEON.green);
      if (this.overT > 1) glowText(g, this.touch ? 'TAP: AGAIN $1 · B: LEAVE' : 'CLICK: AGAIN $1   B: LEAVE', 500, 480, 30, NEON.cyan);
    }
  }
}

// the table's face: ice-white under its air holes, the lines, the goals, the score along its side,
// the puck and the two mallets (k: the canvas's pixels to the game's measure)
const _bg = new Map();
export function paintTable(g, k, T) {
  g.save();
  if (k !== 1) g.setTransform(k, 0, 0, k, 0, 0);
  const key = `${g.canvas.width}x${k}`;
  let bg = _bg.get(key);
  if (!bg) {
    bg = document.createElement('canvas');
    bg.width = Math.round(1000 * (k === 1 ? g.getTransform().a : k));
    bg.height = Math.round(600 * (k === 1 ? g.getTransform().a : k));
    const b = bg.getContext('2d');
    b.scale(bg.width / 1000, bg.height / 600);
    const gr = b.createLinearGradient(0, 0, 0, 600);
    gr.addColorStop(0, '#e6f4ff');
    gr.addColorStop(1, '#cfe6fb');
    b.fillStyle = gr;
    b.fillRect(0, 0, 1000, 600);
    b.fillStyle = 'rgba(40,60,100,0.25)';
    for (let x = 40; x < 1000; x += 30) for (let y = 36; y < 600; y += 30) b.fillRect(x, y, 3, 3);
    b.strokeStyle = '#e8333d';
    b.lineWidth = 6;
    b.beginPath();
    b.moveTo(500, 0);
    b.lineTo(500, 600);
    b.stroke();
    b.strokeStyle = '#2f6fe4';
    b.lineWidth = 5;
    b.beginPath();
    b.arc(500, 300, 90, 0, Math.PI * 2);
    b.stroke();
    for (const [x, s] of [[0, 1], [1000, -1]]) {
      b.beginPath();
      b.arc(x, 300, 130, -Math.PI / 2, Math.PI / 2, s < 0);
      b.stroke();
      b.fillStyle = '#1a1a2a';
      b.fillRect(x - (s > 0 ? 0 : 14), GOAL[0], 14, GOAL[1] - GOAL[0]);
    }
    b.strokeStyle = '#ff4fa8';
    b.lineWidth = 10;
    b.strokeRect(5, 5, 990, 590);
    _bg.set(key, bg);
  }
  g.drawImage(bg, 0, 0, 1000, 600);
  if (T.goals) {
    g.font = '700 54px "Permanent Marker", cursive';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(232,51,61,0.55)';
    g.fillText(`${T.goals[0]}`, 380, 300);
    g.fillStyle = 'rgba(47,111,228,0.55)';
    g.fillText(`${T.goals[1]}`, 620, 300);
  }
  const [px, py] = T.puck;
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.beginPath();
  g.arc(px + 4, py + 5, RP, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1b1b24';
  g.beginPath();
  g.arc(px, py, RP, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffd23f';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(px, py, RP - 7, 0, Math.PI * 2);
  g.stroke();
  T.m.forEach(([mx, my], i) => {
    const col = i === 0 ? '#e8333d' : '#2f6fe4';
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.beginPath();
    g.arc(mx + 5, my + 6, RM, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = col;
    g.beginPath();
    g.arc(mx, my, RM, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.arc(mx, my, RM * 0.62, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = col;
    g.beginPath();
    g.arc(mx, my, RM * 0.38, 0, Math.PI * 2);
    g.fill();
  });
  g.restore();
}
