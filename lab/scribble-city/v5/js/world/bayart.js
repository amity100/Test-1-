import { canvas } from './kit.js';
import { canvasTexture } from '../render/materials.js';
import { marble, dice } from './hallpaint.js';

// (v5, ROADMAP 13.2) BAYVIEW MALL's own pictures, painted once: its floor of polished marble laid
// on the diagonal, cream and espresso with a line of brass between; the names of its stores on
// their boards (black and white, gold, the neon of the couture houses); the banners down its
// atrium ("Luxury lives here"), the faces and the things on its screens, the crown over its
// waterfall; the sunset through its dome, the city's towers against it - and the same at night;
// the water of the waterfall, falling. The pens of the city still draw over all of them.

const TAU = Math.PI * 2;
const FONT_SERIF = '"Cinzel", "Rubik", serif';
const FONT_SANS = '"Rubik", sans-serif';
const FONT_HAND = '"Caveat", "Permanent Marker", cursive';

// (a rect of a canvas in its texture's uv: [u0, v0, u1, v1], the picture's y down, the uv's up)
const uvOf = (W, H, x, y, w, h) => [x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H];

// text fitted into a width: the font at size px, smaller till it fits (letter spacing kept)
function fitText(g, text, font, px, maxW, spacing = 0) {
  let s = px;
  for (let k = 0; k < 30; k++) {
    g.font = font.replace('#', `${Math.round(s)}px`);
    if ('letterSpacing' in g) g.letterSpacing = `${Math.round(spacing * s)}px`;
    if (g.measureText(text).width <= maxW) break;
    s *= 0.93;
  }
  return s;
}

// a glow of light round a stroke or a word: the same drawn a few times wider and fainter
function glow(g, col, blur, draw) {
  g.save();
  g.shadowColor = col;
  for (const b of [blur, blur * 0.5, blur * 0.2]) {
    g.shadowBlur = b;
    draw();
  }
  g.restore();
}

// the crown of the mall's name: a band, five points with a pearl on each, drawn in strokes of light
function crown(g, cx, cy, w, col, lw = 3, fill = null) {
  const h = w * 0.62;
  const x0 = cx - w / 2;
  const y1 = cy + h / 2;
  const y0 = cy - h / 2;
  const pts = [[x0, y1], [x0 - w * 0.02, y0 + h * 0.18], [x0 + w * 0.24, y0 + h * 0.5], [x0 + w * 0.5, y0], [x0 + w * 0.76, y0 + h * 0.5], [x0 + w * 1.02, y0 + h * 0.18], [x0 + w, y1]];
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  g.strokeStyle = col;
  g.lineWidth = lw;
  g.stroke();
  // the band and its jewels
  g.beginPath();
  g.moveTo(x0 + w * 0.02, y1 - h * 0.2);
  g.lineTo(x0 + w * 0.98, y1 - h * 0.2);
  g.stroke();
  g.fillStyle = col;
  for (const [x, y] of [pts[1], pts[3], pts[5]]) {
    g.beginPath();
    g.arc(x, y - lw * 1.2, lw * 1.5, 0, TAU);
    g.fill();
  }
  for (const f of [0.3, 0.5, 0.7]) {
    g.beginPath();
    g.arc(x0 + w * f, y1 - h * 0.1, lw * 0.9, 0, TAU);
    g.fill();
  }
  g.restore();
}

// a palm in neon: its trunk a curve, its fronds arcs
function neonPalm(g, x, y, h, col) {
  g.save();
  g.strokeStyle = col;
  g.lineCap = 'round';
  g.lineWidth = h * 0.045;
  glow(g, col, h * 0.25, () => {
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + h * 0.18, y - h * 0.5, x + h * 0.08, y - h * 0.86);
    g.stroke();
    const tx = x + h * 0.08;
    const ty = y - h * 0.86;
    for (const [a, l] of [[-2.7, 0.5], [-2.2, 0.55], [-1.6, 0.4], [-0.9, 0.55], [-0.4, 0.5], [0.2, 0.38], [-3.3, 0.38]]) {
      g.beginPath();
      g.moveTo(tx, ty);
      const ex = tx + Math.cos(a) * h * l;
      const ey = ty + Math.sin(a) * h * l * 0.7 + h * 0.18;
      g.quadraticCurveTo(tx + Math.cos(a) * h * l * 0.6, ty + Math.sin(a) * h * l * 0.6 - h * 0.08, ex, ey);
      g.stroke();
    }
  });
  g.restore();
}

// pencil hatching over a part of a picture, the hand of the city
function hatch(g, r, x, y, w, h, col, n, ang = -0.9, len = 0.18) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.strokeStyle = col;
  g.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const px = x + r() * w;
    const py = y + r() * h;
    const L = (0.4 + r()) * len * Math.min(w, h);
    const a = ang + (r() - 0.5) * 0.3;
    g.lineWidth = 0.6 + r() * 1.4;
    g.globalAlpha = 0.15 + r() * 0.3;
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L);
    g.stroke();
  }
  g.restore();
}

