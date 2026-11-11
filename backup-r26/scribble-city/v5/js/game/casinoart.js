// (v5, ROADMAP 12.8) The pictures PALACE OF INK is dressed in, painted once on canvases: the red carpet
// with its gold scrolls, the damask of the walls, the coffers of the ceiling (their edges lit), the
// tower's windows (some lit, at random, the same every night), the bar's shelves of bottles, the
// stage's curtain. (The tables' faces and the machines' screens are the games, game/casino.js.)

import { MARKER } from './minigames/ink2d.js';

const C = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const rnd = (s) => () => {
  s = (s * 16807) % 2147483647;
  return (s - 1) / 2147483646;
};
const GOLD = '#d9a93a';

// the carpet: deep red, gold scrolls round a lozenge, small fleurs between (one tile, repeated)
export function paintCarpet(n = 512) {
  const c = C(n, n);
  const g = c.getContext('2d');
  const k = n / 512;
  g.fillStyle = '#6a0f1c';
  g.fillRect(0, 0, n, n);
  g.strokeStyle = GOLD;
  g.lineCap = 'round';
  const scroll = (x, y, s, a) => {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.lineWidth = 5 * k;
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const r = s * (1 - t * 0.8);
      const b = t * Math.PI * 2.4;
      g.lineTo(Math.cos(b) * r, Math.sin(b) * r);
    }
    g.stroke();
    g.restore();
  };
  // the lozenge in the middle, its scrolls at its points
  g.lineWidth = 6 * k;
  g.beginPath();
  g.moveTo(n / 2, n * 0.18);
  g.lineTo(n * 0.82, n / 2);
  g.lineTo(n / 2, n * 0.82);
  g.lineTo(n * 0.18, n / 2);
  g.closePath();
  g.stroke();
  g.fillStyle = '#4a0a14';
  g.fill();
  for (const [x, y, a] of [[n / 2, n * 0.18, 0], [n * 0.82, n / 2, Math.PI / 2], [n / 2, n * 0.82, Math.PI], [n * 0.18, n / 2, -Math.PI / 2]]) {
    scroll(x - 20 * k, y, 26 * k, a);
    scroll(x + 20 * k, y, 26 * k, a + Math.PI);
  }
  // the fleur in its middle, the corners'
  const fleur = (x, y, s) => {
    g.fillStyle = GOLD;
    g.beginPath();
    g.ellipse(x, y - s * 0.4, s * 0.25, s * 0.6, 0, 0, Math.PI * 2);
    g.fill();
    for (const d of [-1, 1]) {
      g.beginPath();
      g.ellipse(x + d * s * 0.45, y - s * 0.1, s * 0.2, s * 0.45, d * 0.7, 0, Math.PI * 2);
      g.fill();
    }
    g.fillRect(x - s * 0.5, y + s * 0.2, s, s * 0.12);
  };
  fleur(n / 2, n / 2, 40 * k);
  for (const [x, y] of [[0, 0], [n, 0], [0, n], [n, n]]) fleur(x, y, 34 * k);
  // the border lines
  g.strokeStyle = 'rgba(217,169,58,0.6)';
  g.lineWidth = 2 * k;
  for (const d of [10, 18]) g.strokeRect(d * k, d * k, n - 2 * d * k, n - 2 * d * k);
  return c;
}

// the walls' damask: burgundy, its pattern a shade lighter
export function paintDamask(n = 256) {
  const c = C(n, n);
  const g = c.getContext('2d');
  g.fillStyle = '#5a0c1a';
  g.fillRect(0, 0, n, n);
  g.fillStyle = '#7a1a2c';
  const motif = (x, y, s) => {
    g.beginPath();
    g.moveTo(x, y - s);
    g.bezierCurveTo(x + s * 0.8, y - s * 0.6, x + s * 0.5, y + s * 0.3, x, y + s);
    g.bezierCurveTo(x - s * 0.5, y + s * 0.3, x - s * 0.8, y - s * 0.6, x, y - s);
    g.fill();
    for (const d of [-1, 1]) {
      g.beginPath();
      g.ellipse(x + d * s * 0.7, y + s * 0.1, s * 0.18, s * 0.4, d * 0.5, 0, Math.PI * 2);
      g.fill();
    }
  };
  motif(n / 2, n / 2, n * 0.28);
  for (const [x, y] of [[0, 0], [n, 0], [0, n], [n, n]]) motif(x, y, n * 0.28);
  return c;
}

// the ceiling's coffers: cream squares sunk in gold frames, a line of light round each
export function paintCoffers(n = 256) {
  const c = C(n, n);
  const g = c.getContext('2d');
  g.fillStyle = '#3a2a14';
  g.fillRect(0, 0, n, n);
  const m = n * 0.1;
  g.fillStyle = '#f2e6c8';
  g.fillRect(m, m, n - 2 * m, n - 2 * m);
  g.strokeStyle = GOLD;
  g.lineWidth = n * 0.04;
  g.strokeRect(m, m, n - 2 * m, n - 2 * m);
  g.strokeStyle = '#fff2c8';
  g.lineWidth = n * 0.015;
  g.strokeRect(m * 1.6, m * 1.6, n - 3.2 * m, n - 3.2 * m);
  g.fillStyle = GOLD;
  g.beginPath();
  g.arc(n / 2, n / 2, n * 0.08, 0, Math.PI * 2);
  g.fill();
  // its glow: only the lines of light (the emissive picture)
  const e = C(n, n);
  const h = e.getContext('2d');
  h.fillStyle = '#000';
  h.fillRect(0, 0, n, n);
  // (the coffers themselves a little lit: the light the chandeliers throw up into them)
  h.fillStyle = '#3a2a14';
  h.fillRect(m, m, n - 2 * m, n - 2 * m);
  h.strokeStyle = '#ffd890';
  h.lineWidth = n * 0.02;
  h.strokeRect(m * 1.6, m * 1.6, n - 3.2 * m, n - 3.2 * m);
  h.fillStyle = '#ffe0a0';
  h.beginPath();
  h.arc(n / 2, n / 2, n * 0.05, 0, Math.PI * 2);
  h.fill();
  return { c, e };
}

