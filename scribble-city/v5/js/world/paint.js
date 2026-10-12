import * as THREE from 'three';
import { canvas, handLine } from './kit.js';
import { canvasTexture } from '../render/materials.js';

// Things painted on canvas before they go into the world: the street and its markings,
// the pavers, neon lettering, banners, the big green road sign, a mural, palm fronds.

export function streetTexture() {
  // 16 m across (x) by 16 m along (z): lanes at x = -3 .. 13, the centre line at x = 5
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#4a4258';
  g.fillRect(0, 0, 512, 512);
  // patches of newer and older asphalt
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '30, 26, 40' : '96, 84, 104'}, ${0.08 + Math.random() * 0.12})`;
    g.beginPath();
    g.ellipse(Math.random() * 512, Math.random() * 512, 10 + Math.random() * 40, 6 + Math.random() * 30, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const X = (x) => ((x + 3) / 16) * 512;
  // double yellow in the middle
  g.fillStyle = '#f4c63c';
  g.fillRect(X(4.86) - 3, 0, 5, 512);
  g.fillRect(X(5.14) - 2, 0, 5, 512);
  // dashed white lanes
  g.fillStyle = '#efe9e4';
  for (const lx of [1, 9]) for (let y = 0; y < 512; y += 128) g.fillRect(X(lx) - 3, y + 10, 6, 64);
  // the edges
  g.fillRect(X(-2.75) - 3, 0, 6, 512);
  g.fillRect(X(12.75) - 3, 0, 6, 512);
  // cracks
  for (let i = 0; i < 14; i++) {
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    const pts = [[x, y]];
    for (let k = 0; k < 6; k++) {
      x += (Math.random() - 0.5) * 30;
      y += Math.random() * 26;
      pts.push([x, y]);
    }
    handLine(g, pts, 1.2, 'rgba(20, 16, 28, 0.6)', 1, 0.5);
  }
  return canvasTexture(c, { repeat: true });
}

export function paverTexture(base = '#e9c4b8', line = 'rgba(120, 80, 90, 0.55)') {
  // 8 x 8 m of pavers, 0.5 m squares
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 256; i++) {
    const x = (i % 16) * 32;
    const y = Math.floor(i / 16) * 32;
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255, 240, 230' : '160, 110, 120'}, ${Math.random() * 0.14})`;
    g.fillRect(x, y, 32, 32);
  }
  g.strokeStyle = line;
  g.lineWidth = 2;
  for (let k = 0; k <= 16; k++) {
    g.beginPath();
    g.moveTo(k * 32, 0);
    g.lineTo(k * 32, 512);
    g.moveTo(0, k * 32);
    g.lineTo(512, k * 32);
    g.stroke();
  }
  return canvasTexture(c, { repeat: true });
}

// glowing letters: a soft halo, the tube itself, a white-hot core
export function neonText(text, { font = 'Caveat', size = 120, color = '#ff3fa4', w = 1024, h = 256, italic = false, align = 'center' } = {}) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.font = `${italic ? 'italic ' : ''}700 ${size}px "${font}", "Rubik", sans-serif`;
  const x = align === 'center' ? w / 2 : 20;
  // just the tubes: the glow around them comes from the light itself (the bloom)
  g.lineWidth = size * 0.11;
  g.strokeStyle = color;
  g.strokeText(text, x, h / 2);
  // the hot core of the tube: the colour, much lighter
  g.lineWidth = size * 0.045;
  g.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  g.strokeText(text, x, h / 2);
  return canvasTexture(c, { mips: false });
}