// ------------------------------------------------------------------ the floor
// polished marble on the diagonal, as the mall's: diamonds of cream and of espresso brown, a line of
// brass along every joint. 6.4 m square, 160 pixels a metre; each diamond drawn the same wherever it
// is cut by the picture's edge, so that the picture goes on without a seam
const CREAM = { base: '#f1e6d3', light: [255, 252, 242, 0.55], dark: [214, 196, 170, 0.3], vein: [178, 150, 118] };
const ESPRESSO = { base: '#211713', light: [92, 64, 48, 0.32], dark: [8, 6, 5, 0.45], vein: [196, 150, 88] };
// (the galleries' floors over the great hall's: cream and a warm sand, quieter than its black)
const SAND = { base: '#d9c5a7', light: [252, 242, 224, 0.45], dark: [168, 140, 108, 0.3], vein: [146, 116, 86] };
export function bayFloor(soft = false) {
  const N = 1024;
  const s = N / 4;
  const c = canvas(N, N);
  const g = c.getContext('2d');
  g.fillStyle = CREAM.base;
  g.fillRect(0, 0, N, N);
  for (let i = -2; i < 10; i++) {
    for (let j = -6; j < 6; j++) {
      // (the diamond's corners: a = u + v from i s, b = u - v from j s)
      const cu = ((i + j + 1) * s) / 2;
      const cv = ((i - j) * s) / 2;
      if (cu < -s || cu > N + s || cv < -s || cv > N + s) continue;
      const dark = (((i + j) % 2) + 2) % 2 === 0;
      const key = ((((i % 8) + 8) % 8) * 31 + (((j % 8) + 8) % 8) * 7 + (dark ? 3 : 0)) | 0;
      g.save();
      g.beginPath();
      g.moveTo(cu - s / 2, cv);
      g.lineTo(cu, cv - s / 2);
      g.lineTo(cu + s / 2, cv);
      g.lineTo(cu, cv + s / 2);
      g.closePath();
      g.clip();
      marble(g, dice(101 + key), cu - s / 2, cv - s / 2, s, s, { ...(dark ? (soft ? SAND : ESPRESSO) : CREAM), veins: dark ? 4 : 3, hair: 8, grain: dark && !soft ? 0.8 : 2.3 });
      g.restore();
    }
  }
  // the brass between them, a darker line either side of it
  g.lineCap = 'butt';
  for (let k = -8; k <= 8; k++) {
    for (const [w, col] of [[5, 'rgba(70, 48, 26, 0.55)'], [2.6, '#d4ac62'], [0.9, 'rgba(255, 240, 200, 0.8)']]) {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(k * s, 0);
      g.lineTo(k * s + N, N);
      g.moveTo(k * s, 0);
      g.lineTo(k * s - N, N);
      g.stroke();
    }
  }
  return canvasTexture(c, { repeat: true });
}

