import { canvas } from './kit.js';
import { canvasTexture } from '../render/materials.js';

// (v5, ROADMAP 11.32) The great hall's own pictures, painted once, as The Galleria's: its floor of
// polished white marble, the rings of black granite in its court, its smooth white ceilings with
// their lights let in, the smooth white edges of its galleries; and the limestone of the outside.
// The pens still draw over them all, lighter on the polished stone (render/glsl.js uUseRefl 2).

// a dice of its own for each picture: the same picture every time
function dice(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) % 100000) / 100000;
}

const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

// cloudy marble in a rectangle: its ground, soft patches a shade lighter and darker, veins along
// its grain that wander and now and then branch, a few fine hairs
function marble(g, r, x0, y0, w, h, o) {
  const grain = o.grain !== undefined ? o.grain : r() * Math.PI;
  g.save();
  g.beginPath();
  g.rect(x0, y0, w, h);
  g.clip();
  g.fillStyle = o.base;
  g.fillRect(x0, y0, w, h);
  const big = Math.max(w, h);
  for (let k = 0; k < 18; k++) {
    const x = x0 + r() * w;
    const y = y0 + r() * h;
    const rad = (0.12 + r() * 0.32) * big;
    const cc = r() < 0.55 ? o.light : o.dark;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, rgba(cc, cc[3]));
    gr.addColorStop(1, rgba(cc, 0));
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const path = (pts) => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  };
  const vein = (x, y, a, n, step, wd, al) => {
    const pts = [[x, y]];
    for (let i = 0; i < n; i++) {
      a += (r() - 0.5) * 0.75;
      x += Math.cos(a) * step * (0.5 + r());
      y += Math.sin(a) * step * (0.5 + r());
      pts.push([x, y]);
    }
    // (a soft halo either side of it, then the line itself)
    path(pts);
    g.strokeStyle = rgba(o.vein, al * 0.16);
    g.lineWidth = wd * 5;
    g.stroke();
    g.strokeStyle = rgba(o.vein, al);
    g.lineWidth = wd;
    g.stroke();
    return pts;
  };
  const L = Math.hypot(w, h);
  for (let k = 0; k < (o.veins || 6); k++) {
    const pts = vein(x0 + r() * w, y0 + r() * h, grain + (r() - 0.5) * 0.7, 8 + Math.floor(r() * 9), L / 14, 0.7 + r() * 1.9, 0.14 + r() * 0.3);
    if (r() < 0.5) {
      const p = pts[1 + Math.floor(r() * (pts.length - 2))];
      vein(p[0], p[1], grain + (r() < 0.5 ? 0.9 : -0.9), 3 + Math.floor(r() * 4), L / 22, 0.5 + r() * 0.8, 0.1 + r() * 0.2);
    }
  }
  for (let k = 0; k < (o.hair || 12); k++) vein(x0 + r() * w, y0 + r() * h, grain + (r() - 0.5) * 1.4, 3, L / 30, 0.5, 0.08 + r() * 0.1);
  g.restore();
}

// the hall's stones: white marble, its veins soft and grey (Carrara); polished black granite
const BIANCO = { light: [255, 255, 255, 0.5], dark: [214, 215, 220, 0.32], vein: [140, 143, 152] };
const CHAMPAGNE = '#d6c196';

// polished black granite in a rectangle: black, the fine speckle of its grains
function granite(g, r, x0, y0, w, h) {
  g.fillStyle = 'rgb(20, 20, 23)';
  g.fillRect(x0, y0, w, h);
  const n = Math.floor((w * h) / 30);
  for (let k = 0; k < n; k++) {
    const v = r() < 0.7 ? 60 + r() * 50 : 150 + r() * 80;
    g.fillStyle = `rgba(${v | 0}, ${v | 0}, ${(v + 6) | 0}, ${0.25 + r() * 0.4})`;
    g.fillRect(x0 + r() * w, y0 + r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
  }
}

// The hall's floor, as The Galleria's: polished white marble in big slabs of 1.2 m, each its own
// shade of white and its grain its own way, soft grey veins, the joints a hair (the bands of black
// granite are laid in it: buildMegaMall). 4.8 m square (four slabs by four), 213 pixels a metre
export function hallMarble() {
  const N = 1024;
  const S = 256;
  const c = canvas(N, N);
  const g = c.getContext('2d');
  const r = dice(11);
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      const t = r();
      marble(g, r, i * S, j * S, S, S, {
        ...BIANCO,
        base: `rgb(${(244 + t * 8) | 0}, ${(244 + t * 8) | 0}, ${(243 + t * 9) | 0})`,
        veins: 3 + Math.floor(r() * 3),
        hair: 6,
        grain: ((i + j) % 2 ? 0.6 : 2.2) + (r() - 0.5) * 0.6,
      });
    }
  }
  g.strokeStyle = 'rgba(150, 152, 160, 0.42)';
  g.lineWidth = 1.2;
  for (let k = 0; k <= 4; k++) {
    g.beginPath();
    g.moveTo(k * S, 0);
    g.lineTo(k * S, N);
    g.moveTo(0, k * S);
    g.lineTo(N, k * S);
    g.stroke();
  }
  return canvasTexture(c, { repeat: true });
}

