import * as THREE from 'three';
import { seeded } from './kit.js';

// (v5, ROADMAP 13.13) What is printed on the things a shop sells, drawn once into one picture: the
// labels round the cans and the bottles, the fronts of the boxes and the bags, the cartons, the
// wrappers at the till, the strips of prices along the shelves, the signs over the aisles, the
// till's screen, the posters, the papers at the door. Each is drawn the way an illustrator letters
// a label in a picture of a shop - a field of colour, a band, the name in a fat hand with an inked
// edge, a little drawing (a fruit, a sun, a wave), lines of small print - so that up close a can
// reads as a can of tomatoes of one maker and not a red cylinder. The names are made up.
//
// The picture is one atlas (2048 x 2048, a few cells a step while the first shop is built:
// world/products.js uses it through the shops' printed pen). A cell is asked for by its name; its
// place comes back as [u0, v0, u1, v1] (v up, as the graphics card has it).

const W = 2048;
const H = 2048;
const PAD = 6;

const INK = '#1b1722';
const PAPER = '#f6f0e2';

// the makers on the shelves (made up), what they look like: [name, field, band, letters, drawing]
export const BRANDS = {
  soda: [
    ['FIZZLE', '#c8202b', '#f4efe6', '#ffffff', 'swirl'],
    ['SKETCH-UP', '#2f9a45', '#f2d23b', '#ffffff', 'lemon'],
    ['SUNSET POP', '#f07a1d', '#ffd35a', '#ffffff', 'sun'],
    ['BERRY BLOT', '#6b3591', '#e05a9c', '#ffffff', 'berry'],
    ['MARGIN ZERO', '#1c1c22', '#b9bcc4', '#e8e8ec', 'swirl'],
    ['PAPER PEACH', '#f2a07b', '#fff2df', '#7a2f1c', 'peach'],
  ],
  water: [
    ['INKWELL', '#4f9ad8', '#e9f4fb', '#ffffff', 'mountain'],
    ['BLUE PAGE', '#2d62b5', '#cfe6f7', '#ffffff', 'wave'],
  ],
  energy: [['GRAPHITE', '#141416', '#7cf03a', '#7cf03a', 'bolt']],
  juice: [
    ['SUNSET SQUEEZE', '#f6a21b', '#fff5d6', '#2b6e2f', 'orange'],
    ['APPLE LINE', '#cf2f2a', '#fdf1d8', '#2d5e22', 'apple'],
  ],
  milk: [
    ['MARGIN MILK', '#f7f7f3', '#2c6fc0', '#2c6fc0', 'cow'],
    ['MARGIN LIGHT', '#f7f7f3', '#3aa0d8', '#3aa0d8', 'cow'],
  ],
  tins: [
    ["PENNY'S", '#c42a22', '#f7e6c4', '#ffffff', 'tomato'],
    ['GRAPHITE BEANS', '#7a4a2a', '#f3d79c', '#ffffff', 'beans'],
    ['CORN DOODLE', '#f2c22b', '#2e7a35', '#2e7a35', 'corn'],
    ['BAYLINE', '#245a9c', '#f5f0e2', '#ffffff', 'fish'],
    ['SOUP', '#d2302d', '#f8f3ea', '#ffffff', 'bowl'],
    ['PEACH HALVES', '#f3a54a', '#fbe8c7', '#7a3216', 'peach'],
  ],
  jars: [
    ['SMUDGE JAM', '#a8202f', '#f9e6d2', '#ffffff', 'berry'],
    ['CRUNCH LINE', '#c9853a', '#f7ead2', '#5a2e12', 'nut'],
    ['DILL DOODLES', '#3f7d2f', '#eef3d2', '#ffffff', 'pickle'],
    ['HONEY NIB', '#e8a623', '#fff1c8', '#6a3a0a', 'bee'],
    ['SALSA SKETCH', '#e0582a', '#fae7c8', '#ffffff', 'pepper'],
  ],
  sauce: [
    ["SKETCHY'S", '#c9211f', '#f6efe2', '#ffffff', 'tomato'],
    ['GOLD LEAF', '#d4a22a', '#f8f1d8', '#3a5a1a', 'olive'],
  ],
  cereal: [
    ["DOODLE-O'S", '#e9a21f', '#c8282f', '#ffffff', 'bowl'],
    ['FOLIO FLAKES', '#2f6cc2', '#f4d33c', '#ffffff', 'sun'],
    ['CHOCO SCRIBBLES', '#5a3420', '#f06aa4', '#ffffff', 'swirl'],
    ['EASEL OATS', '#e5d4a4', '#8a5a2b', '#5a3216', 'wheat'],
  ],
  boxes: [
    ['NIB NOODLES', '#1f5aa8', '#f7d43f', '#ffffff', 'noodle'],
    ['CRAYON CRACKERS', '#d8461e', '#f5d9a1', '#ffffff', 'cracker'],
    ['RULED RICE', '#f4ead6', '#2e6b9a', '#2e6b9a', 'wheat'],
    ['MAC & INK', '#2e5fb0', '#f7c62a', '#f7c62a', 'bowl'],
  ],
  tea: [
    ['EARL GRAPHITE', '#2a4a3a', '#d9b45a', '#f4e7c4', 'leaf'],
    ['CHAMOMILE', '#e8d36a', '#ffffff', '#5a6a1a', 'flower'],
    ['PENCIL PRETZELS', '#9a5320', '#f6dca0', '#ffffff', 'pretzel'],
    ['MINT LINES', '#3fae8f', '#eaf7f0', '#ffffff', 'leaf'],
  ],
  chips: [
    ['CRUNCHLINES', '#f2c321', '#d22e2a', '#d22e2a', 'chip'],
    ['CRUNCHLINES BBQ', '#7a2c1d', '#f29c2b', '#f6d54b', 'chip'],
    ['CRUNCHLINES SOUR', '#2f8a4c', '#e6f0d2', '#ffffff', 'chip'],
    ['PRETZEL LOOPS', '#2b4f8f', '#f1d07c', '#ffffff', 'pretzel'],
  ],
  bags: [
    ['CHARCOAL ROAST', '#2a1d18', '#c9934d', '#f0d39c', 'bean'],
    ['BLANK PAGE FLOUR', '#f4f0e6', '#c7302b', '#c7302b', 'wheat'],
    ['SWEET SKETCH', '#f9f6f0', '#3a7bc8', '#3a7bc8', 'cube'],
    ['RULED RICE', '#e9e2cf', '#b03a28', '#b03a28', 'wheat'],
  ],
  clean: [
    ['BLUE LINE', '#2d6fd0', '#f3f6fb', '#ffffff', 'drop'],
    ['CLOUD 9', '#f4f1fb', '#8d6cc9', '#8d6cc9', 'cloud'],
    ['ERASER CLEAN', '#2fae63', '#fff4c2', '#ffffff', 'sparkle'],
  ],
  candy: [
    ['SMUDGE FUDGE', '#5b2e1c', '#e8b35a', '#f6e1b0'],
    ['NOUGAT NOTE', '#c62d3a', '#f7e3c4', '#ffffff'],
    ['CARAMEL CURL', '#e39a24', '#5a2c12', '#ffffff'],
    ['MINT MARGIN', '#3fb39a', '#e9f8f1', '#ffffff'],
    ['CHEWLINES', '#ef5f9c', '#ffffff', '#ffffff'],
    ['CHEWLINES', '#4a8de0', '#ffffff', '#ffffff'],
  ],
  meds: [
    ['ASPIR-INK', '#f6f6f2', '#d0282e', '#d0282e', 'cross'],
    ['PATCH-IT', '#f2c98d', '#d0282e', '#ffffff', 'cross'],
    ['COUGH CALM', '#5a7fd0', '#f4f7fb', '#ffffff', 'drop'],
    ['VITA-LINE', '#f7b52a', '#ffffff', '#5a3a0a', 'sun'],
  ],
  bread: [
    ['DAILY CRUST', '#f3e7cf', '#b8742e', '#7a3f12', 'wheat'],
    ['SOFT LINE', '#f6f2ea', '#3a7bc8', '#3a7bc8', 'wheat'],
  ],
};

// what each kind of cell is, its size in pixels
const KIND = {
  can: [192, 96],
  bottle: [192, 80],
  jar: [192, 80],
  box: [176, 240],
  side: [56, 240],
  small: [160, 112],
  bag: [176, 240],
  carton: [112, 224],
  jug: [128, 192],
  candy: [160, 40],
  strip: [448, 28],
  header: [448, 72],
  poster: [192, 288],
  paper: [192, 144],
  card: [128, 80],
};

