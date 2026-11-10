// (v5, ROADMAP 12.8) INK FORTUNE: the casino's slot machine, played on its own screen in the hall.
// Three reels, one line across their middle; the bet a dollar, five or twenty-five (a hundred in
// the VIP room); the lever (A, or the screen tapped) spins them, they stop one by one, and what
// lines up pays by the table on the glass. The money is your own.

import { text, button, inBox, sfx, GOLD, RED, FONT, roundRect } from './felt.js';

const SYM = ['7', 'BAR', 'pen', 'bell', 'star', 'drop', 'cherry'];
// each reel's strip: the rare symbols few, the common many
const STRIP = ['cherry', 'drop', 'star', 'bell', 'drop', 'cherry', 'pen', 'drop', 'star', 'BAR', 'cherry', 'drop', 'bell', 'star', '7', 'drop', 'cherry', 'star', 'pen', 'drop', 'bell', 'cherry', 'BAR', 'star'];
const PAY = { 7: 100, BAR: 40, pen: 25, bell: 15, star: 10, drop: 8, cherry: 6 };

export class SlotGame {
  constructor(o = {}) {
    this.o = o;
    this.title = `${o.name || 'INK FORTUNE'} · מכונת מזל`;
    this.help = 'למעלה ולמטה לשנות הימור · רווח למשוך את הידית · Esc לצאת';
    this.helpTouch = 'נוגעים ב־SPIN · החצים לשנות הימור';
    this.pad = 'pad';
    this.pointer = true;
    this.bets = o.vip ? [25, 100, 500] : [1, 5, 25];
  }

  start(api) {
    this.api = api;
    this.bi = 0;
    this.t = 0;
    this.reels = [0, 1, 2].map((i) => ({ pos: Math.floor(Math.random() * STRIP.length), v: 0, stopAt: 0, spinning: false, i }));
    this.state = 'idle';
    this.won = 0;
    this.net = 0;
    this.spins = 0;
    this.msg = 'PULL THE LEVER!';
    this.flash = 0;
    this.lever = 0;
  }

  result() {
    return { net: this.net, spins: this.spins };
  }

  get bet() {
    return this.bets[this.bi];
  }

  spin() {
    if (this.state === 'spin') return;
    const m = this.api.money;
    if (m && !m.pay(this.bet, this.o.name || 'INK FORTUNE')) {
      this.msg = 'NOT ENOUGH CASH';
      sfx(this.api.audio, 'lose', 0.6);
      return;
    }
    this.net -= this.bet;
    this.spins++;
    this.state = 'spin';
    this.won = 0;
    this.msg = 'GOOD LUCK!';
    this.lever = 1;
    this.t0 = this.t;
    for (const r of this.reels) {
      r.spinning = true;
      r.v = 22 + Math.random() * 4;
      // where it lands: decided now, shown when it stops
      r.target = Math.floor(Math.random() * STRIP.length);
      r.stopAt = 0.9 + r.i * 0.45 + Math.random() * 0.15;
    }
    sfx(this.api.audio, 'chip', 0.8);
  }

  settle() {
    const line = this.reels.map((r) => STRIP[r.target]);
    let mult = 0;
    if (line[0] === line[1] && line[1] === line[2]) mult = PAY[line[0]];
    else if (line[0] === 'cherry' && line[1] === 'cherry') mult = 2;
    else if (line[0] === 'cherry') mult = 1;
    const win = mult * this.bet;
    this.state = 'idle';
    if (win > 0) {
      this.won = win;
      this.net += win;
      if (this.api.money) this.api.money.earn(win, this.o.name || 'INK FORTUNE');
      this.flash = mult >= 25 ? 3 : 1.4;
      this.msg = mult >= 25 ? `JACKPOT! $${win}` : `WIN $${win}`;
      sfx(this.api.audio, mult >= 25 ? 'jackpot' : 'win');
    } else {
      this.msg = 'TRY AGAIN';
    }
  }

