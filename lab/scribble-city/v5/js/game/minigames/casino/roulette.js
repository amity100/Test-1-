// (v5, ROADMAP 12.8) ROULETTE, on the table itself: the wheel at its end, seen from above as it
// turns, the ball running the other way round its rim until it drops into a pocket; the layout of
// numbers beside it, where your chips go - on a number (thirty-five to one), a column or a dozen (two
// to one), red or black, odd or even, low or high (even money). A finger or the mouse puts a chip
// where it points; or the arrows move the marker and A puts one there. SPIN, and the croupier's
// "no more bets".

import { felt, text, chip, button, inBox, sfx, GOLD, RED, FONT, CHIPS } from './felt.js';

const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WX = 210;
const WY = 290;
const WR = 175;
const SPIN_T = 5.2;
const colourOf = (n) => (n === 0 ? '#1e9a54' : REDS.has(n) ? RED : '#1a1a22');

// the layout's places to bet: their box, the numbers they win on, what they pay (the stake and so
// many times it)
const CELLS = (() => {
  const L = [];
  const X0 = 470;
  const Y0 = 110;
  const CW = 40;
  const CH = 86;
  L.push({ key: '0', x: 420, y: Y0, w: 50, h: CH * 3, nums: [0], pay: 36, label: '0' });
  for (let c = 0; c < 12; c++) {
    for (let r = 0; r < 3; r++) {
      const n = c * 3 + (3 - r);
      L.push({ key: `${n}`, x: X0 + c * CW, y: Y0 + r * CH, w: CW, h: CH, nums: [n], pay: 36, label: `${n}`, col: c, row: r });
    }
  }
  for (let r = 0; r < 3; r++) {
    const nums = [];
    for (let c = 0; c < 12; c++) nums.push(c * 3 + (3 - r));
    L.push({ key: `col${r}`, x: X0 + 12 * CW, y: Y0 + r * CH, w: 46, h: CH, nums, pay: 3, label: '2:1', col: 12, row: r });
  }
  const yD = Y0 + CH * 3;
  for (let d = 0; d < 3; d++) {
    const nums = [];
    for (let n = d * 12 + 1; n <= d * 12 + 12; n++) nums.push(n);
    L.push({ key: `doz${d}`, x: X0 + d * 160, y: yD, w: 160, h: 50, nums, pay: 3, label: ['1st 12', '2nd 12', '3rd 12'][d], row: 3, col: d * 4 });
  }
  const yE = yD + 50;
  const all = [];
  for (let n = 1; n <= 36; n++) all.push(n);
  const EV = [
    ['low', '1-18', all.filter((n) => n <= 18)],
    ['even', 'EVEN', all.filter((n) => n % 2 === 0)],
    ['red', 'RED', all.filter((n) => REDS.has(n))],
    ['black', 'BLACK', all.filter((n) => !REDS.has(n))],
    ['odd', 'ODD', all.filter((n) => n % 2 === 1)],
    ['high', '19-36', all.filter((n) => n > 18)],
  ];
  EV.forEach(([key, label, nums], i) => L.push({ key, x: X0 + i * 80, y: yE, w: 80, h: 50, nums, pay: 2, label, row: 4, col: i * 2 }));
  return L;
})();

export class Roulette {
  constructor(o = {}) {
    this.o = o;
    this.title = `${o.name || 'ROULETTE'} · רולטה`;
    this.help = 'עכבר: לשים צ׳יפ על המספר · חצים + רווח: אותו דבר · Enter: לסובב · B: להוריד · Esc לצאת';
    this.helpTouch = 'נוגעים במספר כדי לשים צ׳יפ, ואז SPIN';
    this.pad = 'pad';
    this.pointer = true;
    this.chips = o.vip ? [25, 100, 500, 1000] : [1, 5, 25, 100];
  }

  start(api) {
    this.api = api;
    this.t = 0;
    this.ci = 1;
    this.bets = new Map();
    this.placed = [];
    this.state = 'bet';
    this.wheel = 0;
    this.ball = 0;
    this.ballR = WR + 6;
    this.history = [];
    this.net = 0;
    this.spins = 0;
    this.cursor = CELLS.findIndex((c) => c.key === '17');
    this.msg = 'PLACE YOUR BETS';
    // (the other players' chips on the layout, for company)
    this.others = [];
    for (let i = 0; i < 7; i++) {
      const c = CELLS[Math.floor(Math.random() * CELLS.length)];
      this.others.push({ c, v: [5, 25, 1, 100][i % 4], dx: (Math.random() - 0.5) * 12, dy: (Math.random() - 0.5) * 12 });
    }
  }