// a painted sign (dark letters on a colour), e.g. a banner
export function paintedSign(lines, { bg = '#f6e3c8', fg = '#2a1a3a', font = 'Permanent Marker', size = 64, w = 256, h = 768, vertical = false, border = '#2a1a3a' } = {}) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = border;
  g.lineWidth = 8;
  g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${size}px "${font}", "Rubik", sans-serif`;
  const n = lines.length;
  lines.forEach((t, i) => {
    const y = vertical ? h * (0.15 + 0.7 * ((i + 0.5) / n)) : h / 2 + (i - (n - 1) / 2) * size * 1.1;
    g.fillText(t, w / 2, y);
  });
  return canvasTexture(c);
}

// the big green road sign over the street
export function roadSign(...rowsIn) {
  const w = 1024;
  const h = 512;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#1f6a4e';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#f4f1ea';
  g.lineWidth = 10;
  g.strokeRect(16, 16, w - 32, h - 32);
  g.fillStyle = '#f4f1ea';
  g.font = '700 84px "Caveat", "Rubik", sans-serif';
  g.textBaseline = 'middle';
  const rows = rowsIn.length ? rowsIn : [['Bayview', '↑'], ['Downtown', '↑'], ['Sunset Beach', '→']];
  rows.forEach(([t, a], i) => {
    const y = 110 + i * 140;
    g.textAlign = 'left';
    g.fillText(t, 60, y);
    g.textAlign = 'center';
    g.font = '700 96px "Rubik", sans-serif';
    g.fillText(a, w - 210, y);
    g.font = '700 84px "Caveat", "Rubik", sans-serif';
  });
  // a little palm on the shield
  g.strokeStyle = '#f4f1ea';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(w - 90, 400);
  g.quadraticCurveTo(w - 95, 330, w - 80, 270);
  g.stroke();
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI * 0.95 + k * 0.38;
    g.beginPath();
    g.moveTo(w - 80, 270);
    g.quadraticCurveTo(w - 80 + Math.cos(a) * 40, 270 + Math.sin(a) * 40 - 12, w - 80 + Math.cos(a) * 70, 270 + Math.sin(a) * 70 + 10);
    g.stroke();
  }
  return canvasTexture(c);
}

// a mural on a wall: a giant flamingo standing in a sunset, palms, bold strokes
export function mural() {
  const w = 1024;
  const h = 768;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#3b2b8f');
  sky.addColorStop(0.45, '#ff4f9a');
  sky.addColorStop(0.75, '#ffb347');
  sky.addColorStop(1, '#2bc4c4');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // the sun with stripes
  g.fillStyle = '#ffe066';
  g.beginPath();
  g.arc(w * 0.62, h * 0.6, 190, Math.PI, 0);
  g.fill();
  g.fillStyle = '#ff4f9a';
  for (let k = 0; k < 5; k++) g.fillRect(w * 0.62 - 200, h * 0.6 - 30 - k * 34, 400, 9 + k);
  // water
  g.fillStyle = '#2bc4c4';
  g.fillRect(0, h * 0.6, w, h * 0.4);
  g.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  g.lineWidth = 6;
  for (let k = 0; k < 9; k++) {
    g.beginPath();
    const y = h * 0.66 + k * 26;
    g.moveTo(w * 0.42 + Math.random() * 40, y);
    g.lineTo(w * 0.82 - Math.random() * 40, y);
    g.stroke();
  }
  // palms in silhouette
  const palm = (x, base, hgt, lean) => {
    g.strokeStyle = '#1b1240';
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(x, base);
    g.quadraticCurveTo(x + lean * 0.5, base - hgt * 0.6, x + lean, base - hgt);
    g.stroke();
    g.lineWidth = 12;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI + k * 0.5 + 0.1;
      g.beginPath();
      g.moveTo(x + lean, base - hgt);
      g.quadraticCurveTo(x + lean + Math.cos(a) * 80, base - hgt + Math.sin(a) * 80 - 30, x + lean + Math.cos(a) * 140, base - hgt + Math.sin(a) * 120 + 40);
      g.stroke();
    }
  };
  palm(110, h, 420, 60);
  palm(w - 90, h, 360, -50);
  // the flamingo
  g.fillStyle = '#ff6fb1';
  g.strokeStyle = '#1b1240';
  g.lineWidth = 8;
  g.beginPath();
  g.ellipse(330, 430, 120, 70, -0.25, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(410, 380);
  g.bezierCurveTo(470, 300, 360, 250, 400, 170);
  g.lineWidth = 26;
  g.strokeStyle = '#ff6fb1';
  g.stroke();
  g.lineWidth = 6;
  g.strokeStyle = '#1b1240';
  g.stroke();
  g.fillStyle = '#ff6fb1';
  g.beginPath();
  g.arc(408, 160, 26, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#1b1240';
  g.beginPath();
  g.moveTo(428, 152);
  g.lineTo(470, 175);
  g.lineTo(430, 178);
  g.fill();
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(320, 490);
  g.lineTo(325, 700);
  g.moveTo(350, 490);
  g.lineTo(380, 600);
  g.lineTo(335, 610);
  g.stroke();
  // the artist's tag
  g.fillStyle = '#fff4d6';
  g.font = '700 70px "Permanent Marker", sans-serif';
  g.fillText('Stay Golden', 560, 140);
  return canvasTexture(c);
}

// a palm frond: a curved rib with a fan of long leaflets each side (alpha)
export function frondTexture() {
  const w = 256;
  const h = 1024;
  // the colour and the leaf's shape are painted apart: the green reaches into the gaps between
  // the leaflets too (where the leaf is see-through), so the smaller copies of the texture that
  // the far palms are drawn with stay green instead of going black at their edges
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#3d9455';
  g.fillRect(0, 0, w, h);
  const m = canvas(w, h);
  const k = m.getContext('2d');
  k.fillStyle = '#000';
  k.fillRect(0, 0, w, h);
  for (const q of [g, k]) q.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const t = i / 70;
    const y = 40 + t * (h - 80);
    const len = Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.9) * (w * 0.48) * (0.75 + Math.random() * 0.3);
    for (const s of [-1, 1]) {
      const col = Math.random() < 0.5 ? '#2f8a4f' : Math.random() < 0.5 ? '#3fa15a' : '#6fbf5a';
      for (const [q, st] of [[g, col], [k, '#fff']]) {
        q.strokeStyle = st;
        q.lineWidth = 9 - t * 4;
        q.beginPath();
        q.moveTo(w / 2, y);
        q.quadraticCurveTo(w / 2 + s * len * 0.6, y + 20, w / 2 + s * len, y + 60 + t * 40);
        q.stroke();
      }
    }
  }
  for (const [q, st] of [[g, '#4d6b2e'], [k, '#fff']]) {
    q.strokeStyle = st;
    q.lineWidth = 10;
    q.beginPath();
    q.moveTo(w / 2, 10);
    q.lineTo(w / 2, h - 10);
    q.stroke();
  }
  const ci = g.getImageData(0, 0, w, h).data;
  const mi = k.getImageData(0, 0, w, h).data;
  const d = new Uint8Array(w * h * 4);
  // (rows bottom-up, the way a canvas texture is turned)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const j = ((h - 1 - y) * w + x) * 4;
      d[j] = ci[i];
      d[j + 1] = ci[i + 1];
      d[j + 2] = ci[i + 2];
      d[j + 3] = mi[i];
    }
  }
  const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

// what you see through a shop window at dusk: a warm room, shelves of colour, lamps, a counter
export function shopInterior(kind = 'market', seed = 1) {
  const w = 1024;
  const h = 320;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  let s = seed * 9301 + 49297;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, kind === 'bar' ? '#5a2a6e' : '#ffcf8a');
  bg.addColorStop(0.55, kind === 'bar' ? '#a2406e' : '#ff9f5a');
  bg.addColorStop(1, kind === 'bar' ? '#3a1840' : '#c4603a');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  // shelves along the back wall, packed with colourful things
  const cols = ['#ff4f6a', '#ffd23f', '#3fd0c9', '#7a5cff', '#ff8a3c', '#9be15d', '#f6f1e7', '#ff6fb1'];
  for (let row = 0; row < 3; row++) {
    const y = 40 + row * 62;
    g.fillStyle = 'rgba(70, 35, 30, 0.85)';
    g.fillRect(0, y + 44, w, 7);
    for (let x = 6; x < w - 10; ) {
      const iw = 10 + r() * 22;
      const ih = 18 + r() * 26;
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      if (kind === 'bar') {
        // bottles
        g.fillRect(x, y + 44 - ih, iw * 0.6, ih);
        g.fillRect(x + iw * 0.18, y + 44 - ih - 10, iw * 0.24, 10);
      } else g.fillRect(x, y + 44 - ih, iw, ih);
      x += iw + 4 + r() * 6;
    }
  }
  // pendant lamps
  for (let k = 0; k < 6; k++) {
    const x = 80 + k * 170 + r() * 30;
    g.strokeStyle = 'rgba(40, 20, 20, 0.8)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 26);
    g.stroke();
    const grd = g.createRadialGradient(x, 34, 2, x, 34, 40);
    grd.addColorStop(0, 'rgba(255, 250, 220, 1)');
    grd.addColorStop(1, 'rgba(255, 220, 150, 0)');
    g.fillStyle = grd;
    g.fillRect(x - 40, 0, 80, 80);
    g.fillStyle = '#fff6d6';
    g.beginPath();
    g.arc(x, 32, 9, 0, Math.PI * 2);
    g.fill();
  }
  // the counter and somebody behind it
  g.fillStyle = 'rgba(60, 30, 40, 0.9)';
  g.fillRect(0, h - 70, w, 70);
  const px = 300 + r() * 400;
  g.fillStyle = 'rgba(40, 25, 50, 0.9)';
  g.beginPath();
  g.arc(px, h - 132, 20, 0, Math.PI * 2);
  g.fill();
  g.fillRect(px - 28, h - 112, 56, 50);
  // crates of fruit, plants, a cake stand...
  for (let k = 0; k < 8; k++) {
    const x = r() * w;
    if (kind === 'market') {
      g.fillStyle = '#8a5a3a';
      g.fillRect(x, h - 64, 70, 34);
      for (let f = 0; f < 7; f++) {
        g.fillStyle = cols[Math.floor(r() * 5)];
        g.beginPath();
        g.arc(x + 8 + f * 9, h - 66, 7, 0, Math.PI * 2);
        g.fill();
      }
    } else if (kind === 'cafe') {
      g.fillStyle = '#3a2420';
      g.fillRect(x, h - 60, 50, 6);
      g.fillRect(x + 22, h - 54, 6, 40);
      g.fillStyle = '#fff3d6';
      g.fillRect(x + 8, h - 70, 10, 10);
    } else {
      g.fillStyle = '#2f8a4f';
      g.beginPath();
      g.arc(x, h - 80, 24, 0, Math.PI * 2);
      g.fill();
    }
  }
  return canvasTexture(c);
}

// clothes, drawn flat before they are wrapped round the body: folds, seams, pockets
export function clothTexture(base, kind = 'tee') {
  const w = 256;
  const h = 256;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const fold = (x0, y0, x1, y1, a, wid) => {
    g.strokeStyle = `rgba(60, 60, 110, ${a})`;
    g.lineWidth = wid;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2 + (Math.random() - 0.5) * 30, (y0 + y1) / 2, x1, y1);
    g.stroke();
  };
  if (kind === 'tee' || kind === 'shirt') {
    // soft folds running down from the shoulders, a crease at the waist, the hem
    for (let k = 0; k < 9; k++) {
      const x = Math.random() * w;
      fold(x, h * 0.95, x + (Math.random() - 0.5) * 60, h * (0.35 + Math.random() * 0.3), 0.12 + Math.random() * 0.12, 6 + Math.random() * 10);
    }
    for (let k = 0; k < 4; k++) fold(Math.random() * w, h * 0.12, Math.random() * w, h * 0.2, 0.15, 5);
    g.fillStyle = 'rgba(60, 60, 110, 0.25)';
    g.fillRect(0, 0, w, 7);
    if (kind === 'shirt') {
      // the button placket down the front (u = 0 is the front of the body)
      g.fillStyle = 'rgba(40, 40, 70, 0.6)';
      for (let y = 30; y < h - 20; y += 34) {
        g.fillRect(2, y, 5, 5);
        g.fillRect(w - 7, y, 5, 5);
      }
      g.fillRect(0, 0, 2, h);
      g.fillRect(w - 2, 0, 2, h);
    }
  } else if (kind === 'cargo') {
    for (let k = 0; k < 7; k++) {
      const x = Math.random() * w;
      fold(x, 0, x + (Math.random() - 0.5) * 30, h, 0.18, 5 + Math.random() * 6);
    }
    g.strokeStyle = 'rgba(30, 30, 40, 0.55)';
    g.lineWidth = 3;
    for (const x of [w * 0.25, w * 0.75]) {
      g.strokeRect(x - 26, h * 0.45, 52, 46);
      g.beginPath();
      g.moveTo(x - 28, h * 0.45 + 12);
      g.lineTo(x + 28, h * 0.45 + 12);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(0, h * 0.02);
    g.lineTo(w, h * 0.02);
    g.stroke();
  } else if (kind === 'skirt') {
    for (let k = 0; k < 14; k++) {
      const x = (k / 14) * w + Math.random() * 8;
      fold(x, 0, x + (Math.random() - 0.5) * 20, h, 0.14 + Math.random() * 0.1, 4 + Math.random() * 8);
    }
    // a hem and a pattern of little flowers on some
    g.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let k = 0; k < 40; k++) {
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  return canvasTexture(c, { repeat: true });
}

// ------------------------------------------------------------------ the bigger city's ground
// The avenues: 14 m across, two lanes each way, the double yellow in the middle (tiles along z).
export function aveTexture() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#4a4258';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '30, 26, 40' : '96, 84, 104'}, ${0.08 + Math.random() * 0.12})`;
    g.beginPath();
    g.ellipse(Math.random() * 512, Math.random() * 512, 10 + Math.random() * 40, 6 + Math.random() * 30, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const X = (x) => (x / 14) * 512;
  g.fillStyle = '#f4c63c';
  g.fillRect(X(6.86) - 3, 0, 5, 512);
  g.fillRect(X(7.14) - 2, 0, 5, 512);
  g.fillStyle = '#efe9e4';
  for (const lx of [3.5, 10.5]) for (let y = 0; y < 512; y += 128) g.fillRect(X(lx) - 3, y + 10, 6, 64);
  g.fillRect(X(0.3) - 3, 0, 6, 512);
  g.fillRect(X(13.7) - 3, 0, 6, 512);
  for (let i = 0; i < 12; i++) {
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    const pts = [[x, y]];
    for (let k = 0; k < 6; k++) {
      x += (Math.random() - 0.5) * 30;
      y += Math.random() * 26;
      pts.push([x, y]);
    }
    handLine(g, pts, 1.2, 'rgba(20, 16, 28, 0.6)', 1, 0.5);
  }
  return canvasTexture(c, { repeat: true });
}