class Atlas {
  constructor() {
    this.c = document.createElement('canvas');
    this.c.width = W;
    this.c.height = H;
    this.g = this.c.getContext('2d');
    this.g.fillStyle = PAPER;
    this.g.fillRect(0, 0, W, H);
    this.cells = new Map();
    this.used = 0;
    this.todo = [];
    this.done = false;
    this.tex = new THREE.CanvasTexture(this.c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    this.tex.generateMipmaps = true;
    this.tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.tex.magFilter = THREE.LinearFilter;
    this.rng = seeded(131313);
  }

  // a cell of w x h pixels asked for (its place is found when they all are: pack)
  place(name, w, h, draw) {
    if (this.cells.has(name)) return this.cells.get(name);
    const cell = { name, x: 0, y: 0, w, h, uv: [0, 0, 1, 1] };
    this.cells.set(name, cell);
    this.todo.push([cell, draw]);
    return cell;
  }

  // every cell put in its place: the tallest first, in rows left to right (cells of a height side by
  // side, so the rows waste little)
  pack() {
    // (shelves: each as tall as the first cell on it; a cell goes on the first shelf it fits on - the
    // short ones into what is left at the ends of the tall ones' shelves)
    const list = [...this.cells.values()].sort((a, b) => b.h - a.h || b.w - a.w);
    const shelves = [];
    let top = PAD;
    for (const c of list) {
      let sh = shelves.find((q) => q.h >= c.h && q.x + c.w + PAD <= W);
      if (!sh) {
        sh = { y: top, h: c.h, x: PAD };
        shelves.push(sh);
        top += c.h + PAD * 2;
        if (top > H) console.warn('labels: atlas full at', c.name);
      }
      c.x = sh.x;
      c.y = Math.min(sh.y, H - c.h - PAD);
      c.uv = [c.x / W, 1 - (c.y + c.h) / H, (c.x + c.w) / W, 1 - c.y / H];
      sh.x += c.w + PAD * 2;
    }
    this.used = top / H;
  }

  // the cells asked for so far, drawn (n at a time: a generator that yields between them)
  *drawSteps(n = 6) {
    let k = 0;
    while (this.todo.length) {
      const [cell, draw] = this.todo.shift();
      const g = this.g;
      g.save();
      g.beginPath();
      g.rect(cell.x - PAD + 1, cell.y - PAD + 1, cell.w + PAD * 2 - 2, cell.h + PAD * 2 - 2);
      g.clip();
      g.translate(cell.x, cell.y);
      // (a margin of the cell's own edge colour round it, so the smaller copies of the picture do
      // not bleed the next cell in)
      draw(g, cell.w, cell.h, this.rng);
      g.restore();
      bleed(g, cell);
      if (++k % n === 0) yield;
    }
    // (sent to the card once more only when something new was drawn on it)
    if (k || !this.done) this.tex.needsUpdate = true;
    this.done = true;
  }

  // every cell asked for so far, drawn now (the first shop of the new kind built with its block)
  drawNow() {
    if (!this.todo.length) return;
    const it = this.drawSteps(1e9);
    while (!it.next().done);
  }
}

// the cell's border pixels copied out into its padding
function bleed(g, c) {
  const p = PAD - 1;
  g.drawImage(g.canvas, c.x, c.y, c.w, 1, c.x, c.y - p, c.w, p);
  g.drawImage(g.canvas, c.x, c.y + c.h - 1, c.w, 1, c.x, c.y + c.h, c.w, p);
  g.drawImage(g.canvas, c.x, c.y - p, 1, c.h + p * 2, c.x - p, c.y - p, p, c.h + p * 2);
  g.drawImage(g.canvas, c.x + c.w - 1, c.y - p, 1, c.h + p * 2, c.x + c.w, c.y - p, p, c.h + p * 2);
}

let ATLAS = null;
export function labels() {
  if (!ATLAS) {
    ATLAS = new Atlas();
    defineAll(ATLAS);
    ATLAS.pack();
  }
  return ATLAS;
}

// the uv box of a cell by its name (null: none such)
export function cellUV(name) {
  const c = labels().cells.get(name);
  return c ? c.uv : null;
}

// ------------------------------------------------------------------ the hand that letters them
function font(px, fam = 'Rubik', wt = 800) {
  return `${wt} ${px}px "${fam}", "Arial Black", sans-serif`;
}

// the name in a fat hand: its letters filled, an inked edge round them, fitted into w
function title(g, text, x, y, w, px, fill, o = {}) {
  g.save();
  g.font = font(px, o.fam, o.wt);
  const m = g.measureText(text).width;
  const s = Math.min(1, w / Math.max(1, m));
  g.translate(x, y);
  if (o.rot) g.rotate(o.rot);
  g.scale(s * (o.sx || 1), 1);
  g.textAlign = o.align || 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  if (o.edge !== false) {
    g.strokeStyle = o.edge || INK;
    g.lineWidth = Math.max(2, px * 0.16) / s;
    g.strokeText(text, 0, 0);
  }
  g.fillStyle = fill;
  g.fillText(text, 0, 0);
  g.restore();
}

// small print: grey lines standing in for the words nobody reads
function print(g, x, y, w, n, col = 'rgba(30,25,35,0.55)', gap = 5, rng = Math.random) {
  g.strokeStyle = col;
  g.lineWidth = 1.4;
  for (let i = 0; i < n; i++) {
    const l = w * (0.55 + rng() * 0.45);
    g.beginPath();
    g.moveTo(x, y + i * gap);
    g.lineTo(x + l, y + i * gap);
    g.stroke();
  }
}

// a line drawn by hand: twice, a little apart
function hand(g, pts, col = INK, w = 2.2, rng = Math.random) {
  g.strokeStyle = col;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let p = 0; p < 2; p++) {
    g.lineWidth = p ? w * 0.55 : w;
    g.beginPath();
    pts.forEach(([px, py], i) => {
      const jx = (rng() - 0.5) * (p ? 1.6 : 0.8);
      const jy = (rng() - 0.5) * (p ? 1.6 : 0.8);
      if (i) g.lineTo(px + jx, py + jy);
      else g.moveTo(px + jx, py + jy);
    });
    g.stroke();
  }
}

// a ring drawn by hand
function ring(g, x, y, r, col = INK, w = 2, rng = Math.random, ry = r) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2 + 0.2;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * ry]);
  }
  hand(g, pts, col, w, rng);
}

// shading put in with the pen inside a shape (the path given): diagonal strokes
function hatch(g, path, col, gap = 4, ang = 0.8, w = 1.2) {
  g.save();
  path();
  g.clip();
  g.strokeStyle = col;
  g.lineWidth = w;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  for (let k = -400; k < 400; k += gap) {
    g.beginPath();
    g.moveTo(k * c - 400 * s, k * s + 400 * c);
    g.lineTo(k * c + 400 * s, k * s - 400 * c);
    g.stroke();
  }
  g.restore();
}

function blob(g, x, y, r, fill, rng, ry = r) {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  g.fill();
  hatch(g, () => {
    g.beginPath();
    g.ellipse(x + r * 0.25, y + ry * 0.25, r * 0.85, ry * 0.85, 0, 0, Math.PI * 2);
  }, 'rgba(20,10,25,0.28)', 3.5, 0.9, 1.1);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.ellipse(x - r * 0.35, y - ry * 0.4, r * 0.22, ry * 0.14, -0.6, 0, Math.PI * 2);
  g.fill();
  ring(g, x, y, r, INK, 2, rng, ry);
}

function leafAt(g, x, y, s, rot, col, rng) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(s * 0.6, -s * 0.45, s * 1.2, 0);
  g.quadraticCurveTo(s * 0.6, s * 0.45, 0, 0);
  g.fill();
  hand(g, [[0, 0], [s * 0.6, -s * 0.36], [s * 1.2, 0], [s * 0.6, s * 0.36], [0, 0]], INK, 1.6, rng);
  hand(g, [[s * 0.1, 0], [s * 1.0, 0]], INK, 1, rng);
  g.restore();
}

