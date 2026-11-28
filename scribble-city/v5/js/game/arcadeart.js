// (v5, ROADMAP 12.7) The pictures INK ARCADE is dressed in, painted once on canvases: the carpet
// that glows under the black light, the band of sunset round the walls, the cabinets' lit names over
// their screens, the wall of prizes behind the counter, the pizza bar's menu, the hall of fame, the
// pinball's field. (The screens themselves are the games, game/arcade.js.)

import { MARKER } from './minigames/ink2d.js';
import { NEON } from './minigames/arcade/cab.js';

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
const PAL = [NEON.pink, NEON.cyan, NEON.yellow, NEON.green, NEON.violet, NEON.orange];

// the carpet: dark blue, the shapes of the old arcades' carpets on it - squiggles, triangles, rings,
// zigzags, stars - glowing under the black light (one tile, repeated)
export function paintCarpet(n = 512) {
  const c = C(n, n);
  const g = c.getContext('2d');
  g.fillStyle = '#0c0a24';
  g.fillRect(0, 0, n, n);
  const R = rnd(7);
  const k = n / 512;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // (the shapes repeat across the tile's edges: drawn again a tile over where they cross)
  const shape = (f) => {
    for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) {
      g.save();
      g.translate(dx, dy);
      f();
      g.restore();
    }
  };
  for (let i = 0; i < 46; i++) {
    const x = R() * n;
    const y = R() * n;
    const col = PAL[Math.floor(R() * PAL.length)];
    const kind = Math.floor(R() * 5);
    const s = (14 + R() * 26) * k;
    const a = R() * Math.PI * 2;
    shape(() => {
      g.strokeStyle = col;
      g.fillStyle = col;
      g.lineWidth = 5 * k;
      g.translate(x, y);
      g.rotate(a);
      g.beginPath();
      if (kind === 0) {
        // a squiggle
        for (let j = 0; j <= 8; j++) g.lineTo(-s + (j * s) / 4, Math.sin(j * 1.6) * s * 0.35);
        g.stroke();
      } else if (kind === 1) {
        g.moveTo(0, -s * 0.7);
        g.lineTo(s * 0.6, s * 0.5);
        g.lineTo(-s * 0.6, s * 0.5);
        g.closePath();
        g.stroke();
      } else if (kind === 2) {
        g.arc(0, 0, s * 0.5, 0, Math.PI * 2);
        g.stroke();
      } else if (kind === 3) {
        for (let j = 0; j <= 5; j++) g.lineTo(-s + (j * s * 2) / 5, j % 2 ? -s * 0.3 : s * 0.3);
        g.stroke();
      } else {
        for (let j = 0; j < 10; j++) {
          const r = j % 2 ? s * 0.22 : s * 0.55;
          const b = -Math.PI / 2 + (j * Math.PI) / 5;
          g.lineTo(Math.cos(b) * r, Math.sin(b) * r);
        }
        g.closePath();
        g.fill();
      }
    });
  }
  // (the confetti between them)
  for (let i = 0; i < 260; i++) {
    g.fillStyle = PAL[Math.floor(R() * PAL.length)];
    g.globalAlpha = 0.5;
    g.fillRect(R() * n, R() * n, 3 * k, 3 * k);
  }
  g.globalAlpha = 1;
  return c;
}