// The court's floor (the picture's circle its whole width): rings of polished black granite in the
// white marble - a wide one round the rim and a thin one inside it, a third round the fountain
export function hallMedallion() {
  const N = 1024;
  const C = N / 2;
  const R = N / 2 - 2;
  const c = canvas(N, N);
  const g = c.getContext('2d');
  const r = dice(23);
  marble(g, r, 0, 0, N, N, { ...BIANCO, base: 'rgb(246, 246, 245)', veins: 9, hair: 12, grain: 0.6 });
  const black = canvas(256, 256);
  granite(black.getContext('2d'), dice(5), 0, 0, 256, 256);
  const pat = g.createPattern(black, 'repeat');
  const ring = (r0, r1) => {
    g.beginPath();
    g.arc(C, C, r1 * R, 0, Math.PI * 2);
    g.arc(C, C, r0 * R, 0, Math.PI * 2, true);
    g.fillStyle = pat;
    g.fill();
  };
  ring(0.93, 1.0);
  ring(0.885, 0.9);
  ring(0.57, 0.6);
  return canvasTexture(c);
}

// The ceilings under the galleries, the bridges and the food court: smooth and white, a light let
// into it every 1.6 m - a thin ring of steel, the light, a soft glow round it. And its light alone
// (em), for the pen's own light
export function hallCoffer() {
  const N = 512;
  const c = canvas(N, N);
  const g = c.getContext('2d');
  g.fillStyle = '#f7f6f3';
  g.fillRect(0, 0, N, N);
  const halo = g.createRadialGradient(N / 2, N / 2, 20, N / 2, N / 2, 150);
  halo.addColorStop(0, 'rgba(255, 248, 230, 0.7)');
  halo.addColorStop(1, 'rgba(255, 248, 230, 0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, N, N);
  g.beginPath();
  g.arc(N / 2, N / 2, 32, 0, Math.PI * 2);
  g.fillStyle = '#c9cacd';
  g.fill();
  g.beginPath();
  g.arc(N / 2, N / 2, 26, 0, Math.PI * 2);
  g.fillStyle = '#fffcf4';
  g.fill();
  const e = canvas(128, 128);
  const ge = e.getContext('2d');
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, 128, 128);
  const eh = ge.createRadialGradient(64, 64, 5, 64, 64, 34);
  eh.addColorStop(0, 'rgba(255, 236, 200, 0.2)');
  eh.addColorStop(1, 'rgba(255, 236, 200, 0)');
  ge.fillStyle = eh;
  ge.fillRect(0, 0, 128, 128);
  ge.beginPath();
  ge.arc(64, 64, 6.5, 0, Math.PI * 2);
  ge.fillStyle = '#fff';
  ge.fill();
  return { map: canvasTexture(c, { repeat: true }), em: canvasTexture(e, { repeat: true }) };
}

// The galleries' edges over the void, as The Galleria's: smooth and white (a shade lighter at the
// top, where the light falls), a line of champagne along the top, a shadow line near the foot
// (its picture 2.4 m long, the edge's whole height)
export function hallFrieze() {
  const W = 256;
  const H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#fbfaf8');
  gr.addColorStop(0.75, '#f1efeb');
  gr.addColorStop(1, '#e7e4df');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  g.fillStyle = CHAMPAGNE;
  g.fillRect(0, 22, W, 5);
  g.fillStyle = 'rgba(110, 104, 96, 0.45)';
  g.fillRect(0, 218, W, 3);
  g.fillStyle = 'rgba(255, 255, 255, 0.8)';
  g.fillRect(0, 221, W, 2);
  return canvasTexture(c, { repeat: true });
}