// The cross streets: 12 m, a lane each way and parking along both curbs (tiles along x).
export function crossTexture() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#4a4258';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '30, 26, 40' : '96, 84, 104'}, ${0.08 + Math.random() * 0.12})`;
    g.beginPath();
    g.ellipse(Math.random() * 512, Math.random() * 512, 10 + Math.random() * 40, 6 + Math.random() * 30, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // u: across the street (0..12 m), v: along it
  const X = (x) => (x / 12) * 512;
  g.fillStyle = '#f4c63c';
  g.fillRect(X(5.86) - 3, 0, 5, 512);
  g.fillRect(X(6.14) - 2, 0, 5, 512);
  g.fillStyle = '#efe9e4';
  // the parking lanes: a line and a tick every 6 m
  g.fillRect(X(2.4) - 2, 0, 4, 512);
  g.fillRect(X(9.6) - 2, 0, 4, 512);
  for (let y = 0; y < 512; y += 256) {
    g.fillRect(X(0.2), y, X(2.2) - X(0.2), 4);
    g.fillRect(X(9.8), y, X(11.8) - X(9.8), 4);
  }
  for (let i = 0; i < 12; i++) {
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    const pts = [[x, y]];
    for (let k = 0; k < 6; k++) {
      x += (Math.random() - 0.5) * 30;
      y += Math.random() * 26;
      pts.push([x, y]);
    }
    handLine(g, pts, 1.2, 'rgba(20, 16, 28, 0.6)', 1, 0.5);
  }
  return canvasTexture(c, { repeat: true });
}

