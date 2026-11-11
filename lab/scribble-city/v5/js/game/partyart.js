// (v5, ROADMAP 12.9) The pictures of the city's parties, painted on canvases: the club's wall of LED
// (what plays on it changes with the music - the groove, the break, the build with its countdown,
// the drop), the dance floor's squares lit in their patterns to the beat, the neon signs on the
// walls (their tubes and the glow round them), the jazz bar's curtain and its posters, the rooftop
// pool's water. game/parties.js hangs them up and repaints the ones that move.

import { MARKER, LATIN } from './minigames/ink2d.js';

const C = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const fr = (x) => x - Math.floor(x);
const hsl = (h, s, l) => `hsl(${(((h % 1) + 1) % 1) * 360},${s * 100}%,${l * 100}%)`;
// (the same number, the same 'random' - so a pattern is the same each time round)
const hash = (n) => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);

/**
 * The wall of LED behind the DJ. s: { t (seconds), beat (beats, a float), part ('groove' | 'break'
 * | 'build' | 'drop'), prog (0..1 through the build), dropT (seconds since the drop), name, hue }
 */
export function paintLED(g, W, H, s) {
  const b = s.beat;
  const ph = fr(b);
  const pulse = Math.pow(1 - ph, 2);
  const hue = s.hue || 0.9;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#05030a';
  g.fillRect(0, 0, W, H);
  const cx = W / 2;
  const cy = H / 2;
  if (s.part === 'break') {
    // slow waves of colour, soft lights drifting, the name faint
    for (let k = 0; k < 6; k++) {
      g.fillStyle = hsl(hue + 0.1 * k + s.t * 0.01, 0.8, 0.12 + 0.05 * Math.sin(s.t * 0.7 + k));
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += W / 24) g.lineTo(x, H * (0.35 + k * 0.1) + Math.sin(x / W * 6 + s.t * 0.8 + k) * H * 0.06);
      g.lineTo(W, H);
      g.fill();
    }
    for (let i = 0; i < 14; i++) {
      const x = fr(hash(i) + s.t * 0.02 * (0.5 + hash(i + 9))) * W;
      const y = fr(hash(i + 3) + s.t * 0.01) * H;
      g.fillStyle = hsl(hue + hash(i + 5) * 0.3, 0.9, 0.6);
      g.globalAlpha = 0.25 + 0.2 * Math.sin(s.t + i);
      g.beginPath();
      g.arc(x, y, H * (0.03 + 0.05 * hash(i + 7)), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    word(g, s.name, cx, cy, H * 0.26, hsl(hue, 0.9, 0.6), 0.5 + 0.2 * Math.sin(s.t * 1.5));
    return;
  }
  if (s.part === 'build') {
    // rings closing in faster and faster; the light flashing with the snare; the countdown
    const rate = s.prog < 0.5 ? 1 : s.prog < 0.75 ? 2 : 4;
    const hit = fr(b * rate) < 0.22;
    if (hit) {
      g.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * s.prog})`;
      g.fillRect(0, 0, W, H);
    }
    g.lineWidth = H * 0.025;
    for (let k = 0; k < 9; k++) {
      const r = fr(k / 9 - s.t * (0.15 + s.prog * 0.9)) * W * 0.6;
      g.strokeStyle = hsl(hue + k * 0.07 + s.prog * 0.5, 1, 0.55);
      g.strokeRect(cx - r, cy - r * 0.5, r * 2, r);
    }
    // (the last bar: three, two, one - and the breath before the drop)
    const left = (1 - s.prog) * 16;
    if (left <= 4) {
      const n = Math.ceil(left - 1);
      if (n >= 1) word(g, String(n), cx, cy, H * (0.5 + 0.2 * (1 - fr(left))), '#ffffff', 1);
    } else word(g, s.name, cx, cy, H * 0.22, hsl(hue + s.prog, 1, 0.6), 0.6 + 0.4 * (hit ? 1 : 0));
    return;
  }
  // the groove and the drop: a scene every sixteen beats
  const drop = s.part === 'drop';
  const scene = Math.floor(b / 16) % 4;
  const k = drop ? 1 : 0.75;
  if (scene === 0) {
    // the bars of an equaliser, from the middle out
    const n = 28;
    const bw = W / n;
    for (let i = 0; i < n; i++) {
      const m = Math.abs(i - (n - 1) / 2) / (n / 2);
      const h = H * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(i * 1.7 + s.t * 5.1)) * (0.45 + 0.55 * pulse) * (1 - m * 0.45));
      g.fillStyle = hsl(hue + m * 0.4 + b * 0.02, 1, 0.5 * k + 0.1);
      for (let y = H - h; y < H; y += H / 20) g.fillRect(i * bw + 1, y, bw - 2, H / 20 - 2);
    }
  } else if (scene === 1) {
    // a tunnel of frames coming at you
    g.lineWidth = H * 0.03;
    for (let q = 0; q < 10; q++) {
      const z = fr(q / 10 + b * 0.25);
      const r = Math.pow(z, 2.2) * W * 0.75;
      g.strokeStyle = hsl(hue + q * 0.09 + b * 0.03, 1, 0.3 + 0.4 * z * k);
      g.strokeRect(cx - r, cy - r * 0.55, r * 2, r * 1.1);
    }
  } else if (scene === 2) {
    // stripes running across on the beat
    const sw = W / 10;
    const off = fr(b * 0.5) * sw * 2;
    for (let x = -sw * 2; x < W + sw * 2; x += sw) {
      g.fillStyle = hsl(hue + (Math.floor((x + W) / sw) % 2 ? 0.5 : 0), 1, 0.25 + 0.3 * pulse * k);
      g.beginPath();
      g.moveTo(x + off, 0);
      g.lineTo(x + off + sw * 0.6, 0);
      g.lineTo(x + off + sw * 0.6 - H * 0.5, H);
      g.lineTo(x + off - H * 0.5, H);
      g.fill();
    }
  } else {
    // rays turning round the middle
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + s.t * 0.6;
      const a1 = a0 + Math.PI / n;
      g.fillStyle = hsl(hue + (i % 2) * 0.33 + b * 0.02, 1, 0.22 + 0.35 * pulse * k);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a0) * W, cy + Math.sin(a0) * W);
      g.lineTo(cx + Math.cos(a1) * W, cy + Math.sin(a1) * W);
      g.fill();
    }
  }
  // the drop: the white of it, fading into colour; the name big, jumping on the beat
  if (drop && s.dropT < 1.2) {
    g.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - s.dropT / 1.2)})`;
    g.fillRect(0, 0, W, H);
  }
  const big = drop ? 0.3 + 0.05 * pulse : 0.24 + 0.02 * pulse;
  word(g, s.name, cx, cy, H * big, hsl(hue + (drop ? b * 0.25 : 0), 1, 0.65), 1);
}

