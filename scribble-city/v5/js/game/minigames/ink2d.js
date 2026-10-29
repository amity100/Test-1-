// (v5, ROADMAP 12.1) The games inside the game drawn the way the city is: ink lines that wobble a
// little (the same wobble every frame, so nothing shimmers), pens of colour, hatching for the
// shade, letters by hand. A canvas 2D context in, nothing kept.

export const INK = '#24242c';
export const PAPER = '#fbf8f0';
export const PENS = { red: '#e8333d', blue: '#2f6fe4', green: '#24a35a', yellow: '#ffd23f', pink: '#ff5fa2', cyan: '#2fd4e4', violet: '#8a5cf0', orange: '#ff8a2a', white: '#fffdf6' };
export const HAND = '"Gveret Levin", "Rubik", cursive';
export const MARKER = '"Permanent Marker", "Caveat", cursive';
export const LATIN = '"Caveat", "Permanent Marker", cursive';

// a number from a seed, the same every time
const h1 = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// a line by hand through points: a little off its course, thicker in the middle of a stroke
export function wobble(g, pts, o = {}) {
  const w = o.w || 3;
  const amp = o.amp === undefined ? 1.6 : o.amp;
  const seed = o.seed || 1;
  g.strokeStyle = o.color || INK;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const jx = (h1(seed + i * 3.1) - 0.5) * amp * 2;
    const jy = (h1(seed + i * 7.7) - 0.5) * amp * 2;
    if (i) g.lineTo(x + jx, y + jy);
    else g.moveTo(x + jx, y + jy);
  }
  if (o.close) g.closePath();
  if (o.fill) {
    g.fillStyle = o.fill;
    g.fill();
  }
  g.stroke();
}

// a straight line drawn by hand: broken into a few pieces, each a little off
export function line(g, x0, y0, x1, y1, o = {}) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 40));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  wobble(g, pts, o);
}

// a box by hand: filled, its outline gone over twice (the second time a little off)
export function box(g, x, y, w, h, o = {}) {
  const r = o.r || 0;
  const pts = r ? roundPts(x, y, w, h, r) : [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  if (o.fill) {
    g.fillStyle = o.fill;
    g.beginPath();
    pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b)));
    g.closePath();
    g.fill();
  }
  if (o.hatch) hatch(g, x, y, w, h, o.hatch);
  if (o.stroke !== false) {
    wobble(g, pts, { close: true, w: o.w || 3, color: o.color, seed: o.seed || x + y * 3, amp: o.amp });
    if (o.twice !== false) wobble(g, pts, { close: true, w: (o.w || 3) * 0.45, color: o.color, seed: (o.seed || x + y * 3) + 17, amp: (o.amp === undefined ? 1.6 : o.amp) * 1.6 });
  }
}