  update(dt, inp) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.lever > 0) this.lever = Math.max(0, this.lever - dt * 2.2);
    if (this.state === 'idle') {
      if (inp.hit.has('up')) this.bi = Math.min(this.bets.length - 1, this.bi + 1);
      if (inp.hit.has('down')) this.bi = Math.max(0, this.bi - 1);
      if (inp.hit.has('a') || inp.hit.has('enter')) this.spin();
      for (const [x, y] of inp.taps) {
        if (inBox(this.bSpin, x, y)) this.spin();
        else if (inBox(this.bUp, x, y)) this.bi = Math.min(this.bets.length - 1, this.bi + 1);
        else if (inBox(this.bDown, x, y)) this.bi = Math.max(0, this.bi - 1);
      }
      if (inp.hit.has('b')) this.api.finish(this.result());
      return;
    }
    const el = this.t - this.t0;
    let all = true;
    for (const r of this.reels) {
      if (!r.spinning) continue;
      all = false;
      if (el >= r.stopAt) {
        r.spinning = false;
        r.pos = r.target;
        sfx(this.api.audio, 'stop', 0.8);
        continue;
      }
      r.pos = (r.pos + r.v * dt) % STRIP.length;
      this.tickT = (this.tickT || 0) - dt;
      if (this.tickT <= 0) {
        this.tickT = 0.07;
        sfx(this.api.audio, 'reel', 0.6);
      }
    }
    if (all || this.reels.every((r) => !r.spinning)) this.settle();
  }

  draw(g, W, H) {
    // the machine's face: deep red, gold, bulbs round the reels' window
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#5a0a1c');
    gr.addColorStop(1, '#22040c');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    const on = Math.floor(this.t * 6);
    for (let i = 0; i < 26; i++) {
      const x = 60 + i * 34.8;
      for (const y of [22, 578]) {
        g.fillStyle = (i + on) % 2 || this.flash > 0 ? '#ffe9a0' : '#7a5a20';
        g.beginPath();
        g.arc(x, y, 7, 0, Math.PI * 2);
        g.fill();
      }
    }
    text(g, this.o.name || 'INK FORTUNE', W / 2, 64, 56, GOLD);
    // the window, the reels in it
    const X0 = 170;
    const Y0 = 112;
    const RW = 200;
    const RH = 300;
    g.fillStyle = '#120408';
    roundRect(g, X0 - 14, Y0 - 14, RW * 3 + 28 + 40, RH + 28, 18);
    g.fill();
    g.strokeStyle = GOLD;
    g.lineWidth = 6;
    g.stroke();
    for (const r of this.reels) {
      const x = X0 + r.i * (RW + 20);
      const rg = g.createLinearGradient(0, Y0, 0, Y0 + RH);
      rg.addColorStop(0, '#9a9488');
      rg.addColorStop(0.2, '#fbf8f0');
      rg.addColorStop(0.8, '#fbf8f0');
      rg.addColorStop(1, '#9a9488');
      g.fillStyle = rg;
      g.fillRect(x, Y0, RW, RH);
      g.save();
      g.beginPath();
      g.rect(x, Y0, RW, RH);
      g.clip();
      const p = r.pos;
      const base = Math.floor(p);
      const frac = p - base;
      for (let k = -2; k <= 2; k++) {
        const s = STRIP[(base + k + STRIP.length * 4) % STRIP.length];
        const cy = Y0 + RH / 2 + (k - frac) * 110;
        if (r.spinning) g.globalAlpha = 0.55;
        symbol(g, s, x + RW / 2, cy, r.spinning);
        g.globalAlpha = 1;
      }
      g.restore();
    }
    // the line across the middle
    g.strokeStyle = this.flash > 0 && Math.floor(this.t * 8) % 2 ? '#ffffff' : RED;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(X0 - 10, Y0 + RH / 2);
    g.lineTo(X0 + RW * 3 + 50, Y0 + RH / 2);
    g.stroke();
    // the lever, at the side: down when pulled
    const ly = 150 + this.lever * 170;
    g.strokeStyle = '#c8c8d0';
    g.lineWidth = 12;
    g.beginPath();
    g.moveTo(925, 330);
    g.lineTo(925, ly);
    g.stroke();
    g.fillStyle = RED;
    g.beginPath();
    g.arc(925, ly, 26, 0, Math.PI * 2);
    g.fill();
    // the pay table, small, at the left
    g.textAlign = 'left';
    const rows = [['7 7 7', 100], ['BAR x3', 40], ['PEN x3', 25], ['BELL x3', 15], ['STAR x3', 10], ['DROP x3', 8], ['CHERRY x3', 6]];
    rows.forEach(([n, m], i) => {
      g.font = FONT(15);
      g.fillStyle = '#ffe9a0';
      g.fillText(`${n}`, 18, 130 + i * 30);
      g.fillStyle = '#fbf8f0';
      g.fillText(`x${m}`, 112, 130 + i * 30);
    });
    // the readouts: your cash, the bet, the win
    const cash = this.api.money ? this.api.money.cash : 0;
    box(g, 160, 448, 200, 64, 'CASH', `$${Math.floor(cash)}`);
    box(g, 400, 448, 200, 64, 'BET', `$${this.bet}`);
    box(g, 640, 448, 200, 64, 'WIN', this.won ? `$${this.won}` : '-');
    this.bDown = button(g, 400, 522, 60, 46, '−', this.state === 'idle');
    this.bUp = button(g, 540, 522, 60, 46, '+', this.state === 'idle');
    this.bSpin = button(g, 640, 522, 200, 46, 'SPIN', this.state === 'idle', true);
    text(g, this.msg, 270, 545, 26, this.flash > 0 ? '#ffe14a' : '#fbf8f0');
    if (this.flash > 1.5) {
      g.fillStyle = `rgba(255,225,74,${0.15 + 0.15 * Math.sin(this.t * 20)})`;
      g.fillRect(0, 0, W, H);
    }
  }
}