// The mall's outside stone: ivory limestone in courses of 0.75 m, blocks of 1.5 m laid half over
// each other, each a shade of its own, the joints fine; the travertine's pores and streaks (white,
// for the stone's own colour). 3 m square
export function decoStone() {
  const N = 512;
  const c = canvas(N, N);
  const g = c.getContext('2d');
  const r = dice(31);
  const ch = N / 4;
  const bw = N / 2;
  for (let j = 0; j < 4; j++) {
    for (let i = -1; i < 2; i++) {
      const x = i * bw + (j % 2 ? bw / 2 : 0);
      const t = r();
      g.fillStyle = `rgb(${(232 + t * 22) | 0}, ${(228 + t * 22) | 0}, ${(218 + t * 26) | 0})`;
      g.fillRect(x, j * ch, bw, ch);
    }
  }
  for (let k = 0; k < 260; k++) {
    const x = r() * N;
    const y = r() * N;
    const w = 2 + r() * 14;
    g.fillStyle = `rgba(150, 138, 118, ${0.1 + r() * 0.16})`;
    g.fillRect(x, y, w, 1 + r() * 1.5);
  }
  g.strokeStyle = 'rgba(112, 100, 84, 0.85)';
  g.lineWidth = 3;
  for (let j = 0; j <= 4; j++) {
    g.beginPath();
    g.moveTo(0, j * ch);
    g.lineTo(N, j * ch);
    g.stroke();
  }
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i <= 2; i++) {
      const x = i * bw + (j % 2 ? bw / 2 : 0);
      g.beginPath();
      g.moveTo(x, j * ch);
      g.lineTo(x, (j + 1) * ch);
      g.stroke();
    }
  }
  return canvasTexture(c, { repeat: true });
}