// ------------------------------------------------------------------ the stores' names
// each name on its board, 512 by 128 (the boards in the hall 4:1): its style - black with white
// letters and a line of gold, navy, the couture houses in neon, gold on black, cream - its line
// under the name, an icon (a crown, a palm)
export const BAY_SIGNS = [
  { name: 'SOLARA', sub: 'MIAMI', style: 'black' },
  { name: 'TIDAL', sub: 'WATCHES', style: 'navy' },
  { name: 'VELORA', sub: 'COUTURE', style: 'pink' },
  { name: 'MONARCH', sub: 'LIFESTYLE', style: 'black', icon: 'crown' },
  { name: 'AZURE', sub: 'BEACH CLUB', style: 'blue', icon: 'palm' },
  { name: 'PALM & PLATE', sub: 'FOOD HALL', style: 'gold', icon: 'crown' },
  { name: 'MAISON LUNE', sub: 'PARIS', style: 'cream' },
  { name: 'CORAL & CO', sub: 'JEWELRY', style: 'gold' },
  { name: 'NOIR', sub: 'STUDIO', style: 'black' },
  { name: 'BELLA COSTA', sub: 'SWIMWEAR', style: 'pink' },
  { name: 'GOLDEN HOUR', sub: 'BEAUTY', style: 'gold' },
  { name: 'SEAGLASS', sub: 'OPTICS', style: 'blue' },
  { name: 'RIVIERA', sub: 'MEN', style: 'navy' },
  { name: 'SAFFRON', sub: 'HOME', style: 'cream' },
  { name: 'MARISOL', sub: 'SHOES', style: 'purple' },
  { name: 'LUXE LANE', sub: 'BAGS', style: 'black' },
  { name: 'INDIGO BAY', sub: 'DENIM', style: 'navy' },
  { name: 'VISTA ROSA', sub: 'PERFUME', style: 'pink' },
  { name: 'CALYPSO', sub: 'KIDS', style: 'blue' },
  { name: 'SABLE', sub: 'LEATHER', style: 'gold' },
  { name: 'OCEAN DRIVE', sub: 'SNEAKERS', style: 'purple' },
  { name: 'ATELIER 9', sub: 'TAILORS', style: 'cream' },
  { name: 'PALOMA', sub: 'BOUTIQUE', style: 'pink' },
  { name: 'ECLIPSE', sub: 'ELECTRONICS', style: 'black' },
  { name: 'VERDE', sub: 'TEA HOUSE', style: 'gold', icon: 'palm' },
  { name: 'STARLING', sub: 'BOOKS', style: 'navy' },
  { name: 'HALCYON', sub: 'SPORT', style: 'blue' },
  { name: 'CASA BLANCA', sub: 'CAFÉ', style: 'cream' },
  { name: 'PRISM', sub: 'GAMES', style: 'purple' },
  { name: 'AURUM', sub: 'FINE JEWELRY', style: 'gold', icon: 'crown' },
  { name: 'MIRAGE', sub: 'FASHION', style: 'pink' },
  { name: 'SOL Y MAR', sub: 'GELATO', style: 'blue' },
];
const STYLE = {
  black: { bg: ['#121015', '#060507'], line: '#d8b46a', ink: '#ffffff', sub: '#e9dcc0', font: FONT_SERIF, w: 600 },
  navy: { bg: ['#13213a', '#0a1222'], line: '#c8d2e0', ink: '#ffffff', sub: '#c5d4ea', font: FONT_SANS, w: 500 },
  gold: { bg: ['#1c130b', '#0d0905'], line: '#e2bd6c', ink: '#f6dd9e', sub: '#e9cf8f', font: FONT_SERIF, w: 700 },
  cream: { bg: ['#f4ead8', '#e4d5bc'], line: '#b08a48', ink: '#2a211b', sub: '#6a5440', font: FONT_SERIF, w: 600 },
  pink: { bg: ['#2a0718', '#16030c'], line: '#ff5fae', ink: '#ffe3f1', sub: '#ff8cc6', font: FONT_SERIF, w: 700, neon: '#ff3f9e' },
  blue: { bg: ['#071a3a', '#030c1e'], line: '#4fd9ff', ink: '#e4fbff', sub: '#9fe9ff', font: FONT_SANS, w: 600, neon: '#2fc8ff' },
  purple: { bg: ['#1c0a33', '#0d0418'], line: '#b88cff', ink: '#f2e8ff', sub: '#cdb2ff', font: FONT_SANS, w: 600, neon: '#9d6bff' },
};

function paintSign(g, x, y, w, h, sp, r) {
  const S = STYLE[sp.style] || STYLE.black;
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const bg = g.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, S.bg[0]);
  bg.addColorStop(1, S.bg[1]);
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);
  // (a sheen across it, the light of the hall in its gloss)
  const sh = g.createLinearGradient(x, y, x + w, y + h);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.45, 'rgba(255,255,255,0.07)');
  sh.addColorStop(0.55, 'rgba(255,255,255,0)');
  g.fillStyle = sh;
  g.fillRect(x, y, w, h);
  // its frame: a fine line inset
  g.strokeStyle = S.line;
  g.lineWidth = 2;
  g.globalAlpha = 0.85;
  g.strokeRect(x + 7, y + 7, w - 14, h - 14);
  g.globalAlpha = 1;
  const icon = sp.icon;
  const ix = icon ? 84 : 0;
  const tx = x + w / 2 + ix / 2;
  const maxW = w - 48 - ix;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const title = `${S.w} # ${S.font}`;
  const s1 = fitText(g, sp.name, title, h * 0.4, maxW, 0.16);
  const ty = y + h * (sp.sub ? 0.4 : 0.52);
  const draw = () => g.fillText(sp.name, tx, ty);
  if (S.neon) {
    // neon: a tube of light, white at its heart, its colour round it
    g.fillStyle = S.neon;
    glow(g, S.neon, s1 * 0.9, draw);
    g.fillStyle = S.ink;
    draw();
  } else {
    g.fillStyle = S.ink;
    glow(g, 'rgba(255, 230, 190, 0.35)', s1 * 0.25, draw);
  }
  if (sp.sub) {
    fitText(g, sp.sub, `600 # ${FONT_SANS}`, h * 0.19, maxW * 0.72, 0.32);
    g.fillStyle = S.sub;
    g.fillText(sp.sub, tx, y + h * 0.76);
    // (a hairline either side of it)
    const sw = g.measureText(sp.sub).width;
    g.strokeStyle = S.line;
    g.lineWidth = 1.5;
    for (const d of [-1, 1]) {
      g.beginPath();
      g.moveTo(tx + d * (sw / 2 + 10), y + h * 0.76);
      g.lineTo(tx + d * (sw / 2 + 44), y + h * 0.76);
      g.stroke();
    }
    g.font = title.replace('#', `${Math.round(s1)}px`);
  }
  if (icon === 'crown') crown(g, x + 54, y + h * 0.5, 60, S.line, 3.5);
  if (icon === 'palm') neonPalm(g, x + 44, y + h * 0.88, h * 0.76, S.neon || S.line);
  hatch(g, r, x, y, w, h, S.style === 'cream' ? 'rgba(80,60,40,0.5)' : 'rgba(255,255,255,0.35)', 26, -0.95, 0.5);
  g.restore();
}