// plain asphalt: the crossings, parking lots, the alleys (8 x 8 m)
export function asphaltTexture() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#4a4258';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '30, 26, 40' : '96, 84, 104'}, ${0.08 + Math.random() * 0.14})`;
    g.beginPath();
    g.ellipse(Math.random() * 512, Math.random() * 512, 10 + Math.random() * 50, 6 + Math.random() * 40, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 16; i++) {
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    const pts = [[x, y]];
    for (let k = 0; k < 6; k++) {
      x += (Math.random() - 0.5) * 34;
      y += (Math.random() - 0.5) * 34;
      pts.push([x, y]);
    }
    handLine(g, pts, 1.2, 'rgba(20, 16, 28, 0.6)', 1, 0.5);
  }
  return canvasTexture(c, { repeat: true });
}

// zebra stripes, laid over the crossings (alpha)
export function crosswalkTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  // 8 stripes across a 4 m wide crossing; v runs along the stripes
  for (let k = 0; k < 8; k++) {
    g.fillStyle = `rgba(239, 233, 228, ${0.85 + Math.random() * 0.15})`;
    const x = k * 32 + 6;
    g.beginPath();
    g.moveTo(x + Math.random() * 2, 4);
    g.lineTo(x + 18 + Math.random() * 2, 4);
    g.lineTo(x + 18 + Math.random() * 2, 252);
    g.lineTo(x + Math.random() * 2, 252);
    g.fill();
  }
  return canvasTexture(c, { repeat: true });
}

