import { canvas } from './kit.js';
import { canvasTexture } from '../render/materials.js';

// (v5, ROADMAP 11.32) The great hall's own pictures, painted once: its polished marble with the
// diamonds of black where four slabs meet, the medallion in its court, the coffers of its ceilings
// with their lights, the frieze of gold fans along its galleries, the flutes of its columns. The
// pens still draw over them all, lighter on the polished stone (render/glsl.js uUseRefl 2).

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

// the marbles of the hall
const CREMA = { light: [252, 248, 238, 0.42], dark: [204, 187, 158, 0.3], vein: [146, 122, 94] };
const NERO = { base: 'rgb(24, 23, 28)', light: [74, 72, 82, 0.36], dark: [6, 6, 8, 0.45], vein: [238, 234, 226] };
const BRASS = '#c9a259';

// a square of a marble, for filling shapes with (its pattern)
function swatch(seed, o, n = 256) {
  const c = canvas(n, n);
  marble(c.getContext('2d'), dice(seed), 0, 0, n, n, o);
  return c;
}

// The hall's floor: cream marble in slabs of 1.6 m, each a shade of its own and its grain its own
// way round; the joints fine; where four slabs meet a diamond of black marble, white veined, edged
// in brass. 6.4 m square (four slabs by four), 160 pixels a metre
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
        ...CREMA,
        base: `rgb(${(236 + t * 8) | 0}, ${(226 + t * 7) | 0}, ${(205 + t * 10) | 0})`,
        veins: 5 + Math.floor(r() * 4),
        grain: ((i + j) % 2 ? 0.5 : 2.1) + (r() - 0.5) * 0.5,
      });
    }
  }
  g.strokeStyle = 'rgba(160, 140, 112, 0.6)';
  g.lineWidth = 1.6;
  for (let k = 0; k <= 4; k++) {
    g.beginPath();
    g.moveTo(k * S, 0);
    g.lineTo(k * S, N);
    g.moveTo(0, k * S);
    g.lineTo(N, k * S);
    g.stroke();
  }
  // (the diamonds on the tile's edges are halves and quarters: the next tile has the rest)
  const d = 30;
  for (let j = 0; j <= 4; j++) {
    for (let i = 0; i <= 4; i++) {
      const x = i * S;
      const y = j * S;
      const dia = () => {
        g.beginPath();
        g.moveTo(x, y - d);
        g.lineTo(x + d, y);
        g.lineTo(x, y + d);
        g.lineTo(x - d, y);
        g.closePath();
      };
      g.save();
      dia();
      g.clip();
      marble(g, r, x - d, y - d, 2 * d, 2 * d, { ...NERO, veins: 2, hair: 3, grain: 0.8 });
      g.restore();
      dia();
      g.strokeStyle = BRASS;
      g.lineWidth = 3.5;
      g.stroke();
    }
  }
  return canvasTexture(c, { repeat: true });
}