/** the stores' names, all on one picture: { tex, rect(name) -> [u0, v0, u1, v1] } */
export function baySigns() {
  const W = 2048;
  const H = 1024;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const rects = new Map();
  const r = dice(4242);
  BAY_SIGNS.forEach((sp, i) => {
    const x = (i % 4) * 512;
    const y = Math.floor(i / 4) * 128;
    paintSign(g, x + 2, y + 2, 508, 124, sp, r);
    rects.set(sp.name, uvOf(W, H, x + 2, y + 2, 508, 124));
  });
  return { tex: canvasTexture(c, { mips: true }), rect: (name) => rects.get(name) || rects.get('NOIR'), list: BAY_SIGNS };
}

// ------------------------------------------------------------------ the banners, the screens, the crown
// the banner down the atrium: hot pink into coral and orange, palms and the towers dark against the
// last of it, the words in a brush hand, the crown under them
function paintBanner(g, x, y, w, h, r) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const gr = g.createLinearGradient(x, y, x, y + h);
  gr.addColorStop(0, '#e01a74');
  gr.addColorStop(0.3, '#ff3f7f');
  gr.addColorStop(0.58, '#ff7a4e');
  gr.addColorStop(0.78, '#ffab4a');
  gr.addColorStop(0.9, '#b8448c');
  gr.addColorStop(1, '#4a1f6e');
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
  // a sun low behind the palms
  const sx = x + w * 0.62;
  const sy = y + h * 0.83;
  const sg = g.createRadialGradient(sx, sy, 0, sx, sy, w * 0.55);
  sg.addColorStop(0, 'rgba(255, 240, 180, 0.95)');
  sg.addColorStop(0.18, 'rgba(255, 200, 110, 0.7)');
  sg.addColorStop(1, 'rgba(255, 150, 90, 0)');
  g.fillStyle = sg;
  g.fillRect(x, y + h * 0.55, w, h * 0.45);
  // towers and palms against it
  g.fillStyle = 'rgba(40, 10, 50, 0.85)';
  for (let k = 0; k < 9; k++) {
    const bw = w * (0.06 + r() * 0.08);
    const bh = h * (0.05 + r() * 0.12);
    g.fillRect(x + r() * w, y + h * 0.95 - bh, bw, bh + h * 0.05);
  }
  for (const [px, ph, lean] of [[0.12, 0.25, 0.05], [0.3, 0.19, -0.04], [0.82, 0.27, -0.06], [0.95, 0.18, 0.04]]) {
    const bx = x + w * px;
    const by = y + h;
    const th = h * ph;
    g.strokeStyle = 'rgba(30, 6, 40, 0.92)';
    g.lineWidth = w * 0.022;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(bx, by);
    g.quadraticCurveTo(bx + w * lean, by - th * 0.6, bx + w * lean * 1.6, by - th);
    g.stroke();
    const tx = bx + w * lean * 1.6;
    const ty = by - th;
    g.lineWidth = w * 0.014;
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU + 0.3;
      const l = w * (0.13 + r() * 0.06);
      g.beginPath();
      g.moveTo(tx, ty);
      g.quadraticCurveTo(tx + Math.cos(a) * l * 0.6, ty - l * 0.25, tx + Math.cos(a) * l, ty + Math.abs(Math.sin(a)) * l * 0.5 + l * 0.15);
      g.stroke();
    }
  }
  // the words, in a brush hand, dark on the light
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#1f0a1c';
  const words = ['Luxury', 'Lives', 'Here'];
  words.forEach((wd, k) => {
    const s = fitText(g, wd, `700 # ${FONT_HAND}`, w * 0.33, w * 0.86, 0);
    g.save();
    g.translate(x + w / 2, y + h * (0.31 + k * 0.13));
    g.rotate(-0.06);
    g.font = `700 ${Math.round(s)}px ${FONT_HAND}`;
    g.fillText(wd, 0, 0);
    g.restore();
  });
  crown(g, x + w / 2, y + h * 0.71, w * 0.24, 'rgba(255, 246, 236, 0.95)', w * 0.012);
  // the hem and the hanging bar's shadow; the strokes of the hand over all of it
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(x, y, w, h * 0.012);
  hatch(g, r, x, y, w, h, 'rgba(60, 10, 40, 0.6)', 340, -1.0, 0.09);
  hatch(g, r, x, y, w, h, 'rgba(255, 230, 200, 0.45)', 120, -0.6, 0.06);
  g.restore();
}