// big square tiles (a plaza), 8 x 8 m with 1 m tiles in two tones
export function tileTexture(a = '#e9c9b0', b = '#d7a98f') {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? a : b;
      g.fillRect(x * 64, y * 64, 64, 64);
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255, 240, 230' : '150, 100, 110'}, ${Math.random() * 0.12})`;
      g.fillRect(x * 64, y * 64, 64, 64);
    }
  }
  g.strokeStyle = 'rgba(120, 80, 90, 0.5)';
  g.lineWidth = 2;
  for (let k = 0; k <= 8; k++) {
    g.beginPath();
    g.moveTo(k * 64, 0);
    g.lineTo(k * 64, 512);
    g.moveTo(0, k * 64);
    g.lineTo(512, k * 64);
    g.stroke();
  }
  return canvasTexture(c, { repeat: true });
}

export function sandTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#f2d7a6';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255, 245, 220' : '190, 150, 110'}, ${Math.random() * 0.35})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  return canvasTexture(c, { repeat: true });
}

// the boards of the pier (4 m across the planks)
export function woodDeckTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  for (let k = 0; k < 16; k++) {
    g.fillStyle = k % 3 === 0 ? '#c99e7a' : k % 3 === 1 ? '#bd8f6c' : '#d3aa86';
    g.fillRect(0, k * 16, 256, 16);
    g.fillStyle = 'rgba(80, 50, 40, 0.55)';
    g.fillRect(0, k * 16, 256, 2);
    for (let n = 0; n < 3; n++) {
      g.fillStyle = 'rgba(70, 40, 30, 0.7)';
      g.fillRect(Math.random() * 256, k * 16 + 6, 3, 3);
    }
  }
  return canvasTexture(c, { repeat: true });
}