  result() {
    return { net: this.net, spins: this.spins };
  }

  place(cell) {
    if (this.state !== 'bet') return;
    const v = this.chips[this.ci];
    const m = this.api.money;
    if (m && !m.pay(v, this.o.name || 'ROULETTE')) {
      this.msg = 'NOT ENOUGH CASH';
      sfx(this.api.audio, 'lose', 0.5);
      return;
    }
    this.net -= v;
    this.bets.set(cell.key, (this.bets.get(cell.key) || 0) + v);
    this.placed.push([cell.key, v]);
    sfx(this.api.audio, 'chip');
    this.msg = `ON THE TABLE: $${this.total()}`;
  }

  unplace() {
    if (this.state !== 'bet' || !this.placed.length) return;
    const [key, v] = this.placed.pop();
    const left = (this.bets.get(key) || 0) - v;
    if (left > 0) this.bets.set(key, left);
    else this.bets.delete(key);
    this.net += v;
    if (this.api.money) this.api.money.earn(v, this.o.name || 'ROULETTE');
    sfx(this.api.audio, 'chip', 0.6);
  }

  clear() {
    while (this.placed.length) this.unplace();
  }

  total() {
    let s = 0;
    for (const v of this.bets.values()) s += v;
    return s;
  }

  spin() {
    if (this.state !== 'bet' || !this.bets.size) {
      if (!this.bets.size) this.msg = 'PUT A CHIP DOWN FIRST';
      return;
    }
    this.state = 'spin';
    this.spinT = 0;
    this.spins++;
    this.res = Math.floor(Math.random() * 37);
    this.w0 = this.wheel;
    this.b0 = this.ball;
    this.msg = 'NO MORE BETS!';
    sfx(this.api.audio, 'tick');
  }

  settle() {
    const n = this.res;
    let win = 0;
    for (const [key, v] of this.bets) {
      const c = CELLS.find((q) => q.key === key);
      if (c && c.nums.includes(n)) win += v * c.pay;
    }
    this.history.unshift(n);
    this.history.length = Math.min(this.history.length, 10);
    if (win) {
      this.net += win;
      if (this.api.money) this.api.money.earn(win, this.o.name || 'ROULETTE');
      this.msg = `${n} ${n === 0 ? 'GREEN' : REDS.has(n) ? 'RED' : 'BLACK'} - YOU WIN $${win}!`;
      sfx(this.api.audio, win >= this.total() * 10 ? 'jackpot' : 'win');
    } else {
      this.msg = `${n} ${n === 0 ? 'GREEN' : REDS.has(n) ? 'RED' : 'BLACK'} - NO LUCK`;
      sfx(this.api.audio, 'lose');
    }
    this.lastBets = [...this.placed];
    this.bets.clear();
    this.placed = [];
    this.state = 'done';
    this.doneT = 0;
  }