// (v5, ROADMAP 11.34) The sky painted over Via Inkwell's lanes, as the skies painted over the lanes
// of the great shopping streets under one roof - in the city's own pen: the blue with its softer
// patches, fat clouds with a line of ink round them and a few hatchings under their bellies, a bird
// now and then; by night a deep blue, the stars little crosses, a thin cloud or two. 1024 x 512,
// laid 48 m by 24 m: what goes over an edge comes in at the other, so it tiles
export function drawnSky(night) {
  const W = 1024;
  const H = 512;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const r = dice(night ? 53 : 47);
  const wrap = (fn) => {
    for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) fn(dx, dy);
  };
  g.fillStyle = night ? '#18224c' : '#9ecbec';
  g.fillRect(0, 0, W, H);
  for (let k = 0; k < 16; k++) {
    const x = r() * W;
    const y = r() * H;
    const rad = 90 + r() * 170;
    const cc = night ? (r() < 0.5 ? [58, 74, 140, 0.35] : [8, 12, 34, 0.35]) : r() < 0.6 ? [255, 255, 255, 0.26] : [110, 160, 214, 0.22];
    wrap((dx, dy) => {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      gr.addColorStop(0, rgba(cc, cc[3]));
      gr.addColorStop(1, rgba(cc, 0));
      g.fillStyle = gr;
      g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    });
  }
  // (the pen's own strokes across it, light, all one way)
  g.lineCap = 'round';
  g.strokeStyle = night ? 'rgba(150, 170, 230, 0.07)' : 'rgba(40, 80, 140, 0.08)';
  g.lineWidth = 1.2;
  for (let k = 0; k < 220; k++) {
    const x = r() * W;
    const y = r() * H;
    const l = 10 + r() * 26;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + l, y - l * 0.35);
    g.stroke();
  }
  const ink = night ? 'rgba(170, 186, 240, 0.55)' : 'rgba(36, 52, 98, 0.85)';
  if (night) {
    // the stars: little crosses, a few bigger with a glow round them
    for (let k = 0; k < 90; k++) {
      const x = r() * W;
      const y = r() * H;
      const s = r() < 0.15 ? 5 + r() * 3 : 1.6 + r() * 2;
      const a = 0.55 + r() * 0.45;
      wrap((dx, dy) => {
        if (s > 4) {
          const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, s * 2.2);
          gr.addColorStop(0, `rgba(255, 246, 210, ${a * 0.35})`);
          gr.addColorStop(1, 'rgba(255, 246, 210, 0)');
          g.fillStyle = gr;
          g.fillRect(x + dx - s * 2.2, y + dy - s * 2.2, s * 4.4, s * 4.4);
        }
        g.strokeStyle = `rgba(255, 248, 220, ${a})`;
        g.lineWidth = s > 4 ? 1.8 : 1.2;
        g.beginPath();
        g.moveTo(x + dx - s, y + dy);
        g.lineTo(x + dx + s, y + dy);
        g.moveTo(x + dx, y + dy - s);
        g.lineTo(x + dx, y + dy + s);
        g.stroke();
      });
    }
  }
  // the clouds: a heap of round puffs, drawn round with ink and filled (the ink left only round
  // the heap), a few curls of ink inside, hatching under them
  const n = night ? 3 : 6;
  for (let k = 0; k < n; k++) {
    const x = r() * W;
    const y = r() * H;
    const w = 110 + r() * 120;
    const puffs = [];
    const m = 5 + Math.floor(r() * 4);
    for (let i = 0; i < m; i++) {
      const t = i / (m - 1);
      const rad = (0.22 + Math.sin(t * Math.PI) * 0.3 + r() * 0.08) * w * 0.5;
      puffs.push([x - w / 2 + t * w, y - Math.sin(t * Math.PI) * rad * 0.45 + (r() - 0.5) * 8, rad]);
    }
    wrap((dx, dy) => {
      g.strokeStyle = ink;
      g.lineWidth = night ? 3 : 5;
      for (const [px, py, pr] of puffs) {
        g.beginPath();
        g.arc(px + dx, py + dy, pr, 0, Math.PI * 2);
        g.stroke();
      }
      // (a flat belly under it)
      g.beginPath();
      g.moveTo(puffs[0][0] + dx - puffs[0][2] * 0.6, y + dy + 6);
      g.lineTo(puffs[m - 1][0] + dx + puffs[m - 1][2] * 0.6, y + dy + 6);
      g.stroke();
      g.fillStyle = night ? 'rgba(60, 72, 120, 0.95)' : '#fdfdfb';
      for (const [px, py, pr] of puffs) {
        g.beginPath();
        g.arc(px + dx, py + dy, pr, 0, Math.PI * 2);
        g.fill();
      }
      g.fillRect(puffs[0][0] + dx - puffs[0][2] * 0.6 + 2, y + dy - 10, puffs[m - 1][0] - puffs[0][0] + (puffs[0][2] + puffs[m - 1][2]) * 0.6 - 4, 14);
      // the curls inside, and the shade under it in strokes
      g.strokeStyle = night ? 'rgba(150, 165, 220, 0.4)' : 'rgba(70, 96, 150, 0.45)';
      g.lineWidth = 2;
      for (let i = 1; i < m - 1; i += 2) {
        const [px, py, pr] = puffs[i];
        g.beginPath();
        g.arc(px + dx, py + dy + pr * 0.15, pr * 0.62, Math.PI * 1.1, Math.PI * 1.55);
        g.stroke();
      }
      g.strokeStyle = night ? 'rgba(20, 26, 60, 0.35)' : 'rgba(120, 150, 196, 0.5)';
      g.lineWidth = 1.5;
      for (let hx = puffs[0][0] - puffs[0][2] * 0.3; hx < puffs[m - 1][0] + puffs[m - 1][2] * 0.3; hx += 9) {
        g.beginPath();
        g.moveTo(hx + dx, y + dy + 3);
        g.lineTo(hx + dx + 7, y + dy - 6);
        g.stroke();
      }
    });
  }
  // a bird or two, by day: a pair of arcs
  if (!night) {
    g.strokeStyle = 'rgba(36, 44, 70, 0.8)';
    g.lineWidth = 2.2;
    for (let k = 0; k < 7; k++) {
      const x = r() * W;
      const y = r() * H;
      const s = 6 + r() * 6;
      wrap((dx, dy) => {
        g.beginPath();
        g.arc(x + dx - s, y + dy, s, Math.PI * 1.15, Math.PI * 1.9);
        g.arc(x + dx + s, y + dy, s, Math.PI * 1.1, Math.PI * 1.85);
        g.stroke();
      });
    }
  }
  return canvasTexture(c, { repeat: true });
}