// a few quick strokes across shop glass, the way you draw a window (alpha)
export function glintTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  g.lineCap = 'round';
  const streak = (x, y, len, w) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len * 0.55, y - len);
    g.stroke();
  };
  streak(40, 200, 90, 6);
  streak(62, 196, 60, 4);
  streak(150, 120, 70, 5);
  streak(170, 118, 40, 3);
  return canvasTexture(c, { repeat: false });
}

// floors inside: tiles, boards, the black-and-white checker of a diner (2 x 2 m)
export function floorTexture(kind) {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  if (kind === 'checker') {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? '#f4efe6' : '#3a3442';
      g.fillRect(x * 32, y * 32, 32, 32);
    }
  } else if (kind === 'tiles') {
    g.fillStyle = '#e8e2d8';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(120, 110, 120, 0.6)';
    g.lineWidth = 2;
    for (let k = 0; k <= 4; k++) {
      g.beginPath();
      g.moveTo(k * 64, 0);
      g.lineTo(k * 64, 256);
      g.moveTo(0, k * 64);
      g.lineTo(256, k * 64);
      g.stroke();
    }
  } else if (kind === 'wood') {
    for (let k = 0; k < 16; k++) {
      g.fillStyle = k % 3 === 0 ? '#b98a62' : k % 3 === 1 ? '#a87a55' : '#c39770';
      g.fillRect(0, k * 16, 256, 16);
      g.fillStyle = 'rgba(70, 40, 30, 0.5)';
      g.fillRect(0, k * 16, 256, 2);
      g.fillRect(((k * 97) % 256), k * 16, 2, 16);
    }
  } else if (kind === 'mats') {
    g.fillStyle = '#4a4a56';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(20, 20, 28, 0.8)';
    g.lineWidth = 3;
    for (let k = 0; k <= 2; k++) {
      g.beginPath();
      g.moveTo(k * 128, 0);
      g.lineTo(k * 128, 256);
      g.moveTo(0, k * 128);
      g.lineTo(256, k * 128);
      g.stroke();
    }
  } else if (kind === 'carpet') {
    g.fillStyle = '#8e3a4a';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(240, 190, 110, 0.6)';
    g.lineWidth = 3;
    for (let k = 0; k < 8; k++) {
      g.beginPath();
      g.arc(k % 2 ? 64 : 192, (k >> 1) * 64 + 32, 22, 0, Math.PI * 2);
      g.stroke();
    }
  } else {
    g.fillStyle = '#b8b4ae';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '240, 236, 230' : '110, 104, 100'}, ${Math.random() * 0.2})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
    }
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255, 250, 240' : '60, 40, 40'}, ${Math.random() * 0.08})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 30, 30);
  }
  return canvasTexture(c, { repeat: true });
}

