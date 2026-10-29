import { canvas } from './kit.js';
import { canvasTexture } from '../render/materials.js';

// (v5, ROADMAP 12.5) The murals of Paintwood's Walls: ten big paintings, each in a street
// artist's way - a sun going down in stripes over the waves, a face in blocks of colour, shards of
// glass, letters with highlights and drips, a hummingbird in the flowers, an octopus, an eye over
// the clouds, the skyline with a POW!, a tiger in the leaves, a girl blowing a bubble. Flat colour
// and a thick black line, as the city is drawn. Painted once, on a canvas, by their own dice.

const INK = '#16121c';
const PAL = [
  ['#ff3f8e', '#ffb347', '#ffe14f', '#2bc4c4', '#3b2b8f'],
  ['#ff5a36', '#ffd23f', '#3fe8a0', '#2f6fe4', '#8a5cf0'],
  ['#f72585', '#7209b7', '#3a0ca3', '#4cc9f0', '#ffd166'],
  ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#073b4c'],
  ['#ff9f1c', '#ffbf69', '#2ec4b6', '#cbf3f0', '#e71d36'],
];

function dice(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// a shape filled and gone round in ink
function ink(g, w, fill) {
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  g.strokeStyle = INK;
  g.lineWidth = w;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.stroke();
}

function sunset(g, W, H, r, P) {
  const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, P[4]);
  sky.addColorStop(0.55, P[0]);
  sky.addColorStop(1, P[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  // the sun, cut by stripes
  const cx = W * (0.35 + r() * 0.3);
  const cy = H * 0.62;
  const R = H * 0.42;
  g.beginPath();
  g.arc(cx, cy, R, Math.PI, 0);
  ink(g, 8, P[2]);
  for (let k = 0; k < 6; k++) {
    g.fillStyle = P[0];
    g.fillRect(cx - R - 4, cy - 14 - k * (R / 7), R * 2 + 8, 5 + k * 2.4);
  }
  // the sea: bands of waves
  for (let k = 0; k < 5; k++) {
    const y = H * 0.62 + k * H * 0.08;
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(0, y);
    for (let x = 0; x <= W; x += 32) g.quadraticCurveTo(x + 16, y - 14 + (k % 2) * 6, x + 32, y);
    g.lineTo(W, H);
    g.closePath();
    ink(g, 5, k % 2 ? P[3] : P[4]);
  }
  // two palms
  for (const [x, lean] of [[W * 0.08, 40], [W * 0.9, -30]]) {
    g.beginPath();
    g.moveTo(x, H);
    g.quadraticCurveTo(x + lean * 0.4, H * 0.5, x + lean, H * 0.18);
    g.lineWidth = 18;
    g.strokeStyle = INK;
    g.stroke();
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI + k * 0.55 + 0.2;
      g.beginPath();
      g.moveTo(x + lean, H * 0.18);
      g.quadraticCurveTo(x + lean + Math.cos(a) * 70, H * 0.18 + Math.sin(a) * 60 - 20, x + lean + Math.cos(a) * 120, H * 0.18 + Math.sin(a) * 50 + 50);
      g.lineWidth = 12;
      g.stroke();
    }
  }
}

function face(g, W, H, r, P) {
  // blocks of colour behind: the face in profile, the hair in a mass of strokes
  const n = 6;
  for (let i = 0; i < n; i++) {
    g.fillStyle = P[i % P.length];
    g.fillRect((i * W) / n, 0, W / n + 1, H);
  }
  const cx = W * 0.5;
  const cy = H * 0.52;
  // the hair
  g.beginPath();
  g.ellipse(cx + 40, cy - 30, H * 0.42, H * 0.46, 0, 0, Math.PI * 2);
  ink(g, 8, P[4]);
  for (let k = 0; k < 14; k++) {
    g.beginPath();
    const a = -2.6 + k * 0.32;
    g.moveTo(cx + 40 + Math.cos(a) * H * 0.18, cy - 30 + Math.sin(a) * H * 0.2);
    g.quadraticCurveTo(cx + 40 + Math.cos(a) * H * 0.5, cy - 30 + Math.sin(a) * H * 0.38, cx + 40 + Math.cos(a + 0.4) * H * 0.42, cy - 30 + Math.sin(a + 0.4) * H * 0.46);
    g.strokeStyle = P[(k + 1) % 4];
    g.lineWidth = 7;
    g.stroke();
  }
  // the face: forehead, nose, lips, chin
  g.beginPath();
  g.moveTo(cx - 10, cy - H * 0.36);
  g.quadraticCurveTo(cx - 70, cy - H * 0.3, cx - 78, cy - H * 0.08);
  g.lineTo(cx - 112, cy + H * 0.02);
  g.lineTo(cx - 80, cy + H * 0.08);
  g.quadraticCurveTo(cx - 92, cy + H * 0.13, cx - 80, cy + H * 0.16);
  g.quadraticCurveTo(cx - 92, cy + H * 0.2, cx - 76, cy + H * 0.25);
  g.quadraticCurveTo(cx - 60, cy + H * 0.36, cx - 10, cy + H * 0.34);
  g.lineTo(cx + 40, cy + H * 0.48);
  g.lineTo(cx + 60, cy + H * 0.1);
  g.closePath();
  ink(g, 9, '#f6c79a');
  // the eye, closed, its lashes; the lips
  g.beginPath();
  g.moveTo(cx - 62, cy - H * 0.12);
  g.quadraticCurveTo(cx - 44, cy - H * 0.06, cx - 28, cy - H * 0.12);
  ink(g, 7);
  for (let k = 0; k < 4; k++) {
    g.beginPath();
    g.moveTo(cx - 56 + k * 9, cy - H * 0.09);
    g.lineTo(cx - 60 + k * 10, cy - H * 0.04);
    ink(g, 5);
  }
  g.beginPath();
  g.moveTo(cx - 88, cy + H * 0.13);
  g.quadraticCurveTo(cx - 70, cy + H * 0.1, cx - 66, cy + H * 0.14);
  g.quadraticCurveTo(cx - 70, cy + H * 0.2, cx - 88, cy + H * 0.15);
  ink(g, 5, P[0]);
  // stars round it
  for (let k = 0; k < 7; k++) star(g, r() * W, r() * H * 0.3 + 10, 10 + r() * 14, '#fffdf6');
}

function star(g, x, y, R, fill) {
  g.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? R * 0.42 : R;
    if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ink(g, 3, fill);
}

function shards(g, W, H, r, P) {
  g.fillStyle = P[4];
  g.fillRect(0, 0, W, H);
  // points scattered, joined into triangles of colour
  const pts = [];
  for (let i = 0; i < 26; i++) pts.push([r() * W, r() * H]);
  for (const c of [[0, 0], [W, 0], [0, H], [W, H], [W / 2, 0], [W / 2, H], [0, H / 2], [W, H / 2]]) pts.push(c);
  for (let i = 0; i < 70; i++) {
    const a = pts[Math.floor(r() * pts.length)];
    const b = pts.slice().sort((p, q) => Math.hypot(p[0] - a[0], p[1] - a[1]) - Math.hypot(q[0] - a[0], q[1] - a[1]));
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[1][0], b[1][1]);
    g.lineTo(b[2][0], b[2][1]);
    g.closePath();
    ink(g, 4, P[Math.floor(r() * 4)]);
  }
  // a big eye of the storm in the middle
  g.beginPath();
  g.arc(W / 2, H / 2, H * 0.2, 0, Math.PI * 2);
  ink(g, 10, '#fffdf6');
  g.beginPath();
  g.arc(W / 2, H / 2, H * 0.09, 0, Math.PI * 2);
  ink(g, 6, INK);
}