// The medallion in the court's floor (the picture's circle its whole width): round the rim black
// marble between lines of brass, a band of black with diamonds of cream; within it a star of
// sixteen points - eight long ones of black marble, eight of grey - edged in gold; in its heart a
// sun of gold rays round a disc of black
export function hallMedallion() {
  const N = 1024;
  const C = N / 2;
  const R = N / 2 - 2;
  const c = canvas(N, N);
  const g = c.getContext('2d');
  const r = dice(23);
  marble(g, r, 0, 0, N, N, { ...CREMA, base: 'rgb(238, 229, 210)', veins: 12, hair: 20, grain: 0.6 });
  const nero = g.createPattern(swatch(5, { ...NERO, veins: 4 }), 'repeat');
  const grey = g.createPattern(swatch(9, { base: 'rgb(132, 136, 143)', light: [176, 180, 186, 0.4], dark: [92, 95, 102, 0.4], vein: [228, 230, 234], veins: 4 }), 'repeat');
  const ring = (r0, r1, fill) => {
    g.beginPath();
    g.arc(C, C, r1 * R, 0, Math.PI * 2);
    g.arc(C, C, r0 * R, 0, Math.PI * 2, true);
    g.fillStyle = fill;
    g.fill();
  };
  ring(0.962, 1.0, nero);
  ring(0.948, 0.962, BRASS);
  ring(0.884, 0.898, BRASS);
  ring(0.8, 0.884, nero);
  ring(0.788, 0.8, BRASS);
  // (the band's diamonds of cream)
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    const m = 0.842 * R;
    const x = C + Math.cos(a) * m;
    const y = C + Math.sin(a) * m;
    const t = 0.03 * R;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * t, y + Math.sin(a) * t);
    g.lineTo(x + Math.cos(a + Math.PI / 2) * t * 0.6, y + Math.sin(a + Math.PI / 2) * t * 0.6);
    g.lineTo(x - Math.cos(a) * t, y - Math.sin(a) * t);
    g.lineTo(x - Math.cos(a + Math.PI / 2) * t * 0.6, y - Math.sin(a + Math.PI / 2) * t * 0.6);
    g.closePath();
    g.fillStyle = '#efe6d4';
    g.fill();
  }
  // the star: the short points of grey first, the long ones of black over them
  const kite = (a, tip, side, inner, fill) => {
    const P = (rr, aa) => [C + Math.cos(aa) * rr * R, C + Math.sin(aa) * rr * R];
    const pts = [P(inner, a), P(side, a - Math.PI / 16), P(tip, a), P(side, a + Math.PI / 16)];
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = BRASS;
    g.lineWidth = 4;
    g.stroke();
    // (the ridge down its middle: one half a shade darker, as if it stood up from the floor)
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    g.lineTo(pts[1][0], pts[1][1]);
    g.lineTo(pts[2][0], pts[2][1]);
    g.closePath();
    g.fillStyle = 'rgba(0, 0, 0, 0.16)';
    g.fill();
  };
  for (let k = 0; k < 8; k++) kite(((k + 0.5) / 8) * Math.PI * 2, 0.64, 0.34, 0.16, grey);
  for (let k = 0; k < 8; k++) kite((k / 8) * Math.PI * 2, 0.775, 0.4, 0.16, nero);
  // the sun in its heart
  ring(0.0, 0.2, 'rgb(240, 232, 214)');
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    const len = k % 2 ? 0.15 : 0.19;
    g.beginPath();
    g.moveTo(C + Math.cos(a - 0.05) * 0.07 * R, C + Math.sin(a - 0.05) * 0.07 * R);
    g.lineTo(C + Math.cos(a) * len * R, C + Math.sin(a) * len * R);
    g.lineTo(C + Math.cos(a + 0.05) * 0.07 * R, C + Math.sin(a + 0.05) * 0.07 * R);
    g.closePath();
    g.fillStyle = k % 2 ? '#e2c88c' : '#cfa65a';
    g.fill();
  }
  ring(0.19, 0.205, BRASS);
  ring(0.0, 0.07, nero);
  ring(0.07, 0.078, BRASS);
  return canvasTexture(c);
}

// The coffers of the ceilings, 1.6 m each: the beams between them ivory, each coffer stepping up
// into the ceiling (its sides in light and shade), a line of gold round its panel, in the middle
// a round light in a ring of steel, a glow round it on the panel. And its light alone (em), for
// the pen's own light
export function hallCoffer() {
  const N = 512;
  const c = canvas(N, N);
  const g = c.getContext('2d');
  g.fillStyle = '#f3eee5';
  g.fillRect(0, 0, N, N);
  const step = (a, b, cols) => {
    const q = [
      [[a, a], [b, a], [b - 22, a + 22], [a + 22, a + 22]],
      [[b, a], [b, b], [b - 22, b - 22], [b - 22, a + 22]],
      [[b, b], [a, b], [a + 22, b - 22], [b - 22, b - 22]],
      [[a, b], [a, a], [a + 22, a + 22], [a + 22, b - 22]],
    ];
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(q[i][0][0], q[i][0][1]);
      for (let k = 1; k < 4; k++) g.lineTo(q[i][k][0], q[i][k][1]);
      g.closePath();
      g.fillStyle = cols[i];
      g.fill();
    }
  };
  step(34, N - 34, ['#e4ddd0', '#d6cdbd', '#ddd5c6', '#ebe5da']);
  g.fillStyle = '#f7f2ea';
  g.fillRect(56, 56, N - 112, N - 112);
  g.strokeStyle = BRASS;
  g.lineWidth = 5;
  g.strokeRect(70, 70, N - 140, N - 140);
  const halo = g.createRadialGradient(N / 2, N / 2, 30, N / 2, N / 2, 190);
  halo.addColorStop(0, 'rgba(255, 246, 222, 0.75)');
  halo.addColorStop(1, 'rgba(255, 246, 222, 0)');
  g.fillStyle = halo;
  g.fillRect(56, 56, N - 112, N - 112);
  g.beginPath();
  g.arc(N / 2, N / 2, 46, 0, Math.PI * 2);
  g.fillStyle = '#bdb9b2';
  g.fill();
  g.beginPath();
  g.arc(N / 2, N / 2, 37, 0, Math.PI * 2);
  g.fillStyle = '#fffbf2';
  g.fill();
  const e = canvas(128, 128);
  const ge = e.getContext('2d');
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, 128, 128);
  const eh = ge.createRadialGradient(64, 64, 8, 64, 64, 40);
  eh.addColorStop(0, 'rgba(255, 236, 200, 0.22)');
  eh.addColorStop(1, 'rgba(255, 236, 200, 0)');
  ge.fillStyle = eh;
  ge.fillRect(0, 0, 128, 128);
  ge.beginPath();
  ge.arc(64, 64, 9.2, 0, Math.PI * 2);
  ge.fillStyle = '#fff';
  ge.fill();
  return { map: canvasTexture(c, { repeat: true }), em: canvasTexture(e, { repeat: true }) };
}