// the band round the walls: a sunset over a grid, mountains, palms (it repeats along the wall)
export function paintMural(w = 1024, h = 256) {
  const c = C(w, h);
  const g = c.getContext('2d');
  const hz = h * 0.6;
  const sky = g.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#0d0624');
  sky.addColorStop(0.6, '#4a1258');
  sky.addColorStop(1, '#ff5a8a');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, hz);
  const R = rnd(3);
  g.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 70; i++) g.fillRect(R() * w, R() * hz * 0.6, 2, 2);
  // two suns along the tile (it is long)
  for (const sx of [w * 0.25, w * 0.75]) {
    const sg = g.createLinearGradient(0, hz - h * 0.4, 0, hz);
    sg.addColorStop(0, '#ffe14a');
    sg.addColorStop(1, '#ff4fa8');
    g.fillStyle = sg;
    g.beginPath();
    g.arc(sx, hz, h * 0.36, Math.PI, 0);
    g.fill();
    g.fillStyle = '#4a1258';
    for (let i = 0; i < 5; i++) g.fillRect(sx - h * 0.4, hz - h * 0.2 + i * h * 0.04, h * 0.8, 2 + i * 1.5);
  }
  // the mountains, outlined
  g.fillStyle = '#1a0630';
  g.beginPath();
  g.moveTo(0, hz);
  const pts = [];
  for (let i = 0; i <= 32; i++) {
    const x = (i / 32) * w;
    const y = hz - Math.abs(Math.sin(i * 1.3) * h * 0.18 + Math.sin(i * 0.5) * h * 0.1);
    pts.push([x, y]);
    g.lineTo(x, y);
  }
  g.lineTo(w, hz);
  g.fill();
  g.strokeStyle = NEON.pink;
  g.lineWidth = 3;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  // the grid below the horizon
  g.fillStyle = '#120420';
  g.fillRect(0, hz, w, h - hz);
  g.strokeStyle = NEON.violet;
  g.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const y = hz + Math.pow(i / 6, 1.8) * (h - hz);
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  for (let i = -24; i <= 24; i++) {
    for (const cx of [w * 0.25, w * 0.75]) {
      g.beginPath();
      g.moveTo(cx + i * 6, hz);
      g.lineTo(cx + i * 60, h);
      g.stroke();
    }
  }
  // palms, black against it
  g.strokeStyle = '#0a0214';
  g.fillStyle = '#0a0214';
  for (const px of [w * 0.08, w * 0.46, w * 0.55, w * 0.93]) {
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(px, h);
    g.quadraticCurveTo(px + 14, h * 0.6, px + 6, h * 0.3);
    g.stroke();
    g.lineWidth = 6;
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(px + 6, h * 0.3);
      g.quadraticCurveTo(px + 6 + Math.cos(a) * 30, h * 0.3 - 14, px + 6 + Math.cos(a) * 52, h * 0.3 + 18 + Math.sin(a) * 8);
      g.stroke();
    }
  }
  return c;
}