// the little drawings on the labels
function drawing(g, kind, x, y, r, rng, accent = '#f2c22b') {
  switch (kind) {
    case 'lemon':
      blob(g, x, y, r, '#f3dc3a', rng, r * 0.78);
      leafAt(g, x + r * 0.5, y - r * 0.7, r * 0.6, -0.6, '#3f9a3a', rng);
      break;
    case 'orange':
      blob(g, x, y, r, '#f39a1d', rng);
      leafAt(g, x + r * 0.2, y - r * 0.95, r * 0.6, -0.9, '#3f9a3a', rng);
      break;
    case 'apple':
      blob(g, x, y, r, '#d52e2a', rng);
      hand(g, [[x, y - r * 0.8], [x + r * 0.15, y - r * 1.25]], '#5a3216', 2.4, rng);
      leafAt(g, x + r * 0.15, y - r * 1.1, r * 0.55, -0.4, '#3f9a3a', rng);
      break;
    case 'peach':
      blob(g, x, y, r, '#f6a77a', rng);
      leafAt(g, x, y - r * 0.9, r * 0.55, -1.1, '#4f8a3a', rng);
      break;
    case 'tomato':
      blob(g, x, y, r, '#d8312a', rng, r * 0.86);
      for (let i = 0; i < 5; i++) leafAt(g, x, y - r * 0.78, r * 0.38, -Math.PI / 2 + (i - 2) * 0.7, '#3f8a2f', rng);
      break;
    case 'berry':
      for (let i = 0; i < 3; i++) blob(g, x + (i - 1) * r * 0.7, y + (i % 2) * r * 0.4, r * 0.55, '#7a2a7a', rng);
      leafAt(g, x, y - r * 0.6, r * 0.5, -1.4, '#3f8a2f', rng);
      break;
    case 'sun': {
      g.fillStyle = '#ffd23a';
      g.beginPath();
      g.arc(x, y, r * 0.55, 0, Math.PI * 2);
      g.fill();
      ring(g, x, y, r * 0.55, INK, 2, rng);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        hand(g, [[x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72], [x + Math.cos(a) * r, y + Math.sin(a) * r]], INK, 2, rng);
      }
      break;
    }
    case 'swirl': {
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = r * 0.18;
      g.beginPath();
      g.moveTo(x - r * 1.6, y + r * 0.4);
      g.bezierCurveTo(x - r * 0.5, y - r * 0.9, x + r * 0.5, y + r * 0.9, x + r * 1.6, y - r * 0.4);
      g.stroke();
      hand(g, [[x - r * 1.6, y + r * 0.62], [x - r * 0.6, y - r * 0.2], [x + r * 0.6, y + r * 0.5], [x + r * 1.6, y - r * 0.18]], INK, 1.2, rng);
      break;
    }
    case 'mountain':
      g.fillStyle = '#e9f4fb';
      g.beginPath();
      g.moveTo(x - r * 1.4, y + r * 0.6);
      g.lineTo(x - r * 0.3, y - r * 0.7);
      g.lineTo(x + r * 0.2, y - r * 0.1);
      g.lineTo(x + r * 0.6, y - r * 0.5);
      g.lineTo(x + r * 1.4, y + r * 0.6);
      g.closePath();
      g.fill();
      hand(g, [[x - r * 1.4, y + r * 0.6], [x - r * 0.3, y - r * 0.7], [x + r * 0.2, y - r * 0.1], [x + r * 0.6, y - r * 0.5], [x + r * 1.4, y + r * 0.6]], INK, 2, rng);
      hatch(g, () => {
        g.beginPath();
        g.moveTo(x - r * 0.3, y - r * 0.7);
        g.lineTo(x + r * 0.2, y + r * 0.6);
        g.lineTo(x + r * 1.4, y + r * 0.6);
        g.lineTo(x + r * 0.6, y - r * 0.5);
        g.closePath();
      }, 'rgba(40,90,150,0.6)', 3.2, 0.5);
      break;
    case 'wave':
      for (let k = 0; k < 3; k++) {
        const pts = [];
        for (let i = 0; i <= 16; i++) pts.push([x - r * 1.5 + (i / 16) * r * 3, y + (k - 1) * r * 0.45 + Math.sin(i * 0.9 + k) * r * 0.16]);
        hand(g, pts, k === 1 ? '#ffffff' : '#bfe3f7', 3, rng);
      }
      break;
    case 'bolt':
      g.fillStyle = accent;
      g.beginPath();
      g.moveTo(x + r * 0.2, y - r);
      g.lineTo(x - r * 0.5, y + r * 0.15);
      g.lineTo(x - r * 0.02, y + r * 0.1);
      g.lineTo(x - r * 0.25, y + r);
      g.lineTo(x + r * 0.55, y - r * 0.2);
      g.lineTo(x + r * 0.05, y - r * 0.15);
      g.closePath();
      g.fill();
      hand(g, [[x + r * 0.2, y - r], [x - r * 0.5, y + r * 0.15], [x - r * 0.02, y + r * 0.1], [x - r * 0.25, y + r], [x + r * 0.55, y - r * 0.2], [x + r * 0.05, y - r * 0.15], [x + r * 0.2, y - r]], '#0a0a0a', 2, rng);
      break;
    case 'cow': {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(x, y, r * 1.1, r * 0.8, 0, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 4; i++) blobFlat(g, x + (rng() - 0.5) * r * 1.2, y + (rng() - 0.5) * r * 0.8, r * (0.18 + rng() * 0.12), '#1c1c22');
      ring(g, x, y, r * 1.1, INK, 2, rng, r * 0.8);
      g.fillStyle = '#f2a7b8';
      g.beginPath();
      g.ellipse(x, y + r * 0.45, r * 0.45, r * 0.24, 0, 0, Math.PI * 2);
      g.fill();
      ring(g, x, y + r * 0.45, r * 0.45, INK, 1.5, rng, r * 0.24);
      break;
    }
    case 'beans':
      for (let i = 0; i < 6; i++) blob(g, x + ((i % 3) - 1) * r * 0.62, y + (Math.floor(i / 3) - 0.5) * r * 0.6, r * 0.32, '#9a5a2a', rng, r * 0.22);
      break;
    case 'corn': {
      g.fillStyle = '#f6d43a';
      g.beginPath();
      g.ellipse(x, y, r * 0.42, r * 1.05, 0.3, 0, Math.PI * 2);
      g.fill();
      hatch(g, () => {
        g.beginPath();
        g.ellipse(x, y, r * 0.42, r * 1.05, 0.3, 0, Math.PI * 2);
      }, 'rgba(160,110,10,0.65)', 5, 0.3);
      ring(g, x, y, r * 0.42, INK, 2, rng, r * 1.05);
      leafAt(g, x - r * 0.2, y + r * 0.7, r * 0.9, -2.2, '#3f8a2f', rng);
      break;
    }
    case 'fish': {
      g.fillStyle = '#9fc9e8';
      g.beginPath();
      g.ellipse(x, y, r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(x + r * 0.95, y);
      g.lineTo(x + r * 1.55, y - r * 0.45);
      g.lineTo(x + r * 1.55, y + r * 0.45);
      g.closePath();
      g.fill();
      ring(g, x, y, r * 1.1, INK, 2, rng, r * 0.5);
      hand(g, [[x + r * 0.95, y], [x + r * 1.55, y - r * 0.45], [x + r * 1.55, y + r * 0.45], [x + r * 0.95, y]], INK, 2, rng);
      g.fillStyle = INK;
      g.beginPath();
      g.arc(x - r * 0.65, y - r * 0.1, r * 0.08, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'bowl': {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(x - r * 1.2, y - r * 0.1);
      g.quadraticCurveTo(x, y + r * 1.3, x + r * 1.2, y - r * 0.1);
      g.closePath();
      g.fill();
      for (let i = 0; i < 7; i++) blob(g, x + (i - 3) * r * 0.32, y - r * 0.18 - (i % 2) * r * 0.16, r * 0.2, accent, rng);
      hand(g, [[x - r * 1.2, y - r * 0.1], [x - r * 0.6, y + r * 0.5], [x, y + r * 0.62], [x + r * 0.6, y + r * 0.5], [x + r * 1.2, y - r * 0.1]], INK, 2.2, rng);
      hand(g, [[x - r * 1.2, y - r * 0.1], [x + r * 1.2, y - r * 0.1]], INK, 2, rng);
      break;
    }
    case 'wheat':
      for (let k = -1; k <= 1; k++) {
        hand(g, [[x + k * r * 0.3, y + r], [x + k * r * 0.55, y - r * 0.6]], '#8a5a20', 2, rng);
        for (let i = 0; i < 4; i++) {
          const yy = y - r * 0.2 - i * r * 0.22;
          blobFlat(g, x + k * r * 0.5 - r * 0.12, yy, r * 0.12, '#d9a64a');
          blobFlat(g, x + k * r * 0.5 + r * 0.12, yy, r * 0.12, '#d9a64a');
        }
      }
      break;
    case 'noodle':
      for (let k = 0; k < 5; k++) {
        const pts = [];
        for (let i = 0; i <= 12; i++) pts.push([x - r * 1.2 + (i / 12) * r * 2.4, y + (k - 2) * r * 0.25 + Math.sin(i * 1.3 + k) * r * 0.12]);
        hand(g, pts, '#f2d27a', 3, rng);
      }
      break;
    case 'cracker':
      for (let i = 0; i < 3; i++) {
        const xx = x + (i - 1) * r * 0.75;
        g.fillStyle = '#e8b25a';
        g.fillRect(xx - r * 0.4, y - r * 0.4 + i * 4, r * 0.8, r * 0.8);
        hand(g, [[xx - r * 0.4, y - r * 0.4 + i * 4], [xx + r * 0.4, y - r * 0.4 + i * 4], [xx + r * 0.4, y + r * 0.4 + i * 4], [xx - r * 0.4, y + r * 0.4 + i * 4], [xx - r * 0.4, y - r * 0.4 + i * 4]], INK, 1.8, rng);
        g.fillStyle = INK;
        for (let d = 0; d < 4; d++) g.fillRect(xx - r * 0.2 + (d % 2) * r * 0.4, y - r * 0.2 + Math.floor(d / 2) * r * 0.4 + i * 4, 2, 2);
      }
      break;
    case 'leaf':
      leafAt(g, x - r * 0.9, y + r * 0.4, r * 1.2, -0.5, '#4f9a4a', rng);
      leafAt(g, x - r * 0.4, y + r * 0.5, r * 1.0, -1.2, '#6fb25a', rng);
      break;
    case 'flower':
      for (let i = 0; i < 6; i++) blob(g, x + Math.cos(i) * r * 0.5, y + Math.sin(i) * r * 0.5, r * 0.36, '#ffffff', rng);
      blob(g, x, y, r * 0.32, '#f2c22b', rng);
      break;
    case 'pretzel': {
      g.strokeStyle = '#9a5320';
      g.lineWidth = r * 0.28;
      g.beginPath();
      g.arc(x - r * 0.35, y, r * 0.45, 0, Math.PI * 2);
      g.arc(x + r * 0.35, y, r * 0.45, Math.PI, Math.PI * 3);
      g.stroke();
      ring(g, x - r * 0.35, y, r * 0.6, INK, 1.4, rng);
      ring(g, x + r * 0.35, y, r * 0.6, INK, 1.4, rng);
      break;
    }
    case 'chip':
      for (let i = 0; i < 4; i++) {
        g.save();
        g.translate(x + (i - 1.5) * r * 0.55, y + (i % 2) * r * 0.25);
        g.rotate(i * 0.7);
        blobFlat(g, 0, 0, r * 0.45, '#f3c64a', r * 0.32);
        hatch(g, () => {
          g.beginPath();
          g.ellipse(r * 0.08, r * 0.08, r * 0.4, r * 0.28, 0, 0, Math.PI * 2);
        }, 'rgba(140,80,10,0.5)', 3, 0.6);
        ring(g, 0, 0, r * 0.45, INK, 1.6, rng, r * 0.32);
        g.restore();
      }
      break;
    case 'bean':
      for (let i = 0; i < 5; i++) {
        const xx = x + Math.cos(i * 1.3) * r * 0.6;
        const yy = y + Math.sin(i * 1.3) * r * 0.5;
        blob(g, xx, yy, r * 0.3, '#6a3a1e', rng, r * 0.22);
        hand(g, [[xx - r * 0.22, yy], [xx + r * 0.22, yy]], '#2a1408', 1.4, rng);
      }
      break;
    case 'cube':
      for (let i = 0; i < 3; i++) {
        const xx = x + (i - 1) * r * 0.65;
        g.fillStyle = '#ffffff';
        g.fillRect(xx - r * 0.28, y - r * 0.28, r * 0.56, r * 0.56);
        hand(g, [[xx - r * 0.28, y - r * 0.28], [xx + r * 0.28, y - r * 0.28], [xx + r * 0.28, y + r * 0.28], [xx - r * 0.28, y + r * 0.28], [xx - r * 0.28, y - r * 0.28]], INK, 1.6, rng);
      }
      break;
    case 'drop':
      g.fillStyle = '#bfe0ff';
      g.beginPath();
      g.moveTo(x, y - r);
      g.quadraticCurveTo(x + r * 0.9, y + r * 0.2, x, y + r * 0.8);
      g.quadraticCurveTo(x - r * 0.9, y + r * 0.2, x, y - r);
      g.fill();
      hand(g, [[x, y - r], [x + r * 0.55, y], [x + r * 0.4, y + r * 0.55], [x, y + r * 0.8], [x - r * 0.4, y + r * 0.55], [x - r * 0.55, y], [x, y - r]], INK, 2, rng);
      break;
    case 'cloud':
      for (let i = 0; i < 4; i++) blob(g, x + (i - 1.5) * r * 0.5, y + (i % 2 ? -r * 0.2 : r * 0.1), r * 0.42, '#ffffff', rng);
      break;
    case 'sparkle':
      for (let i = 0; i < 3; i++) star(g, x + (i - 1) * r * 0.7, y + (i % 2) * r * 0.3, r * (0.35 + (i % 2) * 0.15), '#ffffff', rng);
      break;
    case 'cross':
      g.fillStyle = accent;
      g.fillRect(x - r * 0.25, y - r * 0.75, r * 0.5, r * 1.5);
      g.fillRect(x - r * 0.75, y - r * 0.25, r * 1.5, r * 0.5);
      hand(g, [[x - r * 0.25, y - r * 0.75], [x + r * 0.25, y - r * 0.75], [x + r * 0.25, y - r * 0.25], [x + r * 0.75, y - r * 0.25], [x + r * 0.75, y + r * 0.25], [x + r * 0.25, y + r * 0.25], [x + r * 0.25, y + r * 0.75], [x - r * 0.25, y + r * 0.75], [x - r * 0.25, y + r * 0.25], [x - r * 0.75, y + r * 0.25], [x - r * 0.75, y - r * 0.25], [x - r * 0.25, y - r * 0.25], [x - r * 0.25, y - r * 0.75]], INK, 1.6, rng);
      break;
    case 'nut':
      for (let i = 0; i < 4; i++) blob(g, x + (i - 1.5) * r * 0.5, y + (i % 2) * r * 0.3, r * 0.34, '#d49a52', rng, r * 0.42);
      break;
    case 'pickle':
      blob(g, x, y, r * 1.1, '#5a9a3a', rng, r * 0.45);
      for (let i = 0; i < 6; i++) g.fillRect(x - r * 0.8 + i * r * 0.3, y - 2 + (i % 2) * 6, 3, 3);
      break;
    case 'bee':
      blob(g, x, y, r * 0.75, '#f2c22b', rng, r * 0.55);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = INK;
        g.fillRect(x - r * 0.4 + i * r * 0.32, y - r * 0.5, r * 0.12, r * 1.0);
      }
      blob(g, x - r * 0.2, y - r * 0.75, r * 0.32, 'rgba(255,255,255,0.85)', rng);
      blob(g, x + r * 0.25, y - r * 0.75, r * 0.32, 'rgba(255,255,255,0.85)', rng);
      break;
    case 'pepper':
      blob(g, x, y, r * 0.9, '#d8312a', rng, r * 0.6);
      leafAt(g, x - r * 0.9, y - r * 0.2, r * 0.5, -2.6, '#3f8a2f', rng);
      break;
    case 'olive':
      for (let i = 0; i < 3; i++) blob(g, x + (i - 1) * r * 0.6, y, r * 0.32, '#6a7a2a', rng, r * 0.44);
      leafAt(g, x - r * 1.0, y - r * 0.5, r * 0.9, -0.3, '#5a8a3a', rng);
      break;
    default:
      break;
  }
}

function blobFlat(g, x, y, r, fill, ry = r) {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  g.fill();
}

function star(g, x, y, r, fill, rng) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.38 : r;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  g.fillStyle = fill;
  g.beginPath();
  pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.fill();
  hand(g, pts, INK, 1.6, rng);
}

