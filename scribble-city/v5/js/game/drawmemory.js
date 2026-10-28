import { look, picture, ready } from './sketchnet.js';

// (v5, ROADMAP 11.37) What the pen remembers of the way you draw. When the drawing is read as the
// wrong thing and you pick what it is (a chip under its name), and make it, the drawing's look is
// kept with what you picked: how the network sees it (its chances of every kind it knows), the
// small picture it sees (16 x 16) and its shape (how long for how high). A drawing that looks like
// one of those again is read as what you picked then, at once - your rocket launcher, the way you draw it, is a rocket launcher from then
// on. Kept in this browser; at most 80, the oldest let go.

const KEY = 'scribble-city-v5-drawmemory';
const MAX = 80;
const H = 16;

function cos(a, b) {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    ab += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa > 0 && bb > 0 ? ab / Math.sqrt(aa * bb) : 0;
}

export class DrawMemory {
  constructor() {
    this.list = [];
    this.stats = { learned: 0, used: 0 };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.list = JSON.parse(raw).filter((m) => m && m.key && m.p && m.pic);
    } catch (e) {
      this.list = [];
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.list));
    } catch (e) {
      // (no storage: remembered until the page closes)
    }
  }

  // how the drawing looks (strokes: [{ p: [[x, y], ...], raw? }]): the network's chances, its
  // picture at half size, and how long it is for its height
  signature(strokes) {
    const S = strokes.map((s) => s.raw || s.p).filter((p) => p && p.length > 1);
    if (!S.length) return null;
    // (how long it is for how high: a rifle and a rocket launcher look alike to the network, and
    // their pictures much alike, but one is twice as long for its height)
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const s of S) {
      for (const [x, y] of s) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
    const a = Math.log(Math.max(x1 - x0, 1e-3) / Math.max(y1 - y0, 1e-3));
    const net = look(S);
    const img = picture(ready(S));
    const G = Math.round(Math.sqrt(img.length));
    const pic = new Array(H * H).fill(0);
    const k = G / H;
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) pic[Math.floor(y / k) * H + Math.floor(x / k)] += img[y * G + x] / (k * k);
    return { p: Array.from(net.p, (v) => Math.round(v * 1000) / 1000), pic: pic.map((v) => Math.round(v * 100) / 100), a: Math.round(a * 1000) / 1000 };
  }

  // the remembered drawing most like this one, if it is like enough: { key, sim }
  match(sig) {
    if (!sig || !this.list.length) return null;
    let best = null;
    for (const m of this.list) {
      // (seen by the network as much the same - it may waver between two kinds the same way)
      const cp = cos(sig.p, m.p);
      if (cp < 0.5) continue;
      // (as long for its height, give or take 40%)
      if (sig.a !== undefined && m.a !== undefined && Math.abs(sig.a - m.a) > 0.34) continue;
      // (and its picture much the same: what tells your launcher from a rifle)
      const ci = cos(sig.pic, m.pic);
      if (ci < 0.85) continue;
      const sim = cp * 0.6 + ci * 0.4;
      if (!best || sim > best.sim) best = { key: m.key, sim };
    }
    return best;
  }

  // what you picked for it, kept
  learn(sig, key) {
    if (!sig || !key) return;
    // (the same drawing kept again: the newer pick wins)
    this.list = this.list.filter((m) => !(cos(sig.p, m.p) > 0.985 && cos(sig.pic, m.pic) > 0.95));
    this.list.push({ key, p: sig.p, pic: sig.pic, a: sig.a, t: Date.now() });
    if (this.list.length > MAX) this.list.splice(0, this.list.length - MAX);
    this.stats.learned++;
    this.save();
  }
}