// a word on the LED: its glow, then the tube of it
function word(g, text, x, y, size, col, a) {
  g.save();
  g.globalAlpha = a;
  g.font = `700 ${Math.round(size)}px ${MARKER}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.strokeStyle = col;
  g.globalAlpha = a * 0.35;
  g.lineWidth = size * 0.28;
  g.strokeText(text, x, y);
  g.globalAlpha = a;
  g.lineWidth = size * 0.1;
  g.strokeText(text, x, y);
  g.fillStyle = '#fff6fb';
  g.fillText(text, x, y);
  g.restore();
}

/**
 * The dance floor: nx by ny squares of px each, lit to the beat (the same s as paintLED).
 */
export function paintFloor(g, nx, ny, px, s) {
  const b = s.beat;
  const ph = fr(b);
  const pulse = Math.pow(1 - ph, 1.5);
  const hue = s.hue || 0.9;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#07060b';
  g.fillRect(0, 0, nx * px, ny * px);
  const scene = Math.floor(b / 8) % 4;
  const beat = Math.floor(b);
  const cxm = (nx - 1) / 2;
  const cym = (ny - 1) / 2;
  const m = Math.max(1, Math.round(px * 0.08));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      let v;
      let h = hue;
      const r = Math.hypot(i - cxm, j - cym);
      if (s.part === 'break') {
        v = 0.18 + 0.14 * Math.sin(s.t * 1.2 - r * 0.7);
        h = hue + r * 0.04 + s.t * 0.02;
      } else if (s.part === 'build') {
        const rate = s.prog < 0.5 ? 1 : s.prog < 0.75 ? 2 : 4;
        v = (fr(b * rate) < 0.3 ? 0.4 + 0.6 * s.prog : 0.1) * (0.7 + 0.3 * Math.sin(r - s.t * 6));
        h = hue + s.prog * 0.5;
        if (s.prog > 0.94) v = 0.04;
      } else if (scene === 0) {
        v = (i + j + beat) % 2 ? 0.95 * pulse + 0.15 : 0.12;
        h = hue + ((i + j) % 2) * 0.5;
      } else if (scene === 1) {
        const w = fr(r * 0.22 - b * 0.5);
        v = w < 0.3 ? 1 - w * 2 : 0.1;
        h = hue + Math.floor(r * 0.22 - b * 0.5) * 0.17;
      } else if (scene === 2) {
        v = (i === beat % nx || i === nx - 1 - (beat % nx)) ? 1 : 0.12 + 0.1 * pulse;
        h = hue + j * 0.05;
      } else {
        v = hash(i * 31 + j * 7 + beat * 13) < 0.3 ? 0.9 * pulse + 0.2 : 0.1;
        h = hue + hash(i + j * 9 + beat) * 0.6;
      }
      if (s.part === 'drop' && s.dropT < 1) v = Math.max(v, 1 - s.dropT);
      g.fillStyle = hsl(h, 1, Math.min(0.62, 0.06 + v * 0.5));
      g.fillRect(i * px + m, j * px + m, px - 2 * m, px - 2 * m);
    }
  }
}

/**
 * Neon signs, one a row: each { text, color, font, script } - the tube in its colour over a halo of
 * it, on a board of dark glass. Returns { c, boxes[text] = { uv, aspect } }.
 */
export function paintNeon(list, w = 1024, rowH = 128) {
  const c = C(w, rowH * list.length);
  const g = c.getContext('2d');
  const h = c.height;
  const boxes = {};
  list.forEach((o, i) => {
    const y = i * rowH;
    g.fillStyle = '#0a0812';
    g.fillRect(0, y, w, rowH);
    g.font = `${o.script ? 700 : 400} ${Math.round(rowH * (o.script ? 0.68 : 0.56))}px ${o.script ? LATIN : o.font || MARKER}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const tw = Math.min(w - 8, g.measureText(o.text).width + rowH * 0.7);
    const x0 = (w - tw) / 2;
    const cy = y + rowH * 0.52;
    if (o.heart) heart(g, w / 2, cy, rowH * 0.36, o.color);
    else {
      g.strokeStyle = o.color;
      for (const [lw, a] of [[rowH * 0.22, 0.12], [rowH * 0.13, 0.22], [rowH * 0.07, 0.6]]) {
        g.globalAlpha = a;
        g.lineWidth = lw;
        g.strokeText(o.text, w / 2, cy);
      }
      g.globalAlpha = 1;
      g.fillStyle = '#fff8fc';
      g.fillText(o.text, w / 2, cy);
    }
    boxes[o.text] = { uv: [x0 / w, 1 - (y + rowH) / h, (x0 + tw) / w, 1 - y / h], aspect: tw / rowH };
  });
  return { c, boxes };
}