// a burst with a word in it: NEW, SALE, 2 FOR 1
function burst(g, x, y, r, fill, text, rng) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = i % 2 ? r * 0.8 : r;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  g.fillStyle = fill;
  g.beginPath();
  pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.fill();
  hand(g, pts, INK, 1.5, rng);
  title(g, text, x, y, r * 1.5, r * 0.62, '#ffffff', { edge: INK });
}

function barcode(g, x, y, w, h, rng) {
  g.fillStyle = '#ffffff';
  g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle = INK;
  let xx = x;
  while (xx < x + w) {
    const bw = rng() < 0.5 ? 1 : 2;
    if (rng() < 0.62) g.fillRect(xx, y, bw, h);
    xx += bw + 1;
  }
}

// the paper's own grain on a cell: a few strokes of the pencil over all of it
function grain(g, w, h, rng, a = 0.08) {
  g.strokeStyle = `rgba(30,20,40,${a})`;
  g.lineWidth = 1;
  for (let i = 0; i < (w * h) / 900; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const l = 6 + rng() * 14;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + l, y - l * 0.35);
    g.stroke();
  }
}

// ------------------------------------------------------------------ the kinds of label
// a label round a can, a bottle or a jar: [name, field, band, letters, drawing]; the front of it is
// the middle of the cell (the seam at the back)
function wrapLabel(b, o = {}) {
  return (g, w, h, rng) => {
    const [name, field, band, letters, pic] = b;
    g.fillStyle = field;
    g.fillRect(0, 0, w, h);
    // the band across it, a thin rule either side
    const by = h * (o.bandY || 0.68);
    g.fillStyle = band;
    g.fillRect(0, by, w, h * 0.2);
    g.fillStyle = INK;
    g.fillRect(0, by - 2, w, 2);
    g.fillRect(0, by + h * 0.2, w, 2);
    // a darker strip top and bottom (the rims' shadow)
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, 0, w, 3);
    g.fillRect(0, h - 3, w, 3);
    // the drawing to the left of the front, the name across the front
    if (pic) drawing(g, pic, w * 0.32, h * 0.42, h * 0.22, rng, band);
    title(g, name, w * 0.56, h * 0.4, w * 0.36, h * 0.26, letters, { edge: o.edge });
    print(g, w * 0.5 - w * 0.12, by + h * 0.07, w * 0.24, 2, 'rgba(30,25,35,0.6)', 5, rng);
    // the back: the small print and the code
    print(g, w * 0.86, h * 0.2, w * 0.1, 6, 'rgba(30,25,35,0.45)', 6, rng);
    print(g, w * 0.03, h * 0.2, w * 0.08, 6, 'rgba(30,25,35,0.45)', 6, rng);
    barcode(g, w * 0.88, h * 0.62, w * 0.09, h * 0.22, rng);
    if (o.burst) burst(g, w * 0.78, h * 0.32, h * 0.18, o.burst[0], o.burst[1], rng);
    grain(g, w, h, rng);
  };
}