function box(g, x, y, w, h, label, value) {
  g.fillStyle = '#0a0204';
  roundRect(g, x, y, w, h, 10);
  g.fill();
  g.strokeStyle = GOLD;
  g.lineWidth = 2;
  g.stroke();
  text(g, label, x + 36, y + h / 2, 16, '#ffe9a0');
  text(g, value, x + w * 0.62, y + h / 2 + 1, 28, '#ff5a5a');
}

// the reels' pictures: drawn by hand, in the pens' colours
function symbol(g, s, x, y, blur) {
  g.save();
  g.translate(x, y);
  if (blur) g.scale(1, 1.25);
  g.lineWidth = 6;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (s === '7') {
    g.font = FONT(96);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#d8263a';
    g.fillText('7', 0, 4);
    g.strokeStyle = '#1a1a22';
    g.lineWidth = 2;
    g.strokeText('7', 0, 4);
  } else if (s === 'BAR') {
    g.fillStyle = '#1a1a22';
    roundRect(g, -70, -30, 140, 60, 10);
    g.fill();
    text(g, 'INK', 0, 2, 40, '#f2c14e');
  } else if (s === 'pen') {
    g.rotate(-0.7);
    g.fillStyle = '#2f6fe4';
    g.fillRect(-12, -46, 24, 70);
    g.fillStyle = '#f2c14e';
    g.beginPath();
    g.moveTo(-12, 24);
    g.lineTo(12, 24);
    g.lineTo(0, 50);
    g.closePath();
    g.fill();
    g.strokeStyle = '#1a1a22';
    g.lineWidth = 3;
    g.strokeRect(-12, -46, 24, 70);
  } else if (s === 'bell') {
    g.fillStyle = '#f2c14e';
    g.beginPath();
    g.moveTo(-40, 26);
    g.quadraticCurveTo(-34, -40, 0, -40);
    g.quadraticCurveTo(34, -40, 40, 26);
    g.closePath();
    g.fill();
    g.strokeStyle = '#7a5a10';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = '#7a5a10';
    g.beginPath();
    g.arc(0, 32, 9, 0, Math.PI * 2);
    g.fill();
  } else if (s === 'star') {
    g.fillStyle = '#ff9a3c';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 18 : 44;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = '#7a3a10';
    g.lineWidth = 3;
    g.stroke();
  } else if (s === 'drop') {
    g.fillStyle = '#24242c';
    g.beginPath();
    g.moveTo(0, -44);
    g.quadraticCurveTo(34, 0, 26, 18);
    g.arc(0, 18, 26, 0, Math.PI);
    g.quadraticCurveTo(-34, 0, 0, -44);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath();
    g.arc(-8, 10, 6, 0, Math.PI * 2);
    g.fill();
  } else {
    // cherries: two, their stems joined
    g.strokeStyle = '#1e7a3a';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(-20, 10);
    g.quadraticCurveTo(-10, -30, 10, -40);
    g.moveTo(22, 14);
    g.quadraticCurveTo(18, -20, 10, -40);
    g.stroke();
    for (const [cx, cy] of [[-22, 20], [22, 22]]) {
      g.fillStyle = '#d8263a';
      g.beginPath();
      g.arc(cx, cy, 20, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.arc(cx - 7, cy - 7, 5, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

// the idle machines' screens: the reels turning slowly, the name, now and then a win (for the hall)
export function paintSlotIdle(g, x, y, w, h, t, seed) {
  g.save();
  g.translate(x, y);
  g.scale(w / 1000, h / 600);
  g.fillStyle = '#3a0612';
  g.fillRect(0, 0, 1000, 600);
  text(g, 'INK FORTUNE', 500, 70, 72, GOLD);
  for (let i = 0; i < 3; i++) {
    const rx = 170 + i * 230;
    g.fillStyle = '#fbf8f0';
    g.fillRect(rx, 140, 200, 300);
    const p = (t * (1.5 + i * 0.4) + seed * 3 + i * 7) % STRIP.length;
    const b = Math.floor(p);
    for (let k = -1; k <= 1; k++) symbol(g, STRIP[(b + k + STRIP.length) % STRIP.length], rx + 100, 290 + (k - (p - b)) * 110, false);
  }
  g.strokeStyle = RED;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(150, 290);
  g.lineTo(850, 290);
  g.stroke();
  text(g, Math.floor(t + seed) % 7 === 0 ? 'WINNER!' : 'PLAY ME', 500, 520, 54, Math.floor(t * 3) % 2 ? '#ffe14a' : '#fbf8f0');
  g.restore();
}

export { SYM };