// a face on a screen: a woman in big dark glasses, her hair long and waving, her lips red, a top
// to her chin's line - the neon of the screen round her (o: hue of it, which way she turns)
function paintFace(g, x, y, w, h, o, r) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const bg = g.createLinearGradient(x, y, x + w, y + h);
  bg.addColorStop(0, o.bg[0]);
  bg.addColorStop(0.55, o.bg[1]);
  bg.addColorStop(1, o.bg[2]);
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);
  // light behind her, palms in neon
  const lg = g.createRadialGradient(x + w * 0.5, y + h * 0.35, 0, x + w * 0.5, y + h * 0.35, w * 0.8);
  lg.addColorStop(0, 'rgba(255,255,255,0.35)');
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lg;
  g.fillRect(x, y, w, h);
  if (o.palms) {
    neonPalm(g, x + w * 0.1, y + h * 0.95, h * 0.45, o.neon);
    neonPalm(g, x + w * 0.88, y + h * 0.9, h * 0.38, o.neon);
  }
  const cx = x + w * (0.5 + (o.turn || 0) * 0.06);
  const cy = y + h * 0.4;
  const fw = w * 0.3;
  const fh = h * 0.21;
  // the hair behind
  g.fillStyle = o.hair;
  g.beginPath();
  g.moveTo(cx - fw * 1.25, cy + fh * 1.9);
  g.bezierCurveTo(cx - fw * 1.6, cy + fh * 0.4, cx - fw * 1.45, cy - fh * 1.35, cx, cy - fh * 1.45);
  g.bezierCurveTo(cx + fw * 1.45, cy - fh * 1.35, cx + fw * 1.6, cy + fh * 0.4, cx + fw * 1.25, cy + fh * 1.9);
  g.closePath();
  g.fill();
  // the shoulders and the top (to the collarbones: a high, modest neckline)
  g.fillStyle = o.top;
  g.beginPath();
  g.moveTo(x + w * 0.04, y + h);
  g.bezierCurveTo(x + w * 0.08, cy + fh * 1.7, cx - fw * 0.9, cy + fh * 1.45, cx - fw * 0.42, cy + fh * 1.35);
  g.lineTo(cx + fw * 0.42, cy + fh * 1.35);
  g.bezierCurveTo(cx + fw * 0.9, cy + fh * 1.45, x + w * 0.92, cy + fh * 1.7, x + w * 0.96, y + h);
  g.closePath();
  g.fill();
  // the neck
  g.fillStyle = o.skinD;
  g.fillRect(cx - fw * 0.33, cy + fh * 0.7, fw * 0.66, fh * 0.75);
  g.fillStyle = o.top;
  g.beginPath();
  g.ellipse(cx, cy + fh * 1.38, fw * 0.48, fh * 0.16, 0, 0, TAU);
  g.fill();
  // the face
  const fg = g.createLinearGradient(cx - fw, cy, cx + fw, cy);
  fg.addColorStop(0, o.skinD);
  fg.addColorStop(0.45, o.skin);
  fg.addColorStop(1, o.skinD);
  g.fillStyle = fg;
  g.beginPath();
  g.moveTo(cx - fw * 0.82, cy - fh * 0.5);
  g.bezierCurveTo(cx - fw * 0.9, cy + fh * 0.5, cx - fw * 0.42, cy + fh * 1.02, cx, cy + fh * 1.05);
  g.bezierCurveTo(cx + fw * 0.42, cy + fh * 1.02, cx + fw * 0.9, cy + fh * 0.5, cx + fw * 0.82, cy - fh * 0.5);
  g.bezierCurveTo(cx + fw * 0.8, cy - fh * 1.15, cx - fw * 0.8, cy - fh * 1.15, cx - fw * 0.82, cy - fh * 0.5);
  g.fill();
  // the hair over the forehead, parted, falling either side
  g.fillStyle = o.hair;
  g.beginPath();
  g.moveTo(cx - fw * 0.95, cy + fh * 0.2);
  g.bezierCurveTo(cx - fw * 1.0, cy - fh * 1.05, cx - fw * 0.3, cy - fh * 1.3, cx + fw * 0.08, cy - fh * 1.0);
  g.bezierCurveTo(cx - fw * 0.35, cy - fh * 0.8, cx - fw * 0.7, cy - fh * 0.3, cx - fw * 0.95, cy + fh * 0.2);
  g.fill();
  g.beginPath();
  g.moveTo(cx + fw * 0.95, cy + fh * 0.3);
  g.bezierCurveTo(cx + fw * 1.05, cy - fh * 1.0, cx + fw * 0.35, cy - fh * 1.25, cx + fw * 0.05, cy - fh * 1.0);
  g.bezierCurveTo(cx + fw * 0.45, cy - fh * 0.75, cx + fw * 0.75, cy - fh * 0.2, cx + fw * 0.95, cy + fh * 0.3);
  g.fill();
  // strands of it, lighter, waving down to the shoulders
  g.strokeStyle = o.hairHi;
  g.lineCap = 'round';
  for (let k = 0; k < 46; k++) {
    const sd = k % 2 ? 1 : -1;
    const sx0 = cx + sd * fw * (0.5 + r() * 0.6);
    const sy0 = cy - fh * (0.9 - r() * 0.6);
    g.lineWidth = 1 + r() * 2.5;
    g.globalAlpha = 0.25 + r() * 0.4;
    g.beginPath();
    g.moveTo(sx0, sy0);
    g.bezierCurveTo(sx0 + sd * fw * 0.5, sy0 + fh * 0.8, sx0 + sd * fw * (0.1 + r() * 0.4), sy0 + fh * 1.6, sx0 + sd * fw * (0.4 + r() * 0.5), sy0 + fh * (2.2 + r() * 0.6));
    g.stroke();
  }
  g.globalAlpha = 1;
  // the glasses: two big dark lenses, the screen's light across them, a gold bridge
  const ly = cy - fh * 0.12;
  for (const sd of [-1, 1]) {
    const lx = cx + sd * fw * 0.42;
    const lens = g.createLinearGradient(lx - fw * 0.3, ly - fh * 0.3, lx + fw * 0.3, ly + fh * 0.3);
    lens.addColorStop(0, '#0d0a14');
    lens.addColorStop(0.5, o.lens);
    lens.addColorStop(1, '#07060b');
    g.fillStyle = lens;
    g.beginPath();
    g.ellipse(lx, ly, fw * 0.36, fh * 0.27, sd * 0.08, 0, TAU);
    g.fill();
    g.strokeStyle = '#d9b46a';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.ellipse(lx - fw * 0.12, ly - fh * 0.1, fw * 0.1, fh * 0.05, -0.5, 0, TAU);
    g.fill();
  }
  g.strokeStyle = '#d9b46a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx - fw * 0.08, ly - fh * 0.08);
  g.quadraticCurveTo(cx, ly - fh * 0.16, cx + fw * 0.08, ly - fh * 0.08);
  g.stroke();
  // the nose's shade, the lips
  g.strokeStyle = o.skinD;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx + fw * 0.04, cy + fh * 0.15);
  g.quadraticCurveTo(cx + fw * 0.1, cy + fh * 0.42, cx - fw * 0.03, cy + fh * 0.48);
  g.stroke();
  g.fillStyle = o.lips;
  g.beginPath();
  g.moveTo(cx - fw * 0.26, cy + fh * 0.7);
  g.quadraticCurveTo(cx - fw * 0.1, cy + fh * 0.6, cx, cy + fh * 0.64);
  g.quadraticCurveTo(cx + fw * 0.1, cy + fh * 0.6, cx + fw * 0.26, cy + fh * 0.7);
  g.quadraticCurveTo(cx, cy + fh * 0.86, cx - fw * 0.26, cy + fh * 0.7);
  g.fill();
  // earrings of gold
  g.fillStyle = '#e8c672';
  for (const sd of [-1, 1]) {
    g.beginPath();
    g.arc(cx + sd * fw * 0.86, cy + fh * 0.35, fw * 0.06, 0, TAU);
    g.fill();
  }
  // the name of the house at the foot, the line of the season, on a band of shade
  if (o.brand) {
    const sb = g.createLinearGradient(0, y + h * 0.78, 0, y + h);
    sb.addColorStop(0, 'rgba(10, 4, 16, 0)');
    sb.addColorStop(0.35, 'rgba(10, 4, 16, 0.55)');
    sb.addColorStop(1, 'rgba(10, 4, 16, 0.8)');
    g.fillStyle = sb;
    g.fillRect(x, y + h * 0.78, w, h * 0.22);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    const s = fitText(g, o.brand, `600 # ${FONT_SERIF}`, w * 0.13, w * 0.8, 0.2);
    glow(g, o.neon, s * 0.6, () => g.fillText(o.brand, x + w / 2, y + h * 0.88));
    fitText(g, o.line || 'NEW SEASON', `500 # ${FONT_SANS}`, w * 0.045, w * 0.7, 0.4);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillText(o.line || 'NEW SEASON', x + w / 2, y + h * 0.945);
  }
  hatch(g, r, x, y, w, h, 'rgba(20, 10, 30, 0.55)', 260, -0.95, 0.08);
  hatch(g, r, x, y, w, h, 'rgba(255, 255, 255, 0.35)', 90, -0.4, 0.06);
  g.restore();
}

