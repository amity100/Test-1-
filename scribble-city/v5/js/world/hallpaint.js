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