function letters(g, W, H, r, P, word) {
  g.fillStyle = P[3];
  g.fillRect(0, 0, W, H);
  // bubbles and dots behind
  for (let i = 0; i < 40; i++) {
    g.beginPath();
    g.arc(r() * W, r() * H, 6 + r() * 30, 0, Math.PI * 2);
    g.fillStyle = i % 2 ? P[4] : 'rgba(255,255,255,0.25)';
    g.fill();
  }
  const size = Math.min(H * 0.62, (W * 1.5) / word.length);
  g.font = `900 ${size}px "Permanent Marker", "Arial Black", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const x = W / 2;
  const y = H * 0.52;
  // a 3D shadow, the outline, the fill in two colours, a shine, drips
  g.lineJoin = 'round';
  for (let k = 12; k > 0; k -= 2) {
    g.fillStyle = INK;
    g.fillText(word, x + k, y + k);
  }
  g.lineWidth = 22;
  g.strokeStyle = INK;
  g.strokeText(word, x, y);
  const grd = g.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  grd.addColorStop(0, P[2]);
  grd.addColorStop(0.5, P[1]);
  grd.addColorStop(0.51, P[0]);
  grd.addColorStop(1, P[0]);
  g.fillStyle = grd;
  g.fillText(word, x, y);
  for (let i = 0; i < 14; i++) {
    const dx = x - W * 0.4 + r() * W * 0.8;
    const dy = y + size * 0.3;
    const len = 20 + r() * 60;
    g.fillStyle = P[0];
    g.fillRect(dx, dy, 8, len);
    g.beginPath();
    g.arc(dx + 4, dy + len, 6, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 6; i++) star(g, x - W * 0.42 + r() * W * 0.84, y - size * 0.45 + r() * 20, 9, '#ffffff');
}

function bird(g, W, H, r, P) {
  g.fillStyle = P[3];
  g.fillRect(0, 0, W, H);
  // the big flowers
  for (let i = 0; i < 6; i++) {
    const x = (i + 0.5) * (W / 6) + (r() - 0.5) * 40;
    const y = H * (0.55 + r() * 0.35);
    const R = 40 + r() * 30;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * R * 0.7, y + Math.sin(a) * R * 0.7, R * 0.55, R * 0.3, a, 0, Math.PI * 2);
      ink(g, 5, P[i % 2 ? 0 : 1]);
    }
    g.beginPath();
    g.arc(x, y, R * 0.3, 0, Math.PI * 2);
    ink(g, 5, P[2]);
  }
  // the hummingbird, wings out, its long beak to a flower
  const cx = W * 0.55;
  const cy = H * 0.34;
  g.beginPath();
  g.ellipse(cx, cy, 90, 40, -0.3, 0, Math.PI * 2);
  ink(g, 8, '#2ec46a');
  g.beginPath();
  g.moveTo(cx + 60, cy - 30);
  g.quadraticCurveTo(cx + 30, cy - 160, cx - 60, cy - 170);
  g.quadraticCurveTo(cx - 10, cy - 90, cx - 10, cy - 30);
  g.closePath();
  ink(g, 7, P[4]);
  g.beginPath();
  g.moveTo(cx - 80, cy + 20);
  g.lineTo(cx - 170, cy + 60);
  g.lineTo(cx - 150, cy + 20);
  g.closePath();
  ink(g, 6, '#2ec46a');
  g.beginPath();
  g.arc(cx + 80, cy - 26, 30, 0, Math.PI * 2);
  ink(g, 7, P[0]);
  g.beginPath();
  g.moveTo(cx + 106, cy - 30);
  g.lineTo(cx + 230, cy - 6);
  ink(g, 7);
  g.beginPath();
  g.arc(cx + 88, cy - 34, 6, 0, Math.PI * 2);
  ink(g, 2, INK);
}

function octopus(g, W, H, r, P) {
  g.fillStyle = P[4];
  g.fillRect(0, 0, W, H);
  // bubbles
  for (let i = 0; i < 30; i++) {
    g.beginPath();
    g.arc(r() * W, r() * H, 4 + r() * 14, 0, Math.PI * 2);
    ink(g, 3, 'rgba(255,255,255,0.35)');
  }
  const cx = W * 0.5;
  const cy = H * 0.4;
  // eight arms, curling out across the wall
  for (let k = 0; k < 8; k++) {
    const dir = (k / 7 - 0.5) * 2.6;
    g.beginPath();
    g.moveTo(cx + dir * 30, cy + 60);
    const ex = cx + dir * W * 0.28;
    const ey = H * (0.75 + r() * 0.2);
    g.bezierCurveTo(cx + dir * 80, cy + 180, ex - dir * 120, ey - 120, ex, ey);
    g.lineWidth = 46 - Math.abs(dir) * 6;
    g.strokeStyle = INK;
    g.stroke();
    g.lineWidth = 34 - Math.abs(dir) * 6;
    g.strokeStyle = P[0];
    g.stroke();
    // the curl at its end
    g.beginPath();
    g.arc(ex + dir * 14, ey - 12, 16, 0, Math.PI * 1.6);
    g.lineWidth = 12;
    g.strokeStyle = P[0];
    g.stroke();
  }
  g.beginPath();
  g.ellipse(cx, cy, 130, 120, 0, 0, Math.PI * 2);
  ink(g, 10, P[0]);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(cx + s * 50, cy + 10, 30, 0, Math.PI * 2);
    ink(g, 7, '#fffdf6');
    g.beginPath();
    g.arc(cx + s * 50 + 8, cy + 14, 13, 0, Math.PI * 2);
    ink(g, 3, INK);
  }
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.arc(cx - 90 + r() * 180, cy - 90 + r() * 60, 6 + r() * 8, 0, Math.PI * 2);
    ink(g, 3, P[1]);
  }
}

function dream(g, W, H, r, P) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P[3]);
  sky.addColorStop(1, P[2]);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  // clouds along the bottom, a ladder up into the sky, the eye over it all
  for (let i = 0; i < 9; i++) {
    const x = (i / 8) * W;
    const y = H * (0.8 + r() * 0.1);
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(x + (k - 1.5) * 34, y - (k % 2) * 22, 40, 0, Math.PI * 2);
      ink(g, 5, '#fffdf6');
    }
  }
  const lx = W * 0.3;
  for (const dx of [0, 70]) {
    g.beginPath();
    g.moveTo(lx + dx, H * 0.85);
    g.lineTo(lx + dx + 60, H * 0.12);
    ink(g, 9);
  }
  for (let k = 1; k < 9; k++) {
    const t = k / 9;
    g.beginPath();
    g.moveTo(lx + t * 60, H * 0.85 - t * H * 0.73);
    g.lineTo(lx + 70 + t * 60, H * 0.85 - t * H * 0.73);
    ink(g, 7);
  }
  const ex = W * 0.66;
  const ey = H * 0.36;
  g.beginPath();
  g.moveTo(ex - 190, ey);
  g.quadraticCurveTo(ex, ey - 150, ex + 190, ey);
  g.quadraticCurveTo(ex, ey + 150, ex - 190, ey);
  ink(g, 10, '#fffdf6');
  g.beginPath();
  g.arc(ex, ey, 64, 0, Math.PI * 2);
  ink(g, 8, P[1]);
  g.beginPath();
  g.arc(ex, ey, 28, 0, Math.PI * 2);
  ink(g, 4, INK);
  g.beginPath();
  g.arc(ex - 14, ey - 16, 10, 0, Math.PI * 2);
  g.fillStyle = '#ffffff';
  g.fill();
}

function skyline(g, W, H, r, P) {
  g.fillStyle = P[2];
  g.fillRect(0, 0, W, H);
  // halftone dots
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 8; y < H; y += 18) for (let x = (y / 18) % 2 ? 9 : 0; x < W; x += 18) {
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill();
  }
  // the towers
  let x = 0;
  while (x < W) {
    const w = 50 + r() * 80;
    const h = H * (0.3 + r() * 0.5);
    g.beginPath();
    g.rect(x, H - h, w, h);
    ink(g, 6, P[Math.floor(r() * 2) + 3]);
    for (let wy = H - h + 16; wy < H - 20; wy += 26) for (let wx = x + 10; wx < x + w - 14; wx += 22) {
      g.fillStyle = r() < 0.6 ? '#ffe14f' : INK;
      g.fillRect(wx, wy, 10, 12);
    }
    x += w + 6;
  }
  // POW!
  const cx = W * (0.3 + r() * 0.4);
  const cy = H * 0.3;
  g.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = i % 2 ? 80 : 150;
    if (i) g.lineTo(cx + Math.cos(a) * rr * 1.4, cy + Math.sin(a) * rr * 0.8);
    else g.moveTo(cx + Math.cos(a) * rr * 1.4, cy + Math.sin(a) * rr * 0.8);
  }
  ink(g, 8, P[0]);
  g.font = '900 96px "Permanent Marker", "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 14;
  g.strokeStyle = INK;
  g.strokeText('POW!', cx, cy);
  g.fillStyle = '#ffe14f';
  g.fillText('POW!', cx, cy);
}

function tiger(g, W, H, r, P) {
  g.fillStyle = '#1f6b4a';
  g.fillRect(0, 0, W, H);
  // the leaves
  for (let i = 0; i < 26; i++) {
    const x = r() * W;
    const y = r() * H;
    const a = r() * Math.PI * 2;
    g.beginPath();
    g.ellipse(x, y, 80, 26, a, 0, Math.PI * 2);
    ink(g, 5, i % 2 ? '#2ec46a' : '#145a3a');
  }
  // the head: orange, its stripes, the eyes
  const cx = W / 2;
  const cy = H * 0.52;
  g.beginPath();
  g.ellipse(cx, cy, 150, 130, 0, 0, Math.PI * 2);
  ink(g, 10, P[0] === '#ff9f1c' ? P[0] : '#ff8a2a');
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * 100, cy - 110);
    g.lineTo(cx + s * 150, cy - 170);
    g.lineTo(cx + s * 150, cy - 80);
    ink(g, 8, '#ff8a2a');
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.moveTo(cx + s * 150, cy - 50 + k * 30);
      g.lineTo(cx + s * 95, cy - 40 + k * 32);
      ink(g, 12);
    }
    g.beginPath();
    g.ellipse(cx + s * 52, cy - 20, 26, 18, 0, 0, Math.PI * 2);
    ink(g, 6, '#ffe14f');
    g.beginPath();
    g.ellipse(cx + s * 52, cy - 20, 6, 15, 0, 0, Math.PI * 2);
    ink(g, 3, INK);
  }
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    g.moveTo(cx - 30 + k * 30, cy - 125);
    g.lineTo(cx - 20 + k * 20, cy - 70);
    ink(g, 12);
  }
  g.beginPath();
  g.ellipse(cx, cy + 50, 70, 50, 0, 0, Math.PI * 2);
  ink(g, 7, '#fffdf6');
  g.beginPath();
  g.moveTo(cx - 22, cy + 20);
  g.lineTo(cx + 22, cy + 20);
  g.lineTo(cx, cy + 42);
  g.closePath();
  ink(g, 5, '#ff6fb1');
}

function bubble(g, W, H, r, P) {
  for (let i = 0; i < 10; i++) {
    g.fillStyle = P[i % 4];
    g.fillRect(0, (i * H) / 10, W, H / 10 + 1);
  }
  const cx = W * 0.4;
  const cy = H * 0.56;
  // her hair, her face, the gum bubble in front of it
  g.beginPath();
  g.ellipse(cx, cy - 20, 170, 190, 0, 0, Math.PI * 2);
  ink(g, 10, INK);
  g.beginPath();
  g.ellipse(cx, cy + 10, 120, 145, 0, 0, Math.PI * 2);
  ink(g, 9, '#c98e62');
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + s * 44, cy - 20, 20, 12, 0, 0, Math.PI * 2);
    ink(g, 5, '#fffdf6');
    g.beginPath();
    g.arc(cx + s * 44 + 6, cy - 20, 7, 0, Math.PI * 2);
    ink(g, 2, INK);
  }
  g.beginPath();
  g.arc(cx + 30, cy + 70, 95, 0, Math.PI * 2);
  ink(g, 9, '#ff6fb1');
  g.beginPath();
  g.ellipse(cx - 5, cy + 30, 30, 18, -0.7, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.fill();
  star(g, W * 0.82, H * 0.25, 46, P[2]);
  star(g, W * 0.75, H * 0.7, 26, '#fffdf6');
}

const STYLES = [
  (g, W, H, r, P) => sunset(g, W, H, r, P),
  (g, W, H, r, P) => face(g, W, H, r, P),
  (g, W, H, r, P) => letters(g, W, H, r, P, 'PAINTWOOD'),
  (g, W, H, r, P) => bird(g, W, H, r, P),
  (g, W, H, r, P) => octopus(g, W, H, r, P),
  (g, W, H, r, P) => shards(g, W, H, r, P),
  (g, W, H, r, P) => dream(g, W, H, r, P),
  (g, W, H, r, P) => skyline(g, W, H, r, P),
  (g, W, H, r, P) => tiger(g, W, H, r, P),
  (g, W, H, r, P) => bubble(g, W, H, r, P),
];
export const MURAL_COUNT = STYLES.length;

// the i-th mural, W x H pixels (a wall 13 m by 5: 1024 x 400; a phone half that), as a texture
export function paintMural(i, W = 1024, H = 400) {
  const c = canvas(W, H);
  const g = c.getContext('2d');
  // (drawn at 1024 across and scaled: the same painting at any size)
  const k = W / 1024;
  g.scale(k, k);
  const r = dice(9001 + i * 7919);
  const P = PAL[i % PAL.length];
  STYLES[i % STYLES.length](g, 1024, H / k, r, P);
  // the artist's tag in the corner
  g.font = '700 34px "Permanent Marker", sans-serif';
  g.textAlign = 'right';
  g.textBaseline = 'alphabetic';
  g.lineWidth = 6;
  g.strokeStyle = INK;
  const tag = ['ZEB', 'LUNA', 'MR. INK', 'KIRA', 'OTTO', 'NOVA', 'REX', 'PIXIE', 'DOC', 'MIA'][i % 10];
  g.strokeText(tag, 1000, H / k - 16);
  g.fillStyle = '#fffdf6';
  g.fillText(tag, 1000, H / k - 16);
  return canvasTexture(c);
}

// ------------------------------------------------------------------ (ROADMAP 12.5ה) framed works
// The paintings in the fair's white pavilion: a field of colour in soft bands, a grid in primary
// colours, circles over circles, drips, a portrait in blocks, hills under a sun, pop dots - each
// with dice of its own, into a cell of one canvas (all of them one picture: one draw)
const ART = [
  (g, W, H, r, P) => {
    // colour fields: two or three soft bands
    g.fillStyle = P[4];
    g.fillRect(0, 0, W, H);
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      g.fillStyle = P[i % 4];
      g.globalAlpha = 0.9;
      const y = H * 0.08 + (i * H * 0.86) / n;
      g.fillRect(W * 0.08, y, W * 0.84, (H * 0.86) / n - H * 0.05);
    }
    g.globalAlpha = 1;
  },
  (g, W, H, r) => {
    // the grid in primary colours
    g.fillStyle = '#f4f1e8';
    g.fillRect(0, 0, W, H);
    const xs = [0, W * (0.2 + r() * 0.2), W * (0.6 + r() * 0.2), W];
    const ys = [0, H * (0.25 + r() * 0.2), H * (0.6 + r() * 0.2), H];
    const cols = ['#e8333d', '#2f6fe4', '#ffd23f', '#f4f1e8', '#f4f1e8'];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        g.fillStyle = cols[Math.floor(r() * cols.length)];
        g.fillRect(xs[i], ys[j], xs[i + 1] - xs[i], ys[j + 1] - ys[j]);
      }
    }
    g.strokeStyle = INK;
    g.lineWidth = W * 0.025;
    g.beginPath();
    for (const x of xs.slice(1, 3)) {
      g.moveTo(x, 0);
      g.lineTo(x, H);
    }
    for (const y of ys.slice(1, 3)) {
      g.moveTo(0, y);
      g.lineTo(W, y);
    }
    g.stroke();
  },
  (g, W, H, r, P) => {
    // circles over circles
    g.fillStyle = '#fbf3e4';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.arc(r() * W, r() * H, (0.08 + r() * 0.22) * W, 0, Math.PI * 2);
      g.globalAlpha = 0.75;
      g.fillStyle = P[i % 5];
      g.fill();
      g.globalAlpha = 1;
      g.lineWidth = 3;
      g.strokeStyle = INK;
      g.stroke();
    }
  },
  (g, W, H, r, P) => {
    // drips and splashes
    g.fillStyle = '#efe9dc';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = i % 4 ? P[i % 5] : INK;
      g.lineWidth = 2 + r() * 7;
      g.beginPath();
      let x = r() * W;
      let y = r() * H;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * W * 0.4;
        y += (r() - 0.5) * H * 0.4;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  },
  (g, W, H, r, P) => {
    // a portrait in blocks of colour
    g.fillStyle = P[3];
    g.fillRect(0, 0, W, H);
    g.fillStyle = P[1];
    g.fillRect(0, H * 0.62, W, H * 0.38);
    g.beginPath();
    g.ellipse(W / 2, H * 0.44, W * 0.2, H * 0.27, 0, 0, Math.PI * 2);
    ink(g, 4, '#e8b48c');
    g.beginPath();
    g.ellipse(W / 2, H * 0.22, W * 0.24, H * 0.13, 0, Math.PI, 0);
    ink(g, 4, P[4]);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(W / 2 + s * W * 0.08, H * 0.42, W * 0.025, 0, Math.PI * 2);
      ink(g, 2, INK);
    }
    g.beginPath();
    g.arc(W / 2, H * 0.52, W * 0.06, 0.2, Math.PI - 0.2);
    ink(g, 3);
  },
  (g, W, H, r, P) => {
    // hills under a sun
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, P[3]);
    sky.addColorStop(1, P[1]);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    g.beginPath();
    g.arc(W * (0.3 + r() * 0.4), H * 0.35, H * 0.14, 0, Math.PI * 2);
    ink(g, 3, P[2]);
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += W / 12) g.lineTo(x, H * (0.55 + k * 0.12) + Math.sin(x * 0.02 + k * 2 + r()) * H * 0.06);
      g.lineTo(W, H);
      g.closePath();
      ink(g, 3, ['#2e8b57', '#3cb371', '#1f6b4a'][k]);
    }
  },
  (g, W, H, r, P) => {
    // pop: dots and a star
    g.fillStyle = P[0];
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let y = 6; y < H; y += 14) for (let x = (y / 14) % 2 ? 7 : 0; x < W; x += 14) {
      g.beginPath();
      g.arc(x, y, 3.5, 0, Math.PI * 2);
      g.fill();
    }
    star(g, W / 2, H / 2, Math.min(W, H) * 0.32, P[2]);
  },
];

// n works, each W x H, in one canvas of cells side by side (cols across): the texture and each
// one's uv box [u0, v0, u1, v1]
export function paintArtAtlas(n, W = 256, H = 192, cols = 4) {
  const rows = Math.ceil(n / cols);
  const c = canvas(W * cols, H * rows);
  const g = c.getContext('2d');
  const boxes = [];
  for (let i = 0; i < n; i++) {
    const cx = (i % cols) * W;
    const cy = Math.floor(i / cols) * H;
    g.save();
    g.translate(cx, cy);
    g.beginPath();
    g.rect(0, 0, W, H);
    g.clip();
    ART[i % ART.length](g, W, H, dice(4441 + i * 131), PAL[(i * 3 + 1) % PAL.length]);
    g.restore();
    boxes.push([cx / (W * cols), 1 - (cy + H) / (H * rows), (cx + W) / (W * cols), 1 - cy / (H * rows)]);
  }
  return { tex: canvasTexture(c), boxes };
}