// a thing on a screen: a watch on its dial's light, a bottle of perfume, a beach at sunset
function paintThing(g, x, y, w, h, kind, r) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  if (kind === 'watch') {
    const bg = g.createRadialGradient(x + w / 2, y + h * 0.42, 0, x + w / 2, y + h * 0.42, h * 0.7);
    bg.addColorStop(0, '#1d3a5c');
    bg.addColorStop(1, '#050a14');
    g.fillStyle = bg;
    g.fillRect(x, y, w, h);
    const cx = x + w / 2;
    const cy = y + h * 0.42;
    const R = w * 0.33;
    // the strap, the case, the dial, its hands
    g.fillStyle = '#2b2a2e';
    g.fillRect(cx - R * 0.55, y - 10, R * 1.1, h * 0.8);
    const cs = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    cs.addColorStop(0, '#f6e2a6');
    cs.addColorStop(0.5, '#b88a3c');
    cs.addColorStop(1, '#f3d58e');
    g.fillStyle = cs;
    g.beginPath();
    g.arc(cx, cy, R * 1.12, 0, TAU);
    g.fill();
    const dl = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R);
    dl.addColorStop(0, '#2a5c8c');
    dl.addColorStop(1, '#0b1f36');
    g.fillStyle = dl;
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.fill();
    g.strokeStyle = '#f2d590';
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      g.lineWidth = k % 3 ? 3 : 6;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78);
      g.lineTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92);
      g.stroke();
    }
    g.lineCap = 'round';
    for (const [a, l, wd] of [[-1.1, 0.5, 8], [0.75, 0.72, 5], [2.4, 0.8, 2]]) {
      g.lineWidth = wd;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * R * l, cy + Math.sin(a) * R * l);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.ellipse(cx - R * 0.35, cy - R * 0.4, R * 0.5, R * 0.22, -0.6, 0, TAU);
    g.fill();
  } else if (kind === 'perfume') {
    const bg = g.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, '#3a0d3e');
    bg.addColorStop(0.6, '#b0306e');
    bg.addColorStop(1, '#ff8a6a');
    g.fillStyle = bg;
    g.fillRect(x, y, w, h);
    const cx = x + w / 2;
    const by = y + h * 0.72;
    const bw = w * 0.42;
    const bh = h * 0.36;
    const gl = g.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
    gl.addColorStop(0, 'rgba(255, 170, 200, 0.75)');
    gl.addColorStop(0.5, 'rgba(255, 230, 240, 0.95)');
    gl.addColorStop(1, 'rgba(230, 120, 170, 0.75)');
    g.fillStyle = gl;
    g.beginPath();
    g.moveTo(cx - bw / 2, by);
    g.lineTo(cx - bw / 2 + 12, by - bh);
    g.lineTo(cx + bw / 2 - 12, by - bh);
    g.lineTo(cx + bw / 2, by);
    g.closePath();
    g.fill();
    g.fillStyle = '#e8c67a';
    g.fillRect(cx - bw * 0.18, by - bh - h * 0.09, bw * 0.36, h * 0.09);
    crown(g, cx, by - bh * 0.5, bw * 0.4, '#b88a3c', 3);
  } else {
    // the beach at sunset: the sea, the sun on it, palms
    const bg = g.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, '#2a1060');
    bg.addColorStop(0.35, '#d0307e');
    bg.addColorStop(0.55, '#ff9a4a');
    bg.addColorStop(0.62, '#ffd27a');
    bg.addColorStop(0.63, '#2a6a9a');
    bg.addColorStop(1, '#0a2448');
    g.fillStyle = bg;
    g.fillRect(x, y, w, h);
    g.fillStyle = '#fff2c4';
    g.beginPath();
    g.arc(x + w * 0.5, y + h * 0.6, w * 0.16, Math.PI, TAU);
    g.fill();
    for (let k = 0; k < 14; k++) {
      g.fillStyle = `rgba(255, 220, 150, ${0.5 - k * 0.03})`;
      g.fillRect(x + w * (0.5 - 0.12 + r() * 0.02) - k * 2, y + h * (0.64 + k * 0.025), w * 0.24 + k * 4, 3);
    }
    neonPalm(g, x + w * 0.12, y + h * 0.98, h * 0.5, '#2a0a30');
    neonPalm(g, x + w * 0.86, y + h * 0.98, h * 0.42, '#2a0a30');
  }
  hatch(g, r, x, y, w, h, 'rgba(0, 0, 0, 0.45)', 200, -0.95, 0.08);
  g.restore();
}