// the front of a box: [name, field, band, letters, drawing]
function boxFront(b, o = {}) {
  return (g, w, h, rng) => {
    const [name, field, band, letters, pic] = b;
    g.fillStyle = field;
    g.fillRect(0, 0, w, h);
    // a panel of the band's colour at the top, the name on it
    g.fillStyle = band;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(w, 0);
    g.lineTo(w, h * 0.3);
    g.quadraticCurveTo(w * 0.5, h * 0.4, 0, h * 0.3);
    g.closePath();
    g.fill();
    hand(g, [[0, h * 0.3], [w * 0.25, h * 0.345], [w * 0.5, h * 0.35], [w * 0.75, h * 0.345], [w, h * 0.3]], INK, 2, rng);
    title(g, name, w / 2, h * 0.16, w * 0.88, w * 0.2, letters);
    // the big drawing in the middle, on a lighter round
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.ellipse(w / 2, h * 0.62, w * 0.36, h * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    if (pic) drawing(g, pic, w / 2, h * 0.62, w * 0.2, rng, band);
    if (o.burst) burst(g, w * 0.78, h * 0.44, w * 0.14, o.burst[0], o.burst[1], rng);
    // the weight, the line along the bottom
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, h * 0.9, w, h * 0.1);
    print(g, w * 0.08, h * 0.94, w * 0.3, 1, 'rgba(255,255,255,0.8)', 5, rng);
    grain(g, w, h, rng);
  };
}

// the side of a box: what is in it, in a table
function boxSide(field) {
  return (g, w, h, rng) => {
    g.fillStyle = field;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.fillRect(w * 0.12, h * 0.12, w * 0.76, h * 0.5);
    g.strokeStyle = INK;
    g.lineWidth = 1.5;
    g.strokeRect(w * 0.12, h * 0.12, w * 0.76, h * 0.5);
    print(g, w * 0.18, h * 0.18, w * 0.62, 18, 'rgba(30,25,35,0.6)', 6.5, rng);
    barcode(g, w * 0.16, h * 0.72, w * 0.68, h * 0.12, rng);
    grain(g, w, h, rng);
  };
}

// a bag (chips, coffee, flour): the crimp across the top and the bottom, the name, the window
function bagFront(b, o = {}) {
  return (g, w, h, rng) => {
    const [name, field, band, letters, pic] = b;
    g.fillStyle = field;
    g.fillRect(0, 0, w, h);
    // the crimped seals
    for (const y0 of [0, h - h * 0.07]) {
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(0, y0, w, h * 0.07);
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = 1;
      for (let x = 2; x < w; x += 5) {
        g.beginPath();
        g.moveTo(x, y0 + 1);
        g.lineTo(x, y0 + h * 0.07 - 1);
        g.stroke();
      }
    }
    // a slanting band with the name on it
    g.save();
    g.translate(w / 2, h * 0.3);
    g.rotate(-0.12);
    g.fillStyle = band;
    g.fillRect(-w * 0.7, -h * 0.09, w * 1.4, h * 0.18);
    g.fillStyle = INK;
    g.fillRect(-w * 0.7, -h * 0.09 - 2, w * 1.4, 2);
    g.fillRect(-w * 0.7, h * 0.09, w * 1.4, 2);
    g.restore();
    title(g, name, w / 2, h * 0.3, w * 0.86, w * 0.17, letters, { rot: -0.12 });
    if (pic) drawing(g, pic, w / 2, h * 0.62, w * 0.22, rng, band);
    if (o.burst) burst(g, w * 0.8, h * 0.78, w * 0.12, o.burst[0], o.burst[1], rng);
    // the shine of the foil, two pale strokes
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(w * 0.12, h * 0.15);
    g.lineTo(w * 0.05, h * 0.85);
    g.stroke();
    grain(g, w, h, rng, 0.06);
  };
}

// a carton (milk, juice): the drawing big, the name down it
function cartonFront(b) {
  return (g, w, h, rng) => {
    const [name, field, band, letters, pic] = b;
    g.fillStyle = field;
    g.fillRect(0, 0, w, h);
    g.fillStyle = band;
    g.fillRect(0, h * 0.05, w, h * 0.16);
    g.fillRect(0, h * 0.86, w, h * 0.06);
    hand(g, [[0, h * 0.21], [w, h * 0.21]], INK, 1.8, rng);
    title(g, name.split(' ')[0], w / 2, h * 0.13, w * 0.9, w * 0.22, field === '#f7f7f3' ? '#ffffff' : letters);
    if (name.split(' ')[1]) title(g, name.split(' ')[1], w / 2, h * 0.3, w * 0.8, w * 0.16, band === '#ffffff' ? INK : band, { edge: false, wt: 700 });
    if (pic) drawing(g, pic, w / 2, h * 0.56, w * 0.3, rng, band);
    print(g, w * 0.15, h * 0.76, w * 0.7, 3, 'rgba(30,25,35,0.55)', 5, rng);
    grain(g, w, h, rng);
  };
}

// a wrapper at the till: the name long across it
function wrapper(b) {
  return (g, w, h, rng) => {
    const [name, field, band, letters] = b;
    g.fillStyle = field;
    g.fillRect(0, 0, w, h);
    g.fillStyle = band;
    g.fillRect(0, 0, w * 0.12, h);
    g.fillRect(w * 0.88, 0, w * 0.12, h);
    for (const x of [w * 0.12, w * 0.88]) hand(g, [[x, 0], [x, h]], INK, 1.4, rng);
    title(g, name, w / 2, h / 2, w * 0.7, h * 0.56, letters);
  };
}