// The galleries' edges over the void, the frieze of a classical entablature (its picture 2.4 m
// long, the edge's whole height): a cornice and its cove, a fillet of gold, a row of dentils with
// the shade between them, the fascia - a line of gold along it, gold rosettes on it - a bead of
// gold, the soffit's edge
export function hallFrieze() {
  const W = 704;
  const H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const band = (y0, y1, c0, c1) => {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1 || c0);
    g.fillStyle = gr;
    g.fillRect(0, y0, W, y1 - y0);
  };
  band(0, 14, '#fbf8f2', '#f1ebe0');
  g.fillStyle = 'rgba(120, 104, 84, 0.45)';
  g.fillRect(0, 13, W, 2);
  band(15, 40, '#d9d0c1', '#f6f1e8');
  g.fillStyle = BRASS;
  g.fillRect(0, 40, W, 7);
  // the dentils: blocks with the shade between them, lit from below a little
  band(47, 92, '#b9ad9a', '#cfc5b4');
  for (let x = 4; x < W; x += 22) {
    const gr = g.createLinearGradient(0, 47, 0, 92);
    gr.addColorStop(0, '#f3eee5');
    gr.addColorStop(1, '#fbf8f3');
    g.fillStyle = gr;
    g.fillRect(x, 47, 14, 45);
    g.fillStyle = 'rgba(120, 104, 84, 0.35)';
    g.fillRect(x + 14, 47, 2, 45);
  }
  g.fillStyle = 'rgba(120, 104, 84, 0.5)';
  g.fillRect(0, 92, W, 3);
  band(95, 202, '#f6f2ea', '#efe9de');
  g.fillStyle = BRASS;
  g.fillRect(0, 146, W, 3);
  // (the rosettes, four to the picture)
  for (let k = 0; k < 4; k++) {
    const x = 88 + k * 176;
    const y = 147;
    g.beginPath();
    g.arc(x, y, 19, 0, Math.PI * 2);
    g.fillStyle = '#f6f2ea';
    g.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * 10, y + Math.sin(a) * 10, 7, 4, a, 0, Math.PI * 2);
      g.fillStyle = i % 2 ? '#d8b56a' : BRASS;
      g.fill();
    }
    g.beginPath();
    g.arc(x, y, 5, 0, Math.PI * 2);
    g.fillStyle = '#8d6a2c';
    g.fill();
  }
  g.fillStyle = BRASS;
  g.fillRect(0, 202, W, 6);
  g.fillStyle = 'rgba(255, 245, 220, 0.6)';
  g.fillRect(0, 203, W, 1.5);
  band(208, 256, '#f3eee5', '#e2dacb');
  return canvasTexture(c, { repeat: true });
}

// The flutes of the hall's columns: sixteen round, each a hollow in light and shade between thin
// fillets (white, for the column's own stone colour)
export function hallFlutes() {
  const W = 256;
  const c = canvas(W, 8);
  const g = c.getContext('2d');
  const n = 16;
  const w = W / n;
  for (let i = 0; i < n; i++) {
    const x = i * w;
    const gr = g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, 'rgb(255, 255, 255)');
    gr.addColorStop(0.14, 'rgb(255, 255, 255)');
    gr.addColorStop(0.2, 'rgb(150, 145, 138)');
    gr.addColorStop(0.55, 'rgb(244, 242, 238)');
    gr.addColorStop(0.86, 'rgb(196, 191, 183)');
    gr.addColorStop(1, 'rgb(255, 255, 255)');
    g.fillStyle = gr;
    g.fillRect(x, 0, w, 8);
  }
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