// the mall's name in light: the crown over BAYVIEW, MALL under it (on nothing: the water behind)
function paintLogo(g, x, y, w, h) {
  g.save();
  g.clearRect(x, y, w, h);
  const cx = x + w / 2;
  g.strokeStyle = '#fff6e2';
  glow(g, 'rgba(255, 220, 160, 0.9)', 18, () => crown(g, cx, y + h * 0.3, w * 0.42, '#fff6e2', w * 0.018));
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff6e6';
  const s = fitText(g, 'BAYVIEW', `500 # ${FONT_SANS}`, h * 0.16, w * 0.92, 0.22);
  glow(g, 'rgba(255, 220, 170, 0.95)', s * 0.5, () => g.fillText('BAYVIEW', cx, y + h * 0.66));
  fitText(g, 'MALL', `500 # ${FONT_SANS}`, h * 0.16, w * 0.5, 0.35);
  glow(g, 'rgba(255, 220, 170, 0.95)', s * 0.5, () => g.fillText('MALL', cx, y + h * 0.84));
  g.restore();
}

/** the pictures of the hall, on one: { tex, banner, logo, crown, ads: [...] } (each a uv rect) */
export function bayArt() {
  const W = 2048;
  const H = 2048;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const r = dice(777);
  // the banner: 512 by 1536 at the left
  paintBanner(g, 0, 0, 512, 1536, r);
  // the logo: 512 square under it
  paintLogo(g, 0, 1536, 512, 512);
  // the screens: 384 by 768 each, two rows of four
  const faces = [
    { bg: ['#ff2f8a', '#8a2bd8', '#2bc8ff'], neon: '#ff3fa4', skin: '#e8b394', skinD: '#b97d62', hair: '#2a1712', hairHi: '#6a4430', top: '#1c1022', lens: '#ff4fae', lips: '#d42a4a', brand: 'SOLARA', line: 'SUMMER COLLECTION', palms: true },
    { bg: ['#16d4ff', '#7a2bff', '#ff2f9a'], neon: '#4fd8ff', skin: '#c98f6c', skinD: '#8f5c40', hair: '#120b08', hairHi: '#4a2c1c', top: '#f2f0ec', lens: '#4fc8ff', lips: '#b0203c', brand: 'VELORA', line: 'COUTURE', turn: -1 },
    { bg: ['#ff8a3a', '#ff2f6e', '#5a1e9a'], neon: '#ffb04a', skin: '#f1c6a8', skinD: '#c18a6c', hair: '#6a3a1e', hairHi: '#c08850', top: '#c8243e', lens: '#ffa04a', lips: '#e02a50', brand: 'MIRAGE', line: 'NEW SEASON', palms: true, turn: 1 },
    { bg: ['#7a2bff', '#ff2fa0', '#ffb04a'], neon: '#c08cff', skin: '#a36a4c', skinD: '#6e4430', hair: '#0e0806', hairHi: '#3a2418', top: '#14141c', lens: '#c06cff', lips: '#a01e3c', brand: 'BELLA COSTA', line: 'SWIM 2026' },
  ];
  const ads = [];
  faces.forEach((o, i) => {
    const x = 512 + (i % 4) * 384;
    paintFace(g, x, 0, 384, 768, o, r);
    ads.push(uvOf(W, H, x, 0, 384, 768));
  });
  ['watch', 'perfume', 'beach'].forEach((k, i) => {
    const x = 512 + i * 384;
    paintThing(g, x, 768, 384, 768, k, r);
    ads.push(uvOf(W, H, x, 768, 384, 768));
  });
  // a crown alone (the cars' stands, the pedestals): 256 square
  g.fillStyle = '#0c0a0e';
  g.fillRect(1664, 768, 256, 256);
  crown(g, 1792, 896, 150, '#e2bd6c', 7);
  return {
    tex: canvasTexture(c, { mips: true }),
    banner: uvOf(W, H, 0, 0, 512, 1536),
    logo: uvOf(W, H, 0, 1536, 512, 512),
    crown: uvOf(W, H, 1664, 768, 256, 256),
    ads,
  };
}