// the strip along a shelf's edge: a ticket for every product, the price big
function priceStrip(col) {
  return (g, w, h, rng) => {
    g.fillStyle = col;
    g.fillRect(0, 0, w, h);
    let x = 4;
    while (x < w - 50) {
      const tw = 46 + Math.floor(rng() * 16);
      g.fillStyle = '#ffffff';
      g.fillRect(x, 3, tw, h - 6);
      g.strokeStyle = 'rgba(30,25,35,0.6)';
      g.lineWidth = 1;
      g.strokeRect(x, 3, tw, h - 6);
      const p = `${Math.floor(1 + rng() * 6)}.${['19', '29', '49', '79', '99', '09'][Math.floor(rng() * 6)]}`;
      g.fillStyle = '#c42a22';
      g.font = font(17, 'Rubik', 800);
      g.textBaseline = 'middle';
      g.fillText(p, x + 4, h / 2 + 1);
      print(g, x + 4, 7, tw * 0.5, 1, 'rgba(30,25,35,0.6)', 4, rng);
      g.fillStyle = INK;
      g.fillRect(x + tw - 10, h - 9, 6, 4);
      x += tw + 6 + Math.floor(rng() * 20);
    }
  };
}

// the sign over an aisle or over the fridges
function header(text, field, letters, o = {}) {
  return (g, w, h, rng) => {
    g.fillStyle = field;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(0, 0, w, h * 0.35);
    hand(g, [[3, 3], [w - 3, 3], [w - 3, h - 3], [3, h - 3], [3, 3]], INK, 2.5, rng);
    title(g, text, w / 2, h * 0.52, w * 0.86, h * 0.56, letters, { fam: o.fam || 'Rubik' });
    if (o.pic) {
      drawing(g, o.pic, h * 0.55, h * 0.5, h * 0.3, rng);
      drawing(g, o.pic, w - h * 0.55, h * 0.5, h * 0.3, rng);
    }
  };
}

// a poster on the wall: the brand's ad
function poster(b, line) {
  return (g, w, h, rng) => {
    const [name, field, band, letters, pic] = b;
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, band);
    grd.addColorStop(1, field);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    // big drawing, a sun of rays behind it
    g.strokeStyle = 'rgba(255,255,255,0.3)';
    g.lineWidth = 8;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(w / 2, h * 0.42);
      g.lineTo(w / 2 + Math.cos(a) * w, h * 0.42 + Math.sin(a) * w);
      g.stroke();
    }
    if (pic) drawing(g, pic, w / 2, h * 0.42, w * 0.26, rng, band);
    title(g, name, w / 2, h * 0.12, w * 0.86, w * 0.17, letters);
    title(g, line, w / 2, h * 0.78, w * 0.86, w * 0.1, '#ffffff', { fam: 'Caveat', wt: 700 });
    hand(g, [[2, 2], [w - 2, 2], [w - 2, h - 2], [2, h - 2], [2, 2]], INK, 3, rng);
    grain(g, w, h, rng, 0.1);
  };
}

function paper(name, head) {
  return (g, w, h, rng) => {
    g.fillStyle = '#f1ece0';
    g.fillRect(0, 0, w, h);
    g.fillStyle = INK;
    g.font = '700 24px "Cinzel", Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const m = g.measureText(name).width;
    g.save();
    g.translate(w / 2, h * 0.13);
    g.scale(Math.min(1, (w * 0.92) / m), 1);
    g.fillText(name, 0, 0);
    g.restore();
    g.fillRect(6, h * 0.24, w - 12, 2);
    g.font = font(15, 'Rubik', 800);
    g.textAlign = 'left';
    g.fillText(head, 8, h * 0.33);
    g.fillStyle = '#9a9a96';
    g.fillRect(8, h * 0.42, w * 0.42, h * 0.4);
    hatch(g, () => {
      g.beginPath();
      g.rect(8, h * 0.42, w * 0.42, h * 0.4);
    }, 'rgba(20,20,20,0.5)', 4, 0.7);
    print(g, w * 0.5, h * 0.44, w * 0.44, 9, 'rgba(30,25,35,0.6)', 6, rng);
    print(g, 8, h * 0.88, w * 0.9, 2, 'rgba(30,25,35,0.6)', 6, rng);
  };
}

function card(text, sub, col = '#ffffff', ink = INK) {
  return (g, w, h, rng) => {
    g.fillStyle = col;
    g.fillRect(0, 0, w, h);
    hand(g, [[3, 3], [w - 3, 3], [w - 3, h - 3], [3, h - 3], [3, 3]], ink, 2, rng);
    title(g, text, w / 2, h * 0.36, w * 0.86, h * 0.34, ink, { edge: false, fam: 'Caveat', wt: 700 });
    if (sub) title(g, sub, w / 2, h * 0.72, w * 0.8, h * 0.32, '#c42a22', { edge: false, fam: 'Rubik', wt: 800 });
  };
}