// the tower's face: rows of windows in the stone - dark glass by day; at night (its glow, e) most of
// them lit warm, a few dark, at random, the same every night
export function paintTowerWindows(w = 256, h = 512) {
  const c = C(w, h);
  const e = C(w, h);
  const g = c.getContext('2d');
  const q = e.getContext('2d');
  g.fillStyle = '#e9dcc0';
  g.fillRect(0, 0, w, h);
  q.fillStyle = '#000';
  q.fillRect(0, 0, w, h);
  const R = rnd(91);
  const cols = 8;
  const rows = 16;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const x = (k + 0.18) * (w / cols);
      const y = (r + 0.2) * (h / rows);
      const ww = (w / cols) * 0.64;
      const hh = (h / rows) * 0.6;
      g.fillStyle = R() < 0.5 ? '#3a4a66' : '#4a5a78';
      g.fillRect(x, y, ww, hh);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, ww * 0.3, hh);
      if (R() < 0.66) {
        q.fillStyle = R() < 0.3 ? '#ffc870' : '#ffe0a0';
        q.fillRect(x, y, ww, hh);
      }
    }
    g.fillStyle = '#c9b48a';
    g.fillRect(0, (r + 0.88) * (h / rows), w, 3);
  }
  return { c, e };
}

// the bar's back: three shelves of bottles in a lit mirror
export function paintBottles(w = 512, h = 256) {
  const c = C(w, h);
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#3a2a1a');
  gr.addColorStop(1, '#1a120a');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  const R = rnd(17);
  const COLS = ['#7a3a14', '#2a6a3a', '#d9a93a', '#8a1a2a', '#e8e0c8', '#3a4a8a', '#c86a1a'];
  for (let s = 0; s < 3; s++) {
    const y = (s + 1) * (h / 3) - 8;
    g.fillStyle = '#d9a93a';
    g.fillRect(0, y, w, 6);
    let x = 6;
    while (x < w - 20) {
      const bw = 12 + R() * 10;
      const bh = 40 + R() * 30;
      g.fillStyle = COLS[Math.floor(R() * COLS.length)];
      g.fillRect(x, y - bh * 0.7, bw, bh * 0.7);
      g.fillRect(x + bw * 0.35, y - bh, bw * 0.3, bh * 0.3);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x + 2, y - bh * 0.66, 2, bh * 0.5);
      x += bw + 4 + R() * 6;
    }
  }
  return c;
}

// the stage's curtain: red velvet in folds, gold fringe
export function paintCurtain(w = 256, h = 256) {
  const c = C(w, h);
  const g = c.getContext('2d');
  for (let x = 0; x < w; x++) {
    const f = 0.55 + 0.45 * Math.sin((x / w) * Math.PI * 12);
    g.fillStyle = `rgb(${Math.round(120 + 90 * f)},${Math.round(10 + 18 * f)},${Math.round(24 + 20 * f)})`;
    g.fillRect(x, 0, 1, h);
  }
  g.fillStyle = '#d9a93a';
  g.fillRect(0, h - 14, w, 14);
  return c;
}

// the names in gold over the games: a row each (CASINO_SIGNS[name] = [u0, v0, u1, v1])
export const CASINO_SIGNS = ['INK FORTUNE', 'BLACKJACK', 'ROULETTE', 'THE CAGE', 'THE INKWELL BAR', 'LIVE TONIGHT: LADY INKWELL', 'VIP', 'HIGH LIMIT'];
export function paintSigns(w = 1024, h = 512) {
  const c = C(w, h);
  const g = c.getContext('2d');
  const ch = h / CASINO_SIGNS.length;
  const boxes = {};
  CASINO_SIGNS.forEach((t, i) => {
    const y = i * ch;
    const gr = g.createLinearGradient(0, y, 0, y + ch);
    gr.addColorStop(0, '#1a0a06');
    gr.addColorStop(1, '#2a140a');
    g.fillStyle = gr;
    g.fillRect(0, y, w, ch);
    g.strokeStyle = GOLD;
    g.lineWidth = 4;
    g.strokeRect(6, y + 5, w - 12, ch - 10);
    g.font = `700 ${Math.round(ch * 0.55)}px ${MARKER}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffe2a0';
    g.fillText(t, w / 2, y + ch * 0.55);
    // (the box round the word only, framed again: a short word's sign is short)
    const tw = Math.min(w - 12, g.measureText(t).width + ch * 0.9);
    const x0 = (w - tw) / 2;
    g.strokeStyle = GOLD;
    g.lineWidth = 4;
    g.strokeRect(x0 + 2, y + 5, tw - 4, ch - 10);
    boxes[t] = { uv: [x0 / w, 1 - (y + ch) / h, (x0 + tw) / w, 1 - y / h], aspect: tw / ch };
  });
  return { c, boxes };
}