// (v5, ROADMAP 11.34) The art of Via Inkwell's artists' alley, on one sheet (1024 x 1024): two
// murals on its walls, 1024 x 340 each (rows 0 and 1), and three sketches on the easels and the
// lines across it, 340 square (row 2) - drawn as the street draws: colour laid in big soft shapes,
// the ink over it bold and a little shaky
export const LANE_ART = {
  muralA: [0, 0, 1024, 340],
  muralB: [0, 342, 1024, 340],
  sketch0: [0, 684, 340, 340],
  sketch1: [342, 684, 340, 340],
  sketch2: [684, 684, 340, 340],
};
export function laneArt() {
  const N = 1024;
  const c = canvas(N, N);
  const g = c.getContext('2d');
  const r = dice(61);
  g.fillStyle = '#fbf7ee';
  g.fillRect(0, 0, N, N);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const shaky = (pts, w, col, close = false) => {
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      pts.forEach(([x, y], i) => {
        const jx = x + (r() - 0.5) * 2.2;
        const jy = y + (r() - 0.5) * 2.2;
        if (i) g.lineTo(jx, jy);
        else g.moveTo(jx, jy);
      });
      if (close) g.closePath();
      g.strokeStyle = col;
      g.lineWidth = pass ? w * 0.45 : w;
      g.stroke();
    }
  };
  const circle = (x, y, rad, n = 28) => Array.from({ length: n + 1 }, (_, i) => [x + Math.cos((i / n) * Math.PI * 2) * rad, y + Math.sin((i / n) * Math.PI * 2) * rad]);
  const star = (x, y, rad) => Array.from({ length: 11 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const q = i % 2 ? rad * 0.45 : rad;
    return [x + Math.cos(a) * q, y + Math.sin(a) * q];
  });
  const blob = (x, y, rx, ry, col) => {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x, y, rx, ry, r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  };
  const INK = '#1d1b26';
  const COLS = ['#ff5a8a', '#ffb33f', '#ffe14f', '#5ad68a', '#3fc8ff', '#7a6bff', '#ff7a4f'];
  // the murals: a wash of colour, then the big drawn things over it
  for (const [key, theme] of [['muralA', 0], ['muralB', 1]]) {
    const [x0, y0, w, h] = LANE_ART[key];
    g.save();
    g.beginPath();
    g.rect(x0, y0, w, h);
    g.clip();
    g.fillStyle = theme ? '#2b3a6b' : '#fff2d8';
    g.fillRect(x0, y0, w, h);
    for (let k = 0; k < 9; k++) blob(x0 + r() * w, y0 + r() * h, 60 + r() * 120, 40 + r() * 70, COLS[k % COLS.length] + (theme ? 'cc' : '99'));
    if (theme === 0) {
      // a giant pencil drawing a line of stars across the wall, a sun with a face, the word INK
      const px = x0 + 140;
      const py = y0 + 250;
      g.fillStyle = '#ffd23f';
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + 300, py - 150);
      g.lineTo(px + 330, py - 92);
      g.lineTo(px + 30, py + 58);
      g.closePath();
      g.fill();
      shaky([[px, py], [px + 300, py - 150], [px + 330, py - 92], [px + 30, py + 58], [px, py]], 6, INK);
      g.fillStyle = '#ff9fb8';
      g.beginPath();
      g.moveTo(px + 300, py - 150);
      g.lineTo(px + 352, py - 176);
      g.lineTo(px + 382, py - 118);
      g.lineTo(px + 330, py - 92);
      g.closePath();
      g.fill();
      shaky([[px + 300, py - 150], [px + 352, py - 176], [px + 382, py - 118], [px + 330, py - 92]], 6, INK);
      shaky([[px, py], [px - 40, py + 48], [px + 30, py + 58]], 6, INK);
      for (let k = 0; k < 6; k++) {
        const sx = px - 60 + k * -10 + 520 + k * 70;
        const sy = py + 30 - Math.sin(k * 0.9) * 40;
        g.fillStyle = COLS[k % COLS.length];
        g.beginPath();
        star(sx, sy, 26).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.fill();
        shaky(star(sx, sy, 26), 4, INK, true);
      }
      const sx = x0 + 870;
      const sy = y0 + 110;
      g.fillStyle = '#ffb33f';
      g.beginPath();
      g.arc(sx, sy, 62, 0, Math.PI * 2);
      g.fill();
      shaky(circle(sx, sy, 62), 5, INK, true);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        shaky([[sx + Math.cos(a) * 76, sy + Math.sin(a) * 76], [sx + Math.cos(a) * 104, sy + Math.sin(a) * 104]], 5, INK);
      }
      shaky([[sx - 22, sy - 10], [sx - 22, sy - 2]], 7, INK);
      shaky([[sx + 22, sy - 10], [sx + 22, sy - 2]], 7, INK);
      shaky(Array.from({ length: 9 }, (_, i) => [sx - 26 + i * 6.5, sy + 18 + Math.sin((i / 8) * Math.PI) * 14]), 5, INK);
      g.font = 'bold 150px sans-serif';
      g.lineWidth = 10;
      g.strokeStyle = INK;
      g.fillStyle = '#3fc8ff';
      g.strokeText('INK!', x0 + 520, y0 + 160);
      g.fillText('INK!', x0 + 520, y0 + 160);
    } else {
      // a night of drawn things: a moon with a nightcap, a cat on a wall, a paper plane looping,
      // hearts and spirals, the word DRAW
      const mx = x0 + 150;
      const my = y0 + 120;
      g.fillStyle = '#ffe9a8';
      g.beginPath();
      g.arc(mx, my, 70, 0.5, Math.PI * 2 - 0.5);
      g.arc(mx + 30, my, 52, Math.PI * 2 - 0.62, 0.62, true);
      g.fill();
      shaky(circle(mx, my, 70, 30).slice(3, 28), 5, '#fdfbf2');
      g.font = 'bold 140px sans-serif';
      g.lineWidth = 10;
      g.strokeStyle = '#fdfbf2';
      g.fillStyle = '#ff5a8a';
      g.strokeText('DRAW', x0 + 300, y0 + 230);
      g.fillText('DRAW', x0 + 300, y0 + 230);
      // the paper plane and its loop
      const loop = Array.from({ length: 40 }, (_, i) => {
        const t = i / 39;
        return [x0 + 700 + t * 260 + Math.sin(t * Math.PI * 2) * 40, y0 + 250 - t * 150 - Math.cos(t * Math.PI * 2) * 40];
      });
      g.setLineDash([10, 12]);
      shaky(loop, 3, '#fdfbf2');
      g.setLineDash([]);
      const [ex, ey] = loop[loop.length - 1];
      g.fillStyle = '#fdfbf2';
      g.beginPath();
      g.moveTo(ex, ey);
      g.lineTo(ex - 60, ey - 10);
      g.lineTo(ex - 40, ey + 24);
      g.closePath();
      g.fill();
      shaky([[ex, ey], [ex - 60, ey - 10], [ex - 40, ey + 24], [ex, ey]], 3, INK);
      for (let k = 0; k < 7; k++) {
        const hx = x0 + 60 + r() * (w - 120);
        const hy = y0 + 40 + r() * (h - 80);
        if (k % 2) shaky(Array.from({ length: 30 }, (_, i) => [hx + Math.cos(i * 0.6) * i * 0.9, hy + Math.sin(i * 0.6) * i * 0.9]), 3, COLS[k % COLS.length]);
        else shaky(star(hx, hy, 14), 3, '#ffe14f', true);
      }
    }
    // the painter's tags along the bottom
    g.font = 'italic 26px sans-serif';
    g.fillStyle = theme ? '#fdfbf2' : INK;
    g.fillText(theme ? 'by the alley crew' : 'drawn here, 2026', x0 + w - 270, y0 + h - 18);
    g.restore();
  }
  // the sketches: a face, a cat, a palm by the sea - in pencil and a touch of colour
  for (const [key, what] of [['sketch0', 0], ['sketch1', 1], ['sketch2', 2]]) {
    const [x0, y0, s] = LANE_ART[key];
    g.save();
    g.beginPath();
    g.rect(x0, y0, s, s);
    g.clip();
    g.fillStyle = '#fdfbf4';
    g.fillRect(x0, y0, s, s);
    const cx = x0 + s / 2;
    const cy = y0 + s / 2;
    const P = '#3a3946';
    if (what === 0) {
      blob(cx, cy + 10, 90, 110, '#ffd9c288');
      shaky(circle(cx, cy, 95, 30).map(([x, y]) => [x, cy + (y - cy) * 1.2]), 4, P, true);
      shaky([[cx - 40, cy - 20], [cx - 20, cy - 24]], 4, P);
      shaky([[cx + 20, cy - 24], [cx + 40, cy - 20]], 4, P);
      shaky([[cx, cy - 10], [cx - 8, cy + 25], [cx + 6, cy + 28]], 3, P);
      shaky(Array.from({ length: 9 }, (_, i) => [cx - 30 + i * 7.5, cy + 55 + Math.sin((i / 8) * Math.PI) * 10]), 4, '#d9405a');
      shaky(Array.from({ length: 14 }, (_, i) => [cx - 100 + i * 15, cy - 95 - Math.sin((i / 13) * Math.PI) * 50]), 6, '#6b4a2e');
    } else if (what === 1) {
      shaky(circle(cx, cy + 30, 80, 24).map(([x, y]) => [x, cy + 30 + (y - cy - 30) * 0.8]), 4, P, true);
      shaky(circle(cx, cy - 60, 50, 20), 4, P, true);
      shaky([[cx - 45, cy - 80], [cx - 40, cy - 130], [cx - 15, cy - 100]], 4, P);
      shaky([[cx + 45, cy - 80], [cx + 40, cy - 130], [cx + 15, cy - 100]], 4, P);
      blob(cx - 18, cy - 65, 7, 9, '#5ad68a');
      blob(cx + 18, cy - 65, 7, 9, '#5ad68a');
      shaky([[cx + 80, cy + 50], [cx + 130, cy + 20], [cx + 140, cy - 30]], 4, P);
      for (const d of [-1, 1]) shaky([[cx + d * 10, cy - 45], [cx + d * 55, cy - 50]], 2, P);
    } else {
      blob(cx, cy + 90, 170, 40, '#3fc8ff88');
      blob(cx + 60, cy - 70, 40, 40, '#ffb33f99');
      shaky([[cx - 30, cy + 80], [cx - 20, cy], [cx - 5, cy - 60]], 7, '#7a5534');
      for (let k = 0; k < 5; k++) {
        const a = Math.PI + 0.3 + k * 0.6;
        shaky([[cx - 5, cy - 60], [cx - 5 + Math.cos(a) * 60, cy - 60 + Math.sin(a) * 30 - 20], [cx - 5 + Math.cos(a) * 95, cy - 60 + Math.sin(a) * 20 + 10]], 5, '#2f8a4e');
      }
      shaky([[x0 + 20, cy + 75], [x0 + s - 20, cy + 75]], 3, P);
    }
    g.strokeStyle = 'rgba(40, 40, 50, 0.25)';
    g.lineWidth = 2;
    g.strokeRect(x0 + 6, y0 + 6, s - 12, s - 12);
    g.restore();
  }
  return canvasTexture(c);
}