function roundPts(x, y, w, h, r) {
  const pts = [];
  const arc = (cx, cy, a0) => {
    for (let k = 0; k <= 4; k++) {
      const a = a0 + (k / 4) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  arc(x + w - r, y + r, -Math.PI / 2);
  arc(x + w - r, y + h - r, 0);
  arc(x + r, y + h - r, Math.PI / 2);
  arc(x + r, y + r, Math.PI);
  return pts;
}

// a circle by hand
export function circle(g, x, y, r, o = {}) {
  const n = Math.max(10, Math.round(r * 0.8));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  wobble(g, pts, { close: true, w: o.w || 3, color: o.color, fill: o.fill, seed: o.seed || x * 0.7 + y, amp: o.amp === undefined ? Math.min(1.6, r * 0.06) : o.amp });
}

// hatching: diagonal strokes over a box, for the shade
export function hatch(g, x, y, w, h, o = {}) {
  const sp = o.sp || 9;
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.strokeStyle = o.color || 'rgba(36, 36, 44, 0.35)';
  g.lineWidth = o.w || 1.4;
  g.beginPath();
  for (let d = -h; d < w; d += sp) {
    g.moveTo(x + d, y + h);
    g.lineTo(x + d + h, y);
  }
  g.stroke();
  g.restore();
}

// letters by hand: an outline round them, so they read on anything
export function text(g, s, x, y, o = {}) {
  g.font = `${o.weight || ''} ${o.size || 28}px ${o.font || HAND}`;
  g.textAlign = o.align || 'center';
  g.textBaseline = o.base || 'middle';
  if (o.outline !== false) {
    g.lineWidth = o.ow || Math.max(3, (o.size || 28) * 0.16);
    g.strokeStyle = o.outline || PAPER;
    g.lineJoin = 'round';
    g.strokeText(s, x, y);
  }
  g.fillStyle = o.color || INK;
  g.fillText(s, x, y);
}

// the paper under it all, with its faint blue lines
export function paper(g, W, H, o = {}) {
  g.fillStyle = o.color || PAPER;
  g.fillRect(0, 0, W, H);
  if (o.lines === false) return;
  g.strokeStyle = 'rgba(90, 120, 200, 0.13)';
  g.lineWidth = 1;
  g.beginPath();
  for (let y = 26; y < H; y += 26) {
    g.moveTo(0, y);
    g.lineTo(W, y);
  }
  g.stroke();
}

// a person by hand: a head, a body and four limbs, posed (angles in radians: arms from the
// shoulders, legs from the hips; 0 = straight down); colour of the shirt and the trousers
export function figure(g, x, y, s, pose, o = {}) {
  const P = { la: 0.3, ra: -0.3, ll: 0.12, rl: -0.12, lean: 0, hop: 0, ...pose };
  const ink = o.ink || INK;
  const hip = [x + Math.sin(P.lean) * s * 0.1, y - s * 0.9 - P.hop * s];
  const neck = [hip[0] + Math.sin(P.lean) * s * 0.55, hip[1] - s * 0.62];
  const limb = (from, len, a, bend, col, w) => {
    const knee = [from[0] + Math.sin(a) * len * 0.5, from[1] + Math.cos(a) * len * 0.5];
    const end = [knee[0] + Math.sin(a + bend) * len * 0.5, knee[1] + Math.cos(a + bend) * len * 0.5];
    wobble(g, [from, knee, end], { w, color: col, seed: from[0] + a * 10, amp: 0.6 });
    return end;
  };
  // the legs, the trousers' colour over the ink
  for (const [a, b] of [[P.ll, P.lb || 0], [P.rl, P.rb || 0]]) {
    limb(hip, s * 0.9, a, b, ink, s * 0.13);
    limb(hip, s * 0.9, a, b, o.legs || '#3a3f6a', s * 0.08);
  }
  // the body
  wobble(g, [hip, neck], { w: s * 0.24, color: ink, seed: x, amp: 0.5 });
  wobble(g, [hip, neck], { w: s * 0.17, color: o.shirt || PENS.pink, seed: x + 1, amp: 0.5 });
  // the arms
  const sh = [neck[0], neck[1] + s * 0.06];
  for (const [a, b] of [[P.la, P.lab || 0.3], [P.ra, P.rab || -0.3]]) {
    limb(sh, s * 0.75, a, b, ink, s * 0.11);
    limb(sh, s * 0.75, a, b, o.skin || '#f0c49c', s * 0.06);
  }
  // the head
  circle(g, neck[0], neck[1] - s * 0.2, s * 0.18, { fill: o.skin || '#f0c49c', w: s * 0.05, color: ink, seed: x + 5 });
  if (o.hair) {
    g.fillStyle = o.hair;
    g.beginPath();
    g.arc(neck[0], neck[1] - s * 0.24, s * 0.17, Math.PI * 1.05, Math.PI * 1.95);
    g.fill();
  }
}

// a number as money: $1,250
export const cash = (n) => '$' + Math.round(n).toLocaleString('en-US');