// ------------------------------------------------------------------ every cell, by name
function defineAll(A) {
  const place = (name, kind, draw) => A.place(name, KIND[kind][0], KIND[kind][1], draw);
  BRANDS.soda.forEach((b, i) => {
    place(`can.soda${i}`, 'can', wrapLabel(b, { bandY: 0.66 }));
    place(`bottle.soda${i}`, 'bottle', wrapLabel(b, { bandY: 0.72 }));
  });
  BRANDS.water.forEach((b, i) => place(`bottle.water${i}`, 'bottle', wrapLabel(b, { bandY: 0.7 })));
  BRANDS.energy.forEach((b, i) => place(`can.energy${i}`, 'can', wrapLabel(b, { edge: '#000000' })));
  BRANDS.juice.forEach((b, i) => {
    place(`bottle.juice${i}`, 'bottle', wrapLabel(b));
    place(`carton.juice${i}`, 'carton', cartonFront(b));
  });
  BRANDS.milk.forEach((b, i) => place(`carton.milk${i}`, 'carton', cartonFront(b)));
  BRANDS.tins.forEach((b, i) => place(`can.tin${i}`, 'can', wrapLabel(b, { burst: i === 2 ? ['#d22e2a', 'NEW'] : null })));
  BRANDS.jars.forEach((b, i) => place(`jar.${i}`, 'jar', wrapLabel(b, { bandY: 0.7 })));
  BRANDS.sauce.forEach((b, i) => place(`bottle.sauce${i}`, 'bottle', wrapLabel(b)));
  BRANDS.cereal.forEach((b, i) => place(`box.cereal${i}`, 'box', boxFront(b, { burst: i === 1 ? ['#d22e2a', 'NEW'] : null })));
  BRANDS.boxes.forEach((b, i) => place(`box.dry${i}`, 'box', boxFront(b)));
  place('side.light', 'side', boxSide('#f2ead8'));
  place('side.dark', 'side', boxSide('#c9b48a'));
  BRANDS.tea.forEach((b, i) => place(`small.${i}`, 'small', boxFront(b)));
  BRANDS.meds.forEach((b, i) => place(`small.med${i}`, 'small', boxFront(b)));
  BRANDS.chips.forEach((b, i) => place(`bag.chips${i}`, 'bag', bagFront(b, { burst: i === 0 ? ['#2f6cc2', '2 FOR 1'] : null })));
  BRANDS.bags.forEach((b, i) => place(`bag.dry${i}`, 'bag', bagFront(b)));
  BRANDS.bread.forEach((b, i) => place(`bag.bread${i}`, 'bag', bagFront(b)));
  BRANDS.clean.forEach((b, i) => place(`jug.${i}`, 'jug', cartonFront(b)));
  BRANDS.candy.forEach((b, i) => place(`candy.${i}`, 'candy', wrapper(b)));
  place('strip.yellow', 'strip', priceStrip('#f4e04a'));
  place('strip.white', 'strip', priceStrip('#f4f2ec'));
  const HEAD = [
    ['head.drinks', 'ICE COLD DRINKS', '#2b6fc4', '#ffffff', 'wave'],
    ['head.dairy', 'MILK  •  DAIRY  •  JUICE', '#f4f2ec', '#2b6fc4', null],
    ['head.snacks', 'SNACKS  •  CHIPS  •  CANDY', '#d93a2b', '#ffffff', null],
    ['head.pantry', 'PANTRY  •  CANS  •  PASTA', '#2f8a4c', '#ffffff', null],
    ['head.breakfast', 'BREAKFAST  •  COFFEE  •  TEA', '#e9a21f', '#ffffff', null],
    ['head.home', 'HOME  •  CLEANING', '#6a4fb0', '#ffffff', null],
    ['head.fresh', 'FRESH  PRODUCE', '#3f8a2f', '#fff3c2', 'apple'],
    ['head.bakery', 'BAKERY', '#b8742e', '#fff3d8', 'wheat'],
  ];
  for (const [n, t, f, l, p] of HEAD) place(n, 'header', header(t, f, l, { pic: p }));
  place('poster.0', 'poster', poster(BRANDS.soda[0], 'Draw the Fizz!'));
  place('poster.1', 'poster', poster(BRANDS.chips[0], 'Crunch every line'));
  place('poster.2', 'poster', poster(BRANDS.juice[0], 'Fresh every morning'));
  place('poster.3', 'poster', poster(BRANDS.cereal[0], 'A bowl of good mornings'));
  place('paper.0', 'paper', paper('THE DAILY SCRIBBLE', 'CITY DRAWS A CROWD'));
  place('paper.1', 'paper', paper('BAYLINE TIMES', 'SUNSET HITS RECORD'));
  const CARDS = [['Apples', '2 for $1'], ['Oranges', '$0.79 ea'], ['Bananas', '$0.59 lb'], ['Lemons', '3 for $1'], ['Tomatoes', '$1.49 lb'], ['Avocados', '$1.29 ea'], ['Onions', '$0.99 lb'], ['Limes', '4 for $1'], ['Peppers', '$1.19 ea'], ['Pears', '$0.89 ea']];
  CARDS.forEach(([a, b], i) => place(`card.${i}`, 'card', card(a, b)));
  place('card.special', 'card', card('Special!', 'Today only', '#ffe14f'));
  // (the till's screen, the reader's keys and screen, the scanner's glass, the doors' signs)
  A.place('ui.till', 176, 132, (g, w, h, rng) => {
    g.fillStyle = '#123f6e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f6fb0';
    g.fillRect(0, 0, w, 18);
    g.fillStyle = '#ffffff';
    g.font = font(12, 'Rubik', 700);
    g.textBaseline = 'middle';
    g.fillText('BAY GROCERY  #2', 6, 9);
    const items = ['FIZZLE 0.5L', 'CRUNCHLINES', 'MARGIN MILK', 'DOODLE-OS', 'APPLES x2'];
    items.forEach((t, i) => {
      g.fillStyle = i % 2 ? '#174b80' : '#123f6e';
      g.fillRect(0, 22 + i * 16, w, 16);
      g.fillStyle = '#e8f2ff';
      g.font = font(11, 'Rubik', 500);
      g.fillText(t, 6, 30 + i * 16);
      g.fillText(`${(1 + rng() * 4).toFixed(2)}`, w - 40, 30 + i * 16);
    });
    g.fillStyle = '#f4e04a';
    g.fillRect(0, h - 24, w, 24);
    g.fillStyle = '#123f6e';
    g.font = font(15, 'Rubik', 800);
    g.fillText('TOTAL  14.36', 8, h - 12);
  });
  A.place('ui.keys', 96, 96, (g, w, h) => {
    g.fillStyle = '#2a2a30';
    g.fillRect(0, 0, w, h);
    const cols = ['#e8e6e0', '#e8e6e0', '#e8e6e0', '#f4c43a', '#e8e6e0', '#e8e6e0', '#e8e6e0', '#d84a3a', '#e8e6e0', '#e8e6e0', '#e8e6e0', '#3aa05a'];
    for (let i = 0; i < 12; i++) {
      const x = 6 + (i % 3) * 30;
      const y = 6 + Math.floor(i / 3) * 22;
      g.fillStyle = cols[i];
      g.fillRect(x, y, 26, 18);
      g.strokeStyle = '#111';
      g.strokeRect(x, y, 26, 18);
      g.fillStyle = '#222';
      g.font = font(11, 'Rubik', 700);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String((i + 1) % 10), x + 13, y + 9);
    }
  });
  A.place('ui.reader', 64, 96, (g, w, h) => {
    g.fillStyle = '#1e1e22';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#7fe0a4';
    g.fillRect(6, 6, w - 12, 26);
    g.fillStyle = '#123';
    g.font = font(10, 'Rubik', 700);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('TAP CARD', w / 2, 19);
    for (let i = 0; i < 12; i++) {
      g.fillStyle = i === 9 ? '#d84a3a' : i === 11 ? '#3aa05a' : '#cfcfcf';
      g.fillRect(8 + (i % 3) * 17, 38 + Math.floor(i / 3) * 14, 14, 11);
    }
  });
  A.place('ui.scanner', 128, 64, (g, w, h) => {
    g.fillStyle = '#20242a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ff3a2a';
    g.lineWidth = 2;
    for (const [a, b] of [[[10, 8], [118, 56]], [[10, 56], [118, 8]], [[64, 4], [64, 60]]]) {
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
    }
    g.strokeStyle = 'rgba(200,220,255,0.35)';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(20, 60);
    g.lineTo(50, 4);
    g.stroke();
  });
  A.place('sign.staff', 192, 56, (g, w, h, rng) => {
    g.fillStyle = '#f4f2ec';
    g.fillRect(0, 0, w, h);
    hand(g, [[3, 3], [w - 3, 3], [w - 3, h - 3], [3, h - 3], [3, 3]], INK, 2, rng);
    title(g, 'STAFF ONLY', w / 2, h / 2, w * 0.86, h * 0.5, '#c42a22', { edge: false });
  });
  A.place('sign.open', 192, 72, (g, w, h, rng) => {
    g.fillStyle = '#16141c';
    g.fillRect(0, 0, w, h);
    title(g, 'OPEN', w / 2, h * 0.5, w * 0.8, h * 0.66, '#ff4fa0', { edge: '#ffd0e8', fam: 'Permanent Marker', wt: 400 });
    void rng;
  });
  A.place('sign.hours', 128, 160, (g, w, h, rng) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    title(g, 'HOURS', w / 2, 18, w * 0.8, 20, INK, { edge: false });
    print(g, 12, 42, w - 24, 7, 'rgba(30,25,35,0.7)', 14, rng);
    hand(g, [[3, 3], [w - 3, 3], [w - 3, h - 3], [3, h - 3], [3, 3]], INK, 2, rng);
  });
  A.place('mat.welcome', 256, 112, (g, w, h, rng) => {
    g.fillStyle = '#2c2a30';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let y = 4; y < h; y += 4) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    title(g, 'WELCOME', w / 2, h / 2, w * 0.8, h * 0.4, '#d9d2c2', { edge: false });
    void rng;
  });
  A.place('clock', 128, 128, (g, w, h, rng) => {
    g.fillStyle = '#f7f4ec';
    g.fillRect(0, 0, w, h);
    ring(g, w / 2, h / 2, w * 0.46, INK, 4, rng);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      hand(g, [[w / 2 + Math.cos(a) * w * 0.36, h / 2 + Math.sin(a) * w * 0.36], [w / 2 + Math.cos(a) * w * 0.42, h / 2 + Math.sin(a) * w * 0.42]], INK, 3, rng);
    }
    hand(g, [[w / 2, h / 2], [w / 2 + w * 0.2, h / 2 - w * 0.12]], INK, 4, rng);
    hand(g, [[w / 2, h / 2], [w / 2 - w * 0.05, h / 2 - w * 0.34]], INK, 3, rng);
  });
  // (v5, 13.13: a clothes shop's - the signs over its bays, its bag, the tags, the patterns of cloth)
  for (const [n, t, f, l] of [['head.new', 'NEW SEASON', '#1e1e22', '#f4efe6'], ['head.denim', 'DENIM', '#2a4a78', '#f4efe6'], ['head.knit', 'KNITWEAR', '#6a3a2a', '#f4e7d2'], ['head.shoes', 'SHOES', '#1e1e22', '#e9c46a'], ['head.sale', 'SALE  30% OFF', '#c42a22', '#ffffff'], ['head.fit', 'FITTING ROOMS', '#2a2a30', '#f4efe6']]) {
    place(n, 'header', header(t, f, l, { fam: 'Cinzel' }));
  }
  A.place('bag.chic', 160, 184, (g, w, h, rng) => {
    g.fillStyle = '#f2ece2';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#1e1e22';
    g.lineWidth = 3;
    g.strokeRect(10, 10, w - 20, h - 20);
    title(g, 'Linen & Ink', w / 2, h * 0.45, w * 0.8, 26, '#1e1e22', { edge: false, fam: 'Cinzel', wt: 600 });
    title(g, 'thank you', w / 2, h * 0.66, w * 0.7, 20, '#8a6a3a', { edge: false, fam: 'Caveat', wt: 700 });
    void rng;
  });
  A.place('tag.price', 48, 72, (g, w, h, rng) => {
    g.fillStyle = '#f7f2e6';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1e1e22';
    g.beginPath();
    g.arc(w / 2, 8, 3, 0, Math.PI * 2);
    g.fill();
    title(g, '$49', w / 2, h * 0.5, w * 0.8, 16, '#1e1e22', { edge: false });
    print(g, 8, h * 0.72, w - 16, 2, 'rgba(30,25,35,0.6)', 5, rng);
  });
  A.place('cloth.stripe', 96, 128, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(20,24,40,0.85)';
    for (let x = 0; x < w; x += 12) g.fillRect(x, 0, 4, h);
  });
  A.place('cloth.check', 96, 128, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(30,20,20,0.35)';
    for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 7, h);
    for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 7);
    g.fillStyle = 'rgba(30,20,20,0.25)';
    for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) g.fillRect(x, y, 7, 7);
  });
  // (v5, 13.13: an electronics shop's - what is on its screens, the cards by its phones, its signs)
  const pic = (g, w, h, k, rng) => {
    // a picture on a screen: a sunset over the sea, mountains under stars, the city's towers, a
    // phone's grid of apps
    if (k === 3) {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#2a3a8a');
      grd.addColorStop(1, '#a03a8a');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      const cs = ['#f4c43a', '#3aa05a', '#e05a4a', '#4a9ae0', '#ffffff', '#f07a2a'];
      const n = 4;
      const cw = w / (n + 1);
      for (let i = 0; i < n * 5; i++) {
        const x = cw * (0.6 + (i % n));
        const y = h * 0.12 + Math.floor(i / n) * cw * 1.15;
        if (y > h - cw) break;
        g.fillStyle = cs[i % cs.length];
        g.fillRect(x, y, cw * 0.7, cw * 0.7);
      }
      return;
    }
    const sky = [['#f6c06a', '#e0567a', '#5a3a8a'], ['#0e1a3a', '#2a3a6a', '#4a5a9a'], ['#9ad0f0', '#d8eef8', '#ffffff']][k % 3];
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, sky[2]);
    grd.addColorStop(0.6, sky[1]);
    grd.addColorStop(1, sky[0]);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    if (k % 3 === 0) {
      g.fillStyle = '#ffd25a';
      g.beginPath();
      g.arc(w * 0.62, h * 0.55, h * 0.14, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2a4a8a';
      g.fillRect(0, h * 0.62, w, h * 0.38);
      g.strokeStyle = 'rgba(255,220,140,0.7)';
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(w * 0.5, h * (0.66 + i * 0.05));
        g.lineTo(w * 0.74, h * (0.66 + i * 0.05));
        g.stroke();
      }
    } else if (k % 3 === 1) {
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 30; i++) g.fillRect(rng() * w, rng() * h * 0.5, 1.5, 1.5);
      g.fillStyle = '#1a2440';
      g.beginPath();
      g.moveTo(0, h);
      g.lineTo(w * 0.3, h * 0.45);
      g.lineTo(w * 0.5, h * 0.7);
      g.lineTo(w * 0.72, h * 0.38);
      g.lineTo(w, h);
      g.fill();
    } else {
      g.fillStyle = '#5a6a8a';
      for (let i = 0; i < 9; i++) {
        const bw = w * (0.06 + rng() * 0.06);
        const bh = h * (0.25 + rng() * 0.5);
        g.fillRect((i / 9) * w, h - bh, bw, bh);
      }
    }
  };
  for (let k = 0; k < 4; k++) A.place(`ui.phone${k}`, 64, 128, (g, w, h, rng) => pic(g, w, h, k, rng));
  for (let k = 0; k < 3; k++) A.place(`ui.tv${k}`, 224, 128, (g, w, h, rng) => pic(g, w, h, k, rng));
  for (let k = 0; k < 3; k++) A.place(`ui.laptop${k}`, 160, 104, (g, w, h, rng) => pic(g, w, h, (k + 1) % 4, rng));
  A.place('card.spec', 96, 72, (g, w, h, rng) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    title(g, 'NIB 12', w / 2, 14, w * 0.8, 14, INK, { edge: false });
    print(g, 8, 30, w - 16, 4, 'rgba(30,25,35,0.6)', 7, rng);
    title(g, '$599', w / 2, h - 12, w * 0.6, 14, '#c42a22', { edge: false });
  });
  A.place('box.laptop', 128, 96, (g, w, h, rng) => {
    g.fillStyle = '#f4f4f2';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8ccd4';
    g.fillRect(w * 0.18, h * 0.22, w * 0.64, h * 0.42);
    pic(g, w * 0.6, h * 0.36, 0, rng);
    title(g, 'FOLIO AIR', w / 2, h * 0.82, w * 0.8, 14, INK, { edge: false });
  });
  for (const [n, t, f, l] of [['head.tv', 'TV  &  CINEMA', '#1e1e22', '#f4efe6'], ['head.laptops', 'LAPTOPS', '#1e1e22', '#9ad0f0'], ['head.sound', 'SOUND', '#1e1e22', '#f4c43a'], ['head.jewels', 'FINE JEWELLERY', '#1a2238', '#e8cf8a']]) place(n, 'header', header(t, f, l));
  // (the paper bag a market gives you, the cardboard box the stock comes in)
  A.place('bag.thanks', 160, 184, (g, w, h, rng) => {
    g.fillStyle = '#c9a274';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,60,30,0.35)';
    for (let i = 0; i < 40; i++) {
      const y = rng() * h;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y + (rng() - 0.5) * 6);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(0, 0, w, 14);
    ring(g, w / 2, h * 0.46, w * 0.28, '#3a6e3a', 3, rng);
    drawing(g, 'apple', w / 2, h * 0.46, w * 0.14, rng);
    title(g, 'THANK YOU', w / 2, h * 0.8, w * 0.8, 20, '#3a6e3a', { edge: false, fam: 'Caveat', wt: 700 });
  });
  A.place('box.stock', 224, 152, (g, w, h, rng) => {
    g.fillStyle = '#c8a26e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e6d6b4';
    g.fillRect(w * 0.44, 0, w * 0.12, h);
    hand(g, [[w * 0.44, 0], [w * 0.44, h]], 'rgba(80,50,20,0.6)', 1.4, rng);
    hand(g, [[w * 0.56, 0], [w * 0.56, h]], 'rgba(80,50,20,0.6)', 1.4, rng);
    title(g, 'FIZZLE', w * 0.22, h * 0.32, w * 0.38, 22, '#a8202a', { edge: false });
    print(g, w * 0.06, h * 0.55, w * 0.3, 3, 'rgba(60,40,20,0.7)', 7, rng);
    // (this side up: two arrows)
    for (const x of [w * 0.7, w * 0.82]) hand(g, [[x, h * 0.7], [x, h * 0.3], [x - 8, h * 0.4], [x, h * 0.3], [x + 8, h * 0.4]], '#2a2016', 2.4, rng);
    title(g, '24 x 0.5L', w * 0.76, h * 0.86, w * 0.4, 14, '#2a2016', { edge: false, wt: 700 });
  });
  // (the crates' slats, the baskets' grid, the shelving's slotted uprights)
  A.place('tex.crate', 128, 128, (g, w, h, rng) => {
    g.fillStyle = '#b58a5a';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const y = i * 32;
      g.fillStyle = i % 2 ? '#c99a66' : '#bd8f5c';
      g.fillRect(0, y + 2, w, 26);
      g.strokeStyle = 'rgba(70,40,20,0.5)';
      g.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.moveTo(0, y + 6 + k * 4 + rng() * 2);
        g.bezierCurveTo(w * 0.3, y + 4 + k * 4, w * 0.6, y + 8 + k * 4, w, y + 6 + k * 4 + rng() * 2);
        g.stroke();
      }
      g.fillStyle = '#3a2412';
      g.fillRect(0, y + 28, w, 4);
      g.fillRect(8, y + 12, 3, 3);
      g.fillRect(w - 11, y + 12, 3, 3);
    }
  });
  A.place('tex.basket', 128, 64, (g, w, h) => {
    g.fillStyle = '#d32a2e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a0e12';
    for (let y = 8; y < h - 6; y += 10) for (let x = 6; x < w - 4; x += 10) g.fillRect(x, y, 6, 6);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(0, 0, w, 4);
  });
  A.place('tex.upright', 32, 256, (g, w, h) => {
    g.fillStyle = '#5a5c64';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#16161a';
    for (let y = 4; y < h; y += 10) g.fillRect(w / 2 - 3, y, 6, 5);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(2, 0, 3, h);
  });
}