// What is on the shelves, by kind: rows of things seen from the front. 8 cells of 512 x 128
// (two rows each) stacked in one texture; the shelves pick theirs (see GOODS).
export const GOODS = { general: 0, books: 1, meds: 2, tools: 3, bread: 4, fruit: 5, bottles: 6, records: 7 };
export const GOODS_CELLS = 8;
export function goodsTexture() {
  const W = 512;
  const H = 128 * GOODS_CELLS;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const bright = ['#ff4f6a', '#ffd23f', '#3fd0c9', '#7a5cff', '#ff8a3c', '#9be15d', '#f6f1e7', '#ff6fb1', '#4f9dff'];
  let s = 77;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const pick = (a) => a[Math.floor(r() * a.length)];
  for (let cell = 0; cell < GOODS_CELLS; cell++) {
    const y0 = (GOODS_CELLS - 1 - cell) * 128; // texture v grows upwards
    g.fillStyle = '#5a3a2e';
    g.fillRect(0, y0, W, 128);
    for (let row = 0; row < 2; row++) {
      const base = y0 + row * 64 + 58;
      // the board
      g.fillStyle = '#8a5a3a';
      g.fillRect(0, base, W, 6);
      for (let x = 4; x < W - 4; ) {
        let w = 10 + r() * 22;
        let h = 22 + r() * 26;
        const col = pick(bright);
        g.fillStyle = col;
        if (cell === GOODS.books) {
          w = 7 + r() * 9;
          h = 34 + r() * 18;
          g.fillStyle = pick(['#a3333a', '#2f5d8a', '#3c7a4a', '#d8b04a', '#6a3f7a', '#e8e0d0', '#b5651d']);
          g.fillRect(x, base - h, w, h);
          g.fillStyle = 'rgba(255, 240, 200, 0.6)';
          g.fillRect(x + 1, base - h + 6, w - 2, 2);
        } else if (cell === GOODS.meds) {
          w = 12 + r() * 12;
          h = 18 + r() * 18;
          g.fillStyle = pick(['#f6f6f2', '#e9f4ee', '#ffffff', '#dfe9f6']);
          g.fillRect(x, base - h, w, h);
          g.fillStyle = pick(['#3fae6a', '#e0474c', '#3f7fd0']);
          g.fillRect(x + 2, base - h * 0.6, w - 4, 4);
        } else if (cell === GOODS.tools) {
          g.fillStyle = pick(['#d8462f', '#ffc533', '#2f6fd8', '#8a8a96']);
          g.fillRect(x, base - h * 0.5, w, h * 0.5);
          g.fillStyle = '#5a5a66';
          g.fillRect(x + w * 0.4, base - h, w * 0.2, h * 0.5);
        } else if (cell === GOODS.bread) {
          g.fillStyle = pick(['#d9a35b', '#c98a46', '#e8c27a', '#b87333']);
          g.beginPath();
          g.ellipse(x + w / 2, base - 10, w / 2 + 3, 10, 0, 0, Math.PI * 2);
          g.fill();
          w += 6;
        } else if (cell === GOODS.fruit) {
          g.fillStyle = '#8a5a3a';
          g.fillRect(x, base - 20, 46, 20);
          for (let f = 0; f < 5; f++) {
            g.fillStyle = pick(['#e0332f', '#ffb52e', '#9be15d', '#ffd93f', '#ff7b2e']);
            g.beginPath();
            g.arc(x + 6 + f * 8, base - 22, 6, 0, Math.PI * 2);
            g.fill();
          }
          w = 46;
        } else if (cell === GOODS.bottles) {
          w = 8 + r() * 8;
          g.fillStyle = pick(['#2e8b57', '#8b2e3a', '#d8b04a', '#3f6fd0', '#eaeaea', '#7a3fd0']);
          g.fillRect(x, base - h, w, h);
          g.fillRect(x + w * 0.3, base - h - 10, w * 0.4, 10);
        } else if (cell === GOODS.records) {
          w = 30;
          g.fillStyle = pick(bright);
          g.fillRect(x, base - 30, 28, 30);
          g.fillStyle = '#1b1430';
          g.beginPath();
          g.arc(x + 14, base - 15, 9, 0, Math.PI * 2);
          g.fill();
        } else {
          g.fillRect(x, base - h, w, h);
          g.fillStyle = 'rgba(255, 255, 255, 0.35)';
          g.fillRect(x + 2, base - h + 4, w - 4, 3);
        }
        x += w + 3 + r() * 5;
      }
    }
  }
  return canvasTexture(c, { repeat: true });
}