// (v5, ROADMAP 11.42) The floors of the stores in a mall, laid the way real ones are: each picture 2 m
// square (world/rooms.js lays the floors by the world's metres), 256 pixels a metre, joining up with
// itself on every side. oak, walnut: planks of 18 cm, each its own shade and its run of grain, their
// ends staggered; porcelain: big tiles of 50 cm, a hair of grout; polished: concrete, its soft clouds
// and a seam; terrazzo: chips of stone in it; carpet: a grey tweed
export function storeFloor(kind) {
  const N = 512;
  const c = canvas(N, N);
  const g = c.getContext('2d');
  const r = dice(kind.length * 31 + kind.charCodeAt(0));
  const rgb = (a, k = 1, al = 1) => `rgba(${(a[0] * k) | 0}, ${(a[1] * k) | 0}, ${(a[2] * k) | 0}, ${al})`;
  // (drawn again across each edge it crosses, so the picture joins up with itself)
  const wrap = (fn) => {
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      g.save();
      g.translate(ox, oy);
      fn();
      g.restore();
    }
  };
  if (kind === 'oak' || kind === 'walnut') {
    const base = kind === 'oak' ? [200, 172, 138] : [108, 79, 60];
    const n = 11;
    const w = N / n;
    for (let i = 0; i < n; i++) {
      // (the planks of a row: the same length - a third or a half of the picture - their ends where
      // the row's own offset puts them)
      const len = r() < 0.5 ? N / 2 : N / 3;
      const off = r() * len;
      for (let y = -len + off; y < N; y += len) {
        const t = 0.88 + r() * 0.2;
        const x0 = i * w;
        wrap(() => {
          g.fillStyle = rgb(base, t);
          g.fillRect(x0, y, w, len);
        });
        // the grain: long fine lines down it, a little wavy, darker and lighter
        for (let k = 0; k < 9; k++) {
          const gx = x0 + 3 + r() * (w - 6);
          const dark = r() < 0.7;
          const a = 0.06 + r() * 0.1;
          const amp = 0.6 + r() * 1.6;
          const ph = r() * 6;
          const lw = 0.6 + r() * 0.9;
          wrap(() => {
            g.strokeStyle = dark ? rgb(base, 0.62, a) : rgb([255, 245, 230], 1, a * 0.7);
            g.lineWidth = lw;
            g.beginPath();
            for (let s = 0; s <= 12; s++) {
              const yy = y + (len * s) / 12;
              const xx = gx + Math.sin(ph + s * 0.7) * amp;
              if (s) g.lineTo(xx, yy);
              else g.moveTo(xx, yy);
            }
            g.stroke();
          });
        }
        // now and then a knot
        if (r() < 0.25) {
          const kx = x0 + w * (0.3 + r() * 0.4);
          const ky = y + len * (0.2 + r() * 0.6);
          wrap(() => {
            g.fillStyle = rgb(base, 0.55, 0.45);
            g.beginPath();
            g.ellipse(kx, ky, 2.2, 4.5, 0, 0, Math.PI * 2);
            g.fill();
          });
        }
        // its end
        wrap(() => {
          g.fillStyle = rgb(base, 0.45, 0.55);
          g.fillRect(x0, y, w, 1.2);
        });
      }
      // the joint along it
      wrap(() => {
        g.fillStyle = rgb(base, 0.42, 0.6);
        g.fillRect(i * w, 0, 1.2, N);
      });
    }
  } else if (kind === 'porcelain') {
    const S = N / 4;
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        const t = r() * 6 - 3;
        g.fillStyle = `rgb(${(219 + t) | 0}, ${(215 + t) | 0}, ${(208 + t) | 0})`;
        g.fillRect(i * S, j * S, S, S);
        // its soft clouds, the faint grain of the stone it copies
        for (let k = 0; k < 7; k++) {
          const x = i * S + r() * S;
          const y = j * S + r() * S;
          const rad = 10 + r() * 40;
          const gr = g.createRadialGradient(x, y, 0, x, y, rad);
          const v = r() < 0.5 ? '255, 252, 246' : '170, 164, 156';
          gr.addColorStop(0, `rgba(${v}, ${0.08 + r() * 0.08})`);
          gr.addColorStop(1, `rgba(${v}, 0)`);
          g.fillStyle = gr;
          g.fillRect(i * S, j * S, S, S);
        }
      }
    }
    g.fillStyle = 'rgba(150, 144, 136, 0.55)';
    for (let k = 0; k < 4; k++) {
      g.fillRect(k * S, 0, 1.6, N);
      g.fillRect(0, k * S, N, 1.6);
    }
  } else if (kind === 'polished') {
    g.fillStyle = 'rgb(186, 182, 175)';
    g.fillRect(0, 0, N, N);
    for (let k = 0; k < 40; k++) {
      const x = r() * N;
      const y = r() * N;
      const rad = 30 + r() * 120;
      const v = r() < 0.5 ? '228, 225, 218' : '128, 124, 118';
      const al = 0.05 + r() * 0.06;
      wrap(() => {
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, `rgba(${v}, ${al})`);
        gr.addColorStop(1, `rgba(${v}, 0)`);
        g.fillStyle = gr;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      });
    }
    for (let k = 0; k < 1800; k++) {
      const v = r() < 0.5 ? 236 : 96;
      g.fillStyle = `rgba(${v}, ${v - 2}, ${v - 5}, ${0.08 + r() * 0.14})`;
      g.fillRect(r() * N, r() * N, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    // a hairline crack, and the saw cut every 2 m
    g.strokeStyle = 'rgba(90, 86, 80, 0.35)';
    g.lineWidth = 0.8;
    g.beginPath();
    let x = r() * N;
    let y = 0;
    g.moveTo(x, y);
    while (y < N * 0.6) {
      x += (r() - 0.5) * 18;
      y += 6 + r() * 14;
      g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = 'rgba(96, 92, 86, 0.5)';
    g.fillRect(0, 0, 1.4, N);
    g.fillRect(0, 0, N, 1.4);
  } else if (kind === 'terrazzo') {
    g.fillStyle = 'rgb(216, 210, 200)';
    g.fillRect(0, 0, N, N);
    const chips = [[118, 116, 112], [62, 60, 60], [246, 244, 238], [168, 112, 84], [128, 138, 120], [196, 186, 170]];
    for (let k = 0; k < 2600; k++) {
      const col = chips[Math.floor(r() * chips.length)];
      const x = r() * N;
      const y = r() * N;
      const s = r() < 0.85 ? 1 + r() * 2.5 : 3 + r() * 4;
      const a = r() * Math.PI;
      const al = 0.75 + r() * 0.25;
      const sy = s * (0.5 + r() * 0.5);
      const chip = () => {
        g.fillStyle = rgb(col, 1, al);
        g.beginPath();
        g.ellipse(x, y, s, sy, a, 0, Math.PI * 2);
        g.fill();
      };
      // (only one by an edge is drawn across it too)
      if (x < 8 || y < 8 || x > N - 8 || y > N - 8) wrap(chip);
      else chip();
    }
  } else {
    // carpet: a grey tweed
    g.fillStyle = 'rgb(66, 66, 72)';
    g.fillRect(0, 0, N, N);
    for (let k = 0; k < 9000; k++) {
      const v = r() < 0.5 ? 104 : 40;
      g.fillStyle = `rgba(${v}, ${v}, ${v + 6}, ${0.15 + r() * 0.25})`;
      g.fillRect(r() * N, r() * N, 1, 1 + r() * 2);
    }
  }
  return canvasTexture(c, { repeat: true });
}