  update(dt, inp) {
    this.t += dt;
    const tapped = inp.taps.map(([x, y]) => [x, y]);
    if (this.state === 'bet') {
      // the marker over the layout: the arrows move it a cell at a time
      const cur = CELLS[this.cursor];
      const move = (dc, dr) => {
        // (the nearest cell that way, the one most in line counting for more)
        const cx = cur.x + cur.w / 2;
        const cy = cur.y + cur.h / 2;
        let best = this.cursor;
        let bd = Infinity;
        CELLS.forEach((c, i) => {
          if (i === this.cursor) return;
          const ox = c.x + c.w / 2 - cx;
          const oy = c.y + c.h / 2 - cy;
          const along = ox * dc + oy * dr;
          if (along <= 1) return;
          const d = along + Math.abs(dc ? oy : ox) * 2;
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        this.cursor = best;
      };
      if (inp.hit.has('left')) move(-1, 0);
      if (inp.hit.has('right')) move(1, 0);
      if (inp.hit.has('up')) move(0, -1);
      if (inp.hit.has('down')) move(0, 1);
      if (inp.hit.has('a')) this.place(CELLS[this.cursor]);
      if (inp.hit.has('b')) this.unplace();
      if (inp.hit.has('enter')) this.spin();
      for (const [x, y] of tapped) {
        if (inBox(this.bSpin, x, y)) this.spin();
        else if (inBox(this.bClear, x, y)) this.clear();
        else {
          const k = (this.chipBoxes || []).findIndex((b) => inBox(b, x, y));
          if (k >= 0) {
            this.ci = k;
            sfx(this.api.audio, 'tick');
            continue;
          }
          const i = CELLS.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
          if (i >= 0) {
            this.cursor = i;
            this.place(CELLS[i]);
          }
        }
      }
    } else if (this.state === 'spin') {
      this.spinT += dt;
      const T = SPIN_T;
      const k = Math.min(1, this.spinT / T);
      // the wheel slows to a stop; the ball, the other way, slows faster, drops in, rides the wheel
      this.wheel = this.w0 + 9 * (k - (k * k) / 2) * 2;
      const pocket = (ORDER.indexOf(this.res) / ORDER.length) * Math.PI * 2;
      const end = this.w0 + 9 + pocket;
      const left = Math.pow(1 - k, 2);
      this.ball = end + 26 * left;
      this.ballR = k < 0.72 ? WR + 6 : WR + 6 - ((k - 0.72) / 0.28) * 52;
      this.tickT = (this.tickT || 0) - dt;
      if (this.tickT <= 0 && k > 0.6) {
        this.tickT = 0.06 + (k - 0.6) * 0.5;
        sfx(this.api.audio, 'tick', 0.8);
      }
      if (k >= 1) {
        this.ballR = WR - 46;
        this.settle();
      }
    } else if (this.state === 'done') {
      this.doneT += dt;
      // (the ball rides the wheel, still turning a little)
      this.wheel += dt * 0.15;
      this.ball += dt * 0.15;
      if (this.doneT > 1 && (inp.hit.has('a') || inp.hit.has('enter') || tapped.length)) {
        this.state = 'bet';
        this.msg = 'PLACE YOUR BETS';
      } else if (inp.hit.has('b')) this.api.finish(this.result());
    }
    if (this.state === 'bet') this.wheel += dt * 0.25;
  }

  draw(g, W, H) {
    felt(g, W, H, { c0: '#16784c', c1: '#0a3f28' });
    drawWheel(g, this.wheel, this.ball, this.ballR, this.state !== 'bet' || this.spins > 0);
    drawLayout(g, this.state === 'done' ? this.res : -1, this.t);
    for (const o of this.others) chip(g, o.c.x + o.c.w / 2 + o.dx, o.c.y + o.c.h / 2 + o.dy, o.v, 13);
    for (const [key, v] of this.bets) {
      const c = CELLS.find((q) => q.key === key);
      chip(g, c.x + c.w / 2, c.y + c.h / 2, v, 17);
    }
    if (this.state === 'bet') {
      const c = CELLS[this.cursor];
      g.strokeStyle = '#ffe14a';
      g.lineWidth = 4;
      g.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
    }
    // the history board, the chips to choose from, the buttons
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(420, 22, 560, 62);
    text(g, 'LAST', 450, 53, 18, GOLD);
    this.history.forEach((n, i) => {
      g.fillStyle = colourOf(n);
      g.beginPath();
      g.arc(505 + i * 46, 53, 19, 0, Math.PI * 2);
      g.fill();
      text(g, `${n}`, 505 + i * 46, 54, 18, '#fbf8f0');
    });
    this.chipBoxes = this.chips.map((v, i) => {
      const x = 470 + i * 62;
      chip(g, x + 26, 562, v, i === this.ci ? 26 : 21);
      if (i === this.ci) {
        g.strokeStyle = '#ffe14a';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(x + 26, 562, 30, 0, Math.PI * 2);
        g.stroke();
      }
      return [x, 532, 56, 60];
    });
    this.bClear = button(g, 730, 538, 110, 48, 'CLEAR', this.state === 'bet' && this.bets.size > 0);
    this.bSpin = button(g, 852, 538, 128, 48, 'SPIN', this.state === 'bet' && this.bets.size > 0, true);
    text(g, this.msg, WX, 515, this.state === 'done' ? 26 : 22, this.state === 'done' ? '#ffe14a' : '#fbf8f0');
    const cash = this.api.money ? Math.floor(this.api.money.cash) : 0;
    text(g, `CASH $${cash}`, WX, 560, 22, GOLD);
    void CHIPS;
  }
}

// the wheel from above: its rim of wood, the pockets red and black (the zero green), the numbers, the
// turret in the middle; the ball
function drawWheel(g, a, ba, br, ballOn) {
  g.save();
  g.translate(WX, WY);
  g.fillStyle = '#5a3418';
  g.beginPath();
  g.arc(0, 0, WR + 22, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#7a4a24';
  g.beginPath();
  g.arc(0, 0, WR + 12, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = GOLD;
  g.lineWidth = 3;
  g.stroke();
  const n = ORDER.length;
  for (let i = 0; i < n; i++) {
    const a0 = a + (i / n) * Math.PI * 2 - Math.PI / n;
    const a1 = a0 + (Math.PI * 2) / n;
    g.fillStyle = colourOf(ORDER[i]);
    g.beginPath();
    g.arc(0, 0, WR, a0, a1);
    g.arc(0, 0, WR - 46, a1, a0, true);
    g.closePath();
    g.fill();
    g.strokeStyle = GOLD;
    g.lineWidth = 1;
    g.stroke();
    const am = (a0 + a1) / 2;
    g.save();
    g.rotate(am);
    g.translate(WR - 18, 0);
    g.rotate(Math.PI / 2);
    g.font = FONT(13);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fbf8f0';
    g.fillText(`${ORDER[i]}`, 0, 0);
    g.restore();
  }
  g.fillStyle = '#3a2210';
  g.beginPath();
  g.arc(0, 0, WR - 46, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#8a5a2c';
  g.beginPath();
  g.arc(0, 0, WR - 70, 0, Math.PI * 2);
  g.fill();
  // the turret: its cross of gold, turning with the wheel
  g.rotate(a);
  g.strokeStyle = GOLD;
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(-42, 0);
  g.lineTo(42, 0);
  g.moveTo(0, -42);
  g.lineTo(0, 42);
  g.stroke();
  g.fillStyle = GOLD;
  g.beginPath();
  g.arc(0, 0, 14, 0, Math.PI * 2);
  g.fill();
  g.restore();
  if (ballOn) {
    g.fillStyle = '#fbf8f0';
    g.beginPath();
    g.arc(WX + Math.cos(ba) * br, WY + Math.sin(ba) * br, 8, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#8a8478';
    g.lineWidth = 1.5;
    g.stroke();
  }
}

// the layout: its cells, their numbers on red and black, the outside bets; the winning one lit
function drawLayout(g, win, t) {
  for (const c of CELLS) {
    const lit = win >= 0 && c.nums.includes(win) && Math.floor(t * 4) % 2 === 0;
    g.fillStyle = lit ? 'rgba(255,225,74,0.55)' : 'rgba(0,0,0,0)';
    g.fillRect(c.x, c.y, c.w, c.h);
    g.strokeStyle = '#f4f1e8';
    g.lineWidth = 2;
    g.strokeRect(c.x, c.y, c.w, c.h);
    if (c.nums.length === 1) {
      const n = c.nums[0];
      g.fillStyle = colourOf(n);
      g.beginPath();
      g.ellipse(c.x + c.w / 2, c.y + c.h / 2, c.w * 0.38, c.h * 0.3, 0, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.translate(c.x + c.w / 2, c.y + c.h / 2);
      g.rotate(-Math.PI / 2);
      text(g, c.label, 0, 1, 18, '#fbf8f0');
      g.restore();
    } else if (c.key === 'red' || c.key === 'black') {
      g.fillStyle = c.key === 'red' ? RED : '#1a1a22';
      g.beginPath();
      g.moveTo(c.x + c.w / 2, c.y + 8);
      g.lineTo(c.x + c.w - 16, c.y + c.h / 2);
      g.lineTo(c.x + c.w / 2, c.y + c.h - 8);
      g.lineTo(c.x + 16, c.y + c.h / 2);
      g.closePath();
      g.fill();
    } else text(g, c.label, c.x + c.w / 2, c.y + c.h / 2 + 1, 17, '#f4f1e8');
  }
}

// the tables' faces when nobody of yours plays: the wheel turning, a few chips down (for the hall)
export function paintRouletteIdle(g, w, h, t) {
  g.save();
  g.scale(w / 1000, h / 600);
  felt(g, 1000, 600, { c0: '#16784c', c1: '#0a3f28' });
  drawWheel(g, t * 0.8, -t * 2.2, WR + 6, true);
  drawLayout(g, -1, t);
  const R = [17, 'red', 'doz1', 32, 'odd', 5, 'col0', 23];
  R.forEach((k, i) => {
    const c = CELLS.find((q) => q.key === `${k}`);
    if (c) chip(g, c.x + c.w / 2 + (i % 3) * 4, c.y + c.h / 2, [5, 25, 1, 100][i % 4], 15);
  });
  g.restore();
}