// ------------------------------------------------------------------ the neon of the whole city
// Every shop's neon lettering in one texture: r is the glowing tube, g its white-hot core, the
// colour comes from the sign itself (the vertex colour), so the texture is small.
export class NeonAtlas {
  constructor(cols = 4, rows = 32, cw = 512, ch = 128) {
    this.cols = cols;
    this.rows = rows;
    this.cw = cw;
    this.ch = ch;
    this.W = cols * cw;
    this.H = rows * ch;
    this.c = canvas(this.W, this.H);
    this.g = this.c.getContext('2d');
    this.g.fillStyle = '#000';
    this.g.fillRect(0, 0, this.W, this.H);
    this.n = 0;
    this.cache = new Map();
  }

  get full() {
    return this.n >= this.cols * this.rows;
  }

  // the lettering (one line) -> its rect in the texture [u0, v0, u1, v1] (v0 the top of the text)
  add(text, { font = 'Caveat', size = 75, italic = false } = {}) {
    const key = `${text}|${font}|${size}|${italic}`;
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.full) {
      this.missed = (this.missed || 0) + 1;
      return null;
    }
    const i = this.n++;
    const x0 = (i % this.cols) * this.cw;
    const y0 = Math.floor(i / this.cols) * this.ch;
    const g = this.g;
    g.save();
    g.beginPath();
    g.rect(x0, y0, this.cw, this.ch);
    g.clip();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let sz = size;
    g.font = `${italic ? 'italic ' : ''}700 ${sz}px "${font}", "Rubik", sans-serif`;
    const max = this.cw * 0.92;
    const tw = g.measureText(text).width;
    if (tw > max) {
      sz = Math.floor((sz * max) / tw);
      g.font = `${italic ? 'italic ' : ''}700 ${sz}px "${font}", "Rubik", sans-serif`;
    }
    const cx = x0 + this.cw / 2;
    const cy = y0 + this.ch / 2;
    g.globalCompositeOperation = 'source-over';
    g.lineJoin = 'round';
    g.lineWidth = sz * 0.11;
    g.strokeStyle = '#f00';
    g.strokeText(text, cx, cy);
    g.globalCompositeOperation = 'lighter';
    g.lineWidth = sz * 0.045;
    g.strokeStyle = 'rgb(0, 255, 0)';
    g.strokeText(text, cx, cy);
    g.restore();
    // DataTexture rows run from the top of the canvas: the top of the text is at v0
    const r = [x0 / this.W, y0 / this.H, (x0 + this.cw) / this.W, (y0 + this.ch) / this.H];
    this.cache.set(key, r);
    return r;
  }

  texture() {
    if (this.tex) return this.tex;
    // (the canvas goes up as it is, its red and green kept: no reading it back, pixel by pixel,
    // which took seconds on a slow machine; rows from the top, as the rects say)
    const t = new THREE.CanvasTexture(this.c);
    t.format = THREE.RGFormat;
    t.flipY = false;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    // (once it is on the graphics card the canvas is not needed: 32 MB back)
    t.onUpdate = () => {
      this.c.width = 1;
      this.c.height = 1;
      t.onUpdate = null;
    };
    this.tex = t;
    return t;
  }
}