// ------------------------------------------------------------------ the water
// the waterfall's sheet of water: streaks of white and pale aqua down a deep blue (it repeats down
// its length; the hall slides it down, render/glsl.js uScroll)
export function bayWater() {
  const W = 256;
  const H = 1024;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const r = dice(31);
  const bg = g.createLinearGradient(0, 0, W, 0);
  bg.addColorStop(0, '#173c66');
  bg.addColorStop(0.5, '#2a6496');
  bg.addColorStop(1, '#173c66');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.lineCap = 'round';
  for (let k = 0; k < 520; k++) {
    const x = r() * W;
    const y = r() * H;
    const L = 30 + r() * 220;
    const col = r() < 0.6 ? `rgba(220, 245, 255, ${0.25 + r() * 0.6})` : `rgba(140, 220, 255, ${0.2 + r() * 0.5})`;
    g.strokeStyle = col;
    g.lineWidth = 0.8 + r() * 2.6;
    for (const dy of [0, -H, H]) {
      g.beginPath();
      g.moveTo(x, y + dy);
      g.lineTo(x + (r() - 0.5) * 3, y + dy + L);
      g.stroke();
    }
  }
  return canvasTexture(c, { repeat: true });
}

// ------------------------------------------------------------------ the palms' bark
// a royal palm's trunk the way the hall's are: warm tan, the scars of its old leaves in a net of
// diamonds round it, a little darker in their joints (it repeats round the trunk and up it)
export function bayTrunk() {
  const W = 128;
  const H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const r = dice(57);
  g.fillStyle = '#b08a64';
  g.fillRect(0, 0, W, H);
  for (let k = 0; k < 900; k++) {
    g.fillStyle = `rgba(${90 + r() * 80}, ${60 + r() * 50}, ${40 + r() * 30}, ${0.15 + r() * 0.2})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 2);
  }
  // the net of scars: diagonals both ways, every quarter of the way round, every 32 pixels up
  g.lineCap = 'round';
  for (const d of [-1, 1]) {
    for (let k = -8; k < 12; k++) {
      for (const [w, col] of [[5, 'rgba(70, 46, 30, 0.55)'], [1.6, 'rgba(225, 196, 150, 0.6)']]) {
        g.strokeStyle = col;
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(k * 32, 0);
        g.lineTo(k * 32 + d * H * 0.5, H);
        g.stroke();
      }
    }
  }
  return canvasTexture(c, { repeat: true });
}
