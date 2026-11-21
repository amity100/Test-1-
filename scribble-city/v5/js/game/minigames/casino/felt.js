// (v5, ROADMAP 12.8) What the casino's games are drawn with: the green of the felt, the gold of its
// lines, the cards (their corners and their pips, drawn by hand), the chips in their colours, the
// buttons painted on the table that a finger or the mouse presses. The money is the city's own
// (game/money.js): a bet goes from your cash, a win comes back to it.

import { MARKER } from '../ink2d.js';

export const GOLD = '#f2c14e';
export const FELT = '#0f5a3a';
export const FELT_D = '#0a4029';
export const RED = '#d8263a';
export const FONT = (px) => `700 ${px}px ${MARKER}`;
export const CHIPS = [
  { v: 1, c: '#f4f1e8', e: '#3a6fd8' },
  { v: 5, c: '#d8263a', e: '#f4f1e8' },
  { v: 25, c: '#1e9a54', e: '#f4f1e8' },
  { v: 100, c: '#1a1a22', e: '#f2c14e' },
  { v: 500, c: '#7b3fd0', e: '#f2c14e' },
  { v: 1000, c: '#f2c14e', e: '#7a1424' },
];

// the felt: its green, lighter in the middle, its edge of padded leather
export function felt(g, W, H, o = {}) {
  const gr = g.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H / 2, W * 0.7);
  gr.addColorStop(0, o.c0 || '#177a50');
  gr.addColorStop(1, o.c1 || FELT_D);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.04)';
  g.lineWidth = 1;
  for (let y = 4; y < H; y += 7) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y + 3);
    g.stroke();
  }
}

export function text(g, s, x, y, px, color, align = 'center') {
  g.font = FONT(px);
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(s, x, y);
}

// a chip seen from above: its colour, the notches round its edge, its value
export function chip(g, x, y, v, r = 22) {
  const C = CHIPS.slice().reverse().find((c) => v >= c.v) || CHIPS[0];
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.arc(x + 2, y + 3, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = C.c;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = C.e;
  g.lineWidth = r * 0.22;
  g.setLineDash([r * 0.35, r * 0.35]);
  g.beginPath();
  g.arc(x, y, r * 0.86, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.lineWidth = 1.5;
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  g.beginPath();
  g.arc(x, y, r * 0.62, 0, Math.PI * 2);
  g.stroke();
  text(g, v >= 1000 ? `${v / 1000}K` : `${v}`, x, y + 1, r * 0.7, C.v === 100 || C.v === 500 ? '#f4f1e8' : '#1a1a22');
}

// a stack of chips for a sum: the biggest under
export function stack(g, x, y, sum, r = 20) {
  let left = sum;
  let k = 0;
  const list = [];
  for (const C of CHIPS.slice().reverse()) {
    while (left >= C.v && list.length < 8) {
      list.push(C.v);
      left -= C.v;
    }
  }
  for (const v of list) chip(g, x, y - k++ * 5, v, r);
}

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// a card: face down (its back's pattern) or up (its corner, its big suit), tilted a little
export function card(g, x, y, c, o = {}) {
  const w = o.w || 86;
  const h = o.h || 122;
  g.save();
  g.translate(x, y);
  g.rotate(o.tilt || 0);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  g.fillStyle = '#fbf8f0';
  roundRect(g, -w / 2, -h / 2, w, h, 8);
  g.fill();
  g.strokeStyle = '#24242c';
  g.lineWidth = 2;
  g.stroke();
  if (!c || o.down) {
    g.fillStyle = '#7a1424';
    roundRect(g, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 5);
    g.fill();
    g.strokeStyle = GOLD;
    g.lineWidth = 1.5;
    for (let i = -6; i < 8; i++) {
      g.beginPath();
      g.moveTo(-w / 2 + 6 + i * 12, -h / 2 + 6);
      g.lineTo(-w / 2 + 6 + i * 12 + 50, h / 2 - 6);
      g.stroke();
    }
    g.restore();
    return;
  }
  const red = c.s === 1 || c.s === 2;
  const col = red ? RED : '#1a1a22';
  text(g, RANKS[c.r], -w / 2 + 16, -h / 2 + 18, 22, col);
  text(g, SUITS[c.s], -w / 2 + 16, -h / 2 + 40, 18, col);
  text(g, SUITS[c.s], 4, 8, 52, col);
  g.restore();
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

// a button painted on the table: its box (lit when it can be pressed), its word; returns its box
export function button(g, x, y, w, h, label, on = true, hot = false) {
  g.fillStyle = on ? (hot ? '#f2c14e' : 'rgba(0,0,0,0.35)') : 'rgba(0,0,0,0.15)';
  roundRect(g, x, y, w, h, 12);
  g.fill();
  g.strokeStyle = on ? GOLD : 'rgba(242,193,78,0.3)';
  g.lineWidth = 3;
  g.stroke();
  text(g, label, x + w / 2, y + h / 2 + 1, Math.min(30, h * 0.5), on ? (hot ? '#1a1a22' : '#fbf8f0') : 'rgba(251,248,240,0.35)');
  return [x, y, w, h];
}

export const inBox = (b, x, y) => b && x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3];

// a fresh shoe of six decks, shuffled
export function shoe(rng = Math.random, decks = 6) {
  const s = [];
  for (let d = 0; d < decks; d++) for (let su = 0; su < 4; su++) for (let r = 0; r < 13; r++) s.push({ r, s: su });
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

// the casino's sounds: chips on felt, a card dealt, the wheel's ball, the win
export function sfx(audio, kind, vol = 1) {
  if (!audio || !audio.ctx || !audio.enabled || audio.ctx.state !== 'running') return;
  const v = vol;
  switch (kind) {
    case 'chip':
      audio.tone('triangle', 2400, 1900, 0.04, 0.05 * v);
      audio.hiss(0.03, 0.08 * v, 5000, 2);
      break;
    case 'card':
      audio.hiss(0.07, 0.12 * v, 3000, 1.2, 'bandpass', 0, 1200);
      break;
    case 'tick':
      audio.tone('square', 1800, 1700, 0.015, 0.025 * v);
      break;
    case 'win':
      for (let i = 0; i < 5; i++) audio.tone('triangle', [523, 659, 784, 1046, 1318][i], [523, 659, 784, 1046, 1318][i], 0.14, 0.06 * v, i * 0.08);
      break;
    case 'jackpot':
      for (let i = 0; i < 12; i++) audio.tone('square', 880 + (i % 4) * 220, 880 + (i % 4) * 220, 0.08, 0.05 * v, i * 0.07);
      break;
    case 'lose':
      audio.tone('triangle', 330, 220, 0.3, 0.05 * v);
      break;
    case 'reel':
      audio.tone('square', 220, 200, 0.03, 0.02 * v);
      break;
    case 'stop':
      audio.tone('triangle', 600, 300, 0.06, 0.06 * v);
      break;
    default:
      audio.tone('triangle', 660, 660, 0.05, 0.04 * v);
  }
}