// the cabinets' names, lit, a row each (2 across, 8 down: MARQUEE[name] = [u0, v0, u1, v1])
export const MARQUEES = ['INK INVADERS', 'PEN-MAN', 'INKTRIS', 'DOODLE SNAKE', 'PAPER PONG', 'BRICK SKETCH', 'INK RALLY', 'INK BEAT', 'INK WIZARD', 'SKEE-INK', 'HOOP DREAMS', 'CLAW-SOME', 'PHOTO INK', 'PRIZES', 'PIXEL PIZZA', 'INK CARD'];
export function paintMarquees(w = 1024, h = 512) {
  const c = C(w, h);
  const g = c.getContext('2d');
  const cw = w / 2;
  const ch = h / 8;
  const boxes = {};
  MARQUEES.forEach((t, i) => {
    const x = (i % 2) * cw;
    const y = Math.floor(i / 2) * ch;
    const col = PAL[i % PAL.length];
    const gr = g.createLinearGradient(0, y, 0, y + ch);
    gr.addColorStop(0, '#1a0a30');
    gr.addColorStop(1, '#0a0418');
    g.fillStyle = gr;
    g.fillRect(x, y, cw, ch);
    g.strokeStyle = col;
    g.lineWidth = 4;
    g.strokeRect(x + 4, y + 4, cw - 8, ch - 8);
    // (bulbs along its edge)
    g.fillStyle = '#fff2b0';
    for (let k = 0; k < 14; k++) g.fillRect(x + 14 + k * ((cw - 28) / 13) - 2, y + 9, 4, 4);
    g.font = `700 ${Math.round(ch * 0.56)}px ${MARKER}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = col;
    g.globalAlpha = 0.35;
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) g.fillText(t, x + cw / 2 + dx, y + ch * 0.58 + dy);
    g.globalAlpha = 1;
    g.fillStyle = '#fffdf6';
    g.fillText(t, x + cw / 2, y + ch * 0.58);
    boxes[t] = [x / w, 1 - (y + ch) / h, (x + cw) / w, 1 - y / h];
  });
  return { c, boxes };
}

// the prizes on their shelves: soft toys with faces, boxes, jars of sweets, their prices in tickets
export function paintPrizes(w = 1024, h = 256) {
  const c = C(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#1a0e2a';
  g.fillRect(0, 0, w, h);
  const R = rnd(11);
  const shelves = [h * 0.33, h * 0.66, h * 0.98];
  for (const y of shelves) {
    g.fillStyle = '#c8a2ff';
    g.fillRect(0, y - 6, w, 6);
  }
  const TOYS = ['#ff7eb6', '#7ee8ff', '#ffe27a', '#9dff8a', '#c79bff', '#ffb36b', '#ffffff', '#ff6b6b'];
  shelves.forEach((y, row) => {
    let x = 10;
    while (x < w - 40) {
      const kind = Math.floor(R() * 4);
      const col = TOYS[Math.floor(R() * TOYS.length)];
      const s = (row === 0 ? 30 : 36) + R() * 18;
      if (kind <= 1) {
        // a soft toy: its body, ears, a face
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(x + s / 2, y - 6 - s * 0.45, s * 0.48, s * 0.45, 0, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.arc(x + s * 0.2, y - 6 - s * 0.85, s * 0.14, 0, Math.PI * 2);
        g.arc(x + s * 0.8, y - 6 - s * 0.85, s * 0.14, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#1a0e2a';
        g.fillRect(x + s * 0.32, y - 6 - s * 0.55, 4, 5);
        g.fillRect(x + s * 0.62, y - 6 - s * 0.55, 4, 5);
        g.beginPath();
        g.arc(x + s / 2, y - 6 - s * 0.38, s * 0.1, 0, Math.PI);
        g.stroke();
      } else if (kind === 2) {
        // a box, a ribbon round it
        g.fillStyle = col;
        g.fillRect(x, y - 6 - s * 0.8, s, s * 0.8);
        g.fillStyle = '#ffffff';
        g.fillRect(x + s * 0.45, y - 6 - s * 0.8, s * 0.1, s * 0.8);
      } else {
        // a jar of sweets
        g.fillStyle = 'rgba(200,230,255,0.35)';
        g.fillRect(x, y - 6 - s * 0.9, s * 0.8, s * 0.9);
        for (let k = 0; k < 9; k++) {
          g.fillStyle = TOYS[Math.floor(R() * TOYS.length)];
          g.beginPath();
          g.arc(x + 6 + R() * (s * 0.8 - 12), y - 10 - R() * s * 0.75, 4, 0, Math.PI * 2);
          g.fill();
        }
      }
      // the price
      g.fillStyle = '#ffe14a';
      g.font = `700 12px ${MARKER}`;
      g.textAlign = 'center';
      g.fillText(`${[50, 100, 250, 500, 1000][Math.floor(R() * 5)]}`, x + s / 2, y + 0);
      x += s + 8 + R() * 10;
    }
  });
  return c;
}

// the pizza bar's board: its name, what it has
export function paintMenu(w = 512, h = 256) {
  const c = C(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#140a20';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = NEON.orange;
  g.lineWidth = 6;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 44px ${MARKER}`;
  g.fillStyle = NEON.yellow;
  g.fillText('PIXEL PIZZA', w / 2, 46);
  g.font = `700 24px ${MARKER}`;
  const rows = [['SLICE', '$3'], ['NACHOS', '$4'], ['SLUSHIE', '$2'], ['POPCORN', '$2']];
  rows.forEach(([a, b], i) => {
    g.textAlign = 'left';
    g.fillStyle = [NEON.pink, NEON.cyan, NEON.green, NEON.orange][i];
    g.fillText(a, 40, 104 + i * 36);
    g.textAlign = 'right';
    g.fillStyle = '#fffdf6';
    g.fillText(b, w - 40, 104 + i * 36);
  });
  return c;
}

// the hall of fame: the best on each machine, yours among them
export function paintBoard(c, best) {
  const g = c.getContext('2d');
  const w = c.width;
  const h = c.height;
  g.fillStyle = '#0a0618';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = NEON.cyan;
  g.lineWidth = 6;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.round(h * 0.13)}px ${MARKER}`;
  g.fillStyle = NEON.yellow;
  g.fillText('HALL OF FAME', w / 2, h * 0.12);
  const rows = [['INK INVADERS', 'invaders', 'ZEB', 8420], ['PEN-MAN', 'penman', 'KIRA', 12600], ['INKTRIS', 'inktris', 'OTTO', 9800], ['DOODLE SNAKE', 'snake', 'LUNA', 640], ['PAPER PONG', 'pong', 'MAX', 1800], ['BRICK SKETCH', 'bricks', 'IDA', 7400], ['INK RALLY', 'rally', 'RIO', 9900], ['AIR HOCKEY', 'hockey', 'TAL', 1400]];
  g.font = `700 ${Math.round(h * 0.075)}px ${MARKER}`;
  rows.forEach(([name, id, who, pts], i) => {
    const y = h * 0.27 + i * h * 0.088;
    const mine = (best[id] || 0) > pts;
    g.textAlign = 'left';
    g.fillStyle = PAL[i % PAL.length];
    g.fillText(name, w * 0.06, y);
    g.textAlign = 'center';
    g.fillStyle = mine ? NEON.yellow : '#fffdf6';
    g.fillText(mine ? 'YOU' : who, w * 0.62, y);
    g.textAlign = 'right';
    g.fillText(`${mine ? best[id] : pts}`, w * 0.94, y);
  });
}

// the pinball's field: lanes, bumpers, flippers, the lights on it
export function paintPinball(w = 256, h = 512) {
  const c = C(w, h);
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#2a0a4a');
  gr.addColorStop(1, '#0a1a3a');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  g.lineWidth = 4;
  g.strokeStyle = NEON.cyan;
  g.strokeRect(6, 6, w - 12, h - 12);
  for (const [x, y, col] of [[w * 0.3, h * 0.25, NEON.pink], [w * 0.7, h * 0.25, NEON.yellow], [w * 0.5, h * 0.36, NEON.green]]) {
    g.fillStyle = col;
    g.beginPath();
    g.arc(x, y, w * 0.09, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff';
    g.stroke();
  }
  g.strokeStyle = NEON.orange;
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(w * 0.18, h * 0.86);
  g.lineTo(w * 0.42, h * 0.92);
  g.moveTo(w * 0.82, h * 0.86);
  g.lineTo(w * 0.58, h * 0.92);
  g.stroke();
  for (let i = 0; i < 12; i++) {
    g.fillStyle = PAL[i % PAL.length];
    g.beginPath();
    g.arc(w * 0.2 + (i % 4) * w * 0.2, h * 0.55 + Math.floor(i / 4) * h * 0.06, 6, 0, Math.PI * 2);
    g.fill();
  }
  g.font = `700 28px ${MARKER}`;
  g.textAlign = 'center';
  g.fillStyle = NEON.yellow;
  g.fillText('INK WIZARD', w / 2, h * 0.1);
  return c;
}

// the dance machine's screen when nobody dances: the arrows going up their lanes
export function paintBeatIdle(g, x, y, w, h, t) {
  g.fillStyle = '#12061e';
  g.fillRect(x, y, w, h);
  const cols = [NEON.pink, NEON.cyan, NEON.green, NEON.yellow];
  for (let l = 0; l < 4; l++) {
    const lx = x + w * (0.3 + l * 0.12);
    g.strokeStyle = cols[l];
    g.lineWidth = 2;
    g.strokeRect(lx - w * 0.04, y + h * 0.12, w * 0.08, w * 0.08);
    for (let k = 0; k < 3; k++) {
      const p = (t * 0.6 + k / 3 + l * 0.17) % 1;
      const ay = y + h * (1 - p);
      g.fillStyle = cols[l];
      g.beginPath();
      g.moveTo(lx, ay - w * 0.03);
      g.lineTo(lx + w * 0.03, ay + w * 0.01);
      g.lineTo(lx - w * 0.03, ay + w * 0.01);
      g.closePath();
      g.fill();
    }
  }
  g.font = `700 ${Math.round(h * 0.16)}px ${MARKER}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = NEON.pink;
  g.fillText('INK BEAT', x + w / 2, y + h * 0.9);
}