// a heart drawn as a neon tube
function heart(g, x, y, s, col) {
  const path = () => {
    g.beginPath();
    g.moveTo(x, y + s * 0.85);
    g.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.7, y - s * 1.2, x, y - s * 0.45);
    g.bezierCurveTo(x + s * 0.7, y - s * 1.2, x + s * 1.6, y - s * 0.1, x, y + s * 0.85);
  };
  g.strokeStyle = col;
  for (const [lw, a] of [[s * 0.5, 0.12], [s * 0.3, 0.25], [s * 0.14, 0.7]]) {
    g.globalAlpha = a;
    g.lineWidth = lw;
    path();
    g.stroke();
  }
  g.globalAlpha = 1;
  g.strokeStyle = '#fff4f8';
  g.lineWidth = s * 0.06;
  path();
  g.stroke();
}

// the jazz bar's curtain: blue velvet in deep folds, a sheen down each fold
export function paintVelvet(w = 256, h = 256) {
  const c = C(w, h);
  const g = c.getContext('2d');
  for (let x = 0; x < w; x++) {
    const f = 0.5 + 0.5 * Math.sin((x / w) * Math.PI * 10);
    const sheen = Math.pow(Math.max(0, Math.sin((x / w) * Math.PI * 10 + 0.6)), 8);
    g.fillStyle = `rgb(${Math.round(14 + 30 * f + 60 * sheen)},${Math.round(22 + 40 * f + 70 * sheen)},${Math.round(70 + 90 * f + 70 * sheen)})`;
    g.fillRect(x, 0, 1, h);
  }
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(0,0,0,0.35)');
  gr.addColorStop(0.3, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  return c;
}

// the jazz bar's posters in their frames: the city's own legends, each its own colour
export const JAZZ_POSTERS = [
  ['BILLIE INKDAY', 'LIVE AT BLUE VELVET', '#e8b04a'],
  ['DIZZY GRAPHITE', 'AND HIS ORCHESTRA', '#d8453a'],
  ['ELLA PENFIELD', 'SINGS THE BLUES', '#4f9dff'],
  ['CHARLIE PARCHMENT', 'QUINTET', '#3ab89a'],
  ['NINA SKETCHONE', 'ONE NIGHT ONLY', '#c070e8'],
  ['DUKE ERASINGTON', 'BIG BAND', '#f0d060'],
];
export function paintPosters(w = 512, h = 384) {
  const n = JAZZ_POSTERS.length;
  const cols = 3;
  const rows = Math.ceil(n / cols);
  const c = C(w, h);
  const g = c.getContext('2d');
  const pw = w / cols;
  const ph = h / rows;
  const boxes = [];
  JAZZ_POSTERS.forEach(([name, sub, col], i) => {
    const x = (i % cols) * pw;
    const y = Math.floor(i / cols) * ph;
    g.fillStyle = '#f1e6cc';
    g.fillRect(x, y, pw, ph);
    g.fillStyle = col;
    g.fillRect(x + pw * 0.06, y + ph * 0.05, pw * 0.88, ph * 0.62);
    // (the player: a silhouette with an instrument, in black)
    g.fillStyle = '#16121a';
    const sx = x + pw * 0.5;
    const sy = y + ph * 0.6;
    g.beginPath();
    g.arc(sx, sy - ph * 0.38, ph * 0.07, 0, Math.PI * 2);
    g.fill();
    g.fillRect(sx - ph * 0.08, sy - ph * 0.3, ph * 0.16, ph * 0.3);
    g.save();
    g.translate(sx + ph * 0.06, sy - ph * 0.2);
    g.rotate(i % 2 ? 0.6 : -0.5);
    g.fillRect(-ph * 0.02, -ph * 0.16, ph * 0.04, ph * 0.3);
    g.beginPath();
    g.arc(0, ph * 0.15, ph * 0.05, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.fillStyle = '#16121a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${Math.round(ph * 0.11)}px ${MARKER}`;
    g.fillText(name, sx, y + ph * 0.77, pw * 0.9);
    g.font = `400 ${Math.round(ph * 0.08)}px ${MARKER}`;
    g.fillText(sub, sx, y + ph * 0.9, pw * 0.9);
    boxes.push([x / w, 1 - (y + ph) / h, (x + pw) / w, 1 - y / h]);
  });
  return { c, boxes };
}

// the rooftop pool's water: its tiles under the ripples, the light of it (repainted as it moves)
export function paintPool(g, w, h, t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#0b5a8a';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(160,230,255,0.25)';
  g.lineWidth = 1;
  const ts = w / 8;
  for (let x = 0; x <= w; x += ts) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, h);
    g.stroke();
  }
  for (let y = 0; y <= h; y += ts) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  // the caustics: bright wavy threads drifting
  g.strokeStyle = 'rgba(200,250,255,0.55)';
  g.lineWidth = Math.max(1.5, w / 120);
  for (let k = 0; k < 9; k++) {
    g.beginPath();
    for (let x = 0; x <= w; x += w / 24) {
      const y = ((k + 0.5) / 9) * h + Math.sin(x / w * 9 + t * 1.3 + k * 2.1) * h * 0.04 + Math.sin(x / w * 23 - t * 0.9 + k) * h * 0.015;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
}

// the photo wall by the door: the club's name over and over on black, in its colours (the backdrop
// people pose before)
export function paintBackdrop(text, cols, w = 512, h = 320) {
  const c = C(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#0c0a12';
  g.fillRect(0, 0, w, h);
  const cw = w / 4;
  const rh = h / 5;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `400 ${Math.round(rh * 0.36)}px ${MARKER}`;
  for (let r = 0; r < 5; r++) {
    for (let k = 0; k < 5; k++) {
      const x = (k + (r % 2 ? 0 : 0.5)) * cw;
      const y = (r + 0.5) * rh;
      g.fillStyle = cols[(r + k) % cols.length];
      g.fillText(text, x, y, cw * 0.9);
    }
  }
  return c;
}

/**
 * The lit edge of the balconies, one long strip round the hall (the same s as paintLED): colour
 * running round it, the name passing, the whole of it flashing on the beat in the drop, a chase
 * racing faster and faster in the build.
 */
export function paintBand(g, W, H, s) {
  const b = s.beat;
  const ph = fr(b);
  const pulse = Math.pow(1 - ph, 2);
  const hue = s.hue || 0.9;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#05030a';
  g.fillRect(0, 0, W, H);
  const seg = W / 48;
  if (s.part === 'build') {
    // the chase: a run of light round the hall, faster as it rises
    const v = 0.4 + s.prog * 6;
    for (let i = 0; i < 48; i++) {
      const on = fr(i / 48 - s.t * v * 0.1) < 0.18 + s.prog * 0.3;
      g.fillStyle = on ? hsl(hue + s.prog * 0.5, 1, 0.6) : '#0b0814';
      g.fillRect(i * seg + 1, 1, seg - 2, H - 2);
    }
    if (s.prog > 0.94) {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
    }
    return;
  }
  if (s.part === 'break') {
    for (let i = 0; i < 48; i++) {
      g.fillStyle = hsl(hue + i * 0.01 + s.t * 0.02, 0.8, 0.12 + 0.1 * Math.sin(i * 0.4 - s.t * 1.5));
      g.fillRect(i * seg + 1, 1, seg - 2, H - 2);
    }
    return;
  }
  const drop = s.part === 'drop';
  for (let i = 0; i < 48; i++) {
    const wave = 0.5 + 0.5 * Math.sin(i * 0.5 - b * Math.PI * 0.5);
    const l = drop ? 0.18 + 0.45 * pulse * (0.6 + 0.4 * wave) : 0.12 + 0.3 * wave;
    g.fillStyle = hsl(hue + (drop ? Math.floor(b) * 0.17 : 0) + i * 0.012, 1, l);
    g.fillRect(i * seg + 1, 1, seg - 2, H - 2);
  }
  // (the name going round)
  g.font = `700 ${Math.round(H * 0.82)}px ${MARKER}`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  const x = W - fr(s.t * 0.03) * (W + 400);
  g.fillStyle = drop && ph < 0.15 ? '#ffffff' : '#fff2fa';
  for (let k = 0; k < 3; k++) g.fillText(s.name, x + k * (W / 3), H * 0.54);
}
