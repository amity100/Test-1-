// (v5, ROADMAP 12.5) The Draw-Off: Art Night's contest, on the stage in the Walls' yard. The MC
// calls out a thing; you have 25 seconds to draw it (the mouse, or a finger, on the paper), and
// three of Paintwood's artists draw it beside you, live, on their sheets. The judges are the
// network that knows what people draw (game/sketchnet.js): how sure it is that a drawing is the
// thing is its score, and a little more for the time left. While you draw it says what it sees.
// Three rounds; the points added up; the prize to the first three, a record kept.
//
// The artists' drawings are drawn the way people draw these things (a few lines each, a little
// off, now and then a part left out - the less skilled, the more), and judged by the same network:
// nobody's score is made up.

import { look, CLASSES, NAME_OF } from '../sketchnet.js';
import { INK, PAPER, PENS, HAND, MARKER, box, text, figure, cash } from './ink2d.js';

export const SUBJECTS = [
  { c: 'house', he: 'בית' },
  { c: 'tree', he: 'עץ' },
  { c: 'face', he: 'פרצוף' },
  { c: 'flower', he: 'פרח' },
  { c: 'cat', he: 'חתול' },
  { c: 'star', he: 'כוכב' },
  { c: 'cloud', he: 'ענן' },
  { c: 'fish', he: 'דג' },
  { c: 'sailboat', he: 'סירת מפרש' },
  { c: 'umbrella', he: 'מטרייה' },
  { c: 'hot air balloon', he: 'כדור פורח' },
  { c: 'key', he: 'מפתח' },
  { c: 'ladder', he: 'סולם' },
  { c: 'car', he: 'מכונית' },
  { c: 'airplane', he: 'מטוס' },
  { c: 'bicycle', he: 'אופניים' },
  { c: 'helicopter', he: 'מסוק' },
];
const HE = Object.fromEntries(SUBJECTS.map((s) => [s.c, s.he]));
export const heName = (c) => HE[c] || NAME_OF(c) || c;
// (what the judges count as the thing: a car is a car whether they see a van or a police car in it)
const FAMILY = { car: ['car', 'police car', 'pickup truck', 'van'], sailboat: ['sailboat', 'speedboat', 'canoe'] };

const RIVALS = [
  { name: 'LOLA BRUSH', skill: 0.82, pace: 12, oops: 0.05, shirt: PENS.pink, hair: '#2a1a12', skin: '#c98e62' },
  { name: 'KID MARKER', skill: 0.4, pace: 8.5, oops: 0.22, shirt: PENS.yellow, hair: '#e8b04a', skin: '#f0c49c' },
  { name: 'MR. PASTEL', skill: 0.66, pace: 18, oops: 0.08, shirt: PENS.cyan, hair: '#d8d8d8', skin: '#e2b48c' },
];
const ROUNDS = 3;
const TIME = 25;
const STORE = 'scribble-city-v5-drawoff';
const PRIZE = [60, 25, 10];
// the paper, in the game's measure (1000 x 600)
const PX = 30;
const PY = 118;
const PW = 560;
const PH = 424;
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ the things, drawn by hand
// (a box 100 across, y down, as on paper)
function seg(x0, y0, x1, y1, n = 6) {
  const o = [];
  for (let i = 0; i <= n; i++) o.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  return o;
}
function arc(cx, cy, rx, ry, a0, a1, n = 16) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return o;
}
function path(...pts) {
  const o = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const s = seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 5);
    if (i) s.shift();
    o.push(...s);
  }
  return o;
}

export const DOODLES = {
  house: (r) => {
    const w = 52 + r() * 12;
    const x0 = 50 - w / 2;
    const y0 = 50 + r() * 6;
    const peak = y0 - 26 - r() * 8;
    const dx = 44 + (r() - 0.5) * 14;
    return [
      path([x0, y0], [x0, 92], [x0 + w, 92], [x0 + w, y0]),
      path([x0 - 6, y0 + 2], [50, peak], [x0 + w + 6, y0 + 2], [x0 - 6, y0 + 2]),
      path([dx, 92], [dx, 72], [dx + 12, 72], [dx + 12, 92]),
      path([x0 + 6, y0 + 8], [x0 + 18, y0 + 8], [x0 + 18, y0 + 19], [x0 + 6, y0 + 19], [x0 + 6, y0 + 8]),
    ];
  },
  tree: (r) => {
    const tw = 9 + r() * 4;
    const R = 27 + r() * 5;
    const crown = [];
    const ph = r() * 6;
    for (let i = 0; i <= 44; i++) {
      const a = (i / 44) * TAU;
      const k = 1 + 0.13 * Math.sin(a * 7 + ph);
      crown.push([50 + Math.cos(a) * R * k, 36 + Math.sin(a) * R * 0.88 * k]);
    }
    return [crown, seg(50 - tw / 2, 60, 50 - tw / 2, 97), seg(50 + tw / 2, 60, 50 + tw / 2, 97), seg(50 - tw / 2 - 6, 97, 50 + tw / 2 + 6, 97, 3)];
  },
  face: (r) => [
    arc(50, 50, 40 + r() * 4, 46, -Math.PI / 2, (3 * Math.PI) / 2, 36),
    arc(34, 38, 5, 6, 0, TAU, 10),
    arc(66, 38, 5, 6, 0, TAU, 10),
    path([50, 46], [46, 60], [52, 60]),
    arc(50, 64, 18, 11 + r() * 4, 0.25, Math.PI - 0.25, 12),
  ],
  flower: (r) => {
    const n = 5 + Math.floor(r() * 2);
    const st = [arc(50, 32, 8, 8, 0, TAU, 12)];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + r() * 0.3;
      st.push(arc(50 + Math.cos(a) * 17, 32 + Math.sin(a) * 17, 9, 9, a + Math.PI, a + Math.PI + TAU, 12));
    }
    st.push(seg(50, 42, 52, 99, 8));
    st.push(path([51, 76], [70, 62], [51, 70]));
    st.push(path([51, 88], [32, 76], [51, 82]));
    return st;
  },
  cat: (r) => [
    arc(50, 60, 34, 30, 0, TAU, 32),
    path([22, 44], [25, 12 + r() * 6], [41, 33]),
    path([59, 33], [75, 12 + r() * 6], [78, 44]),
    arc(38, 55, 4, 5, 0, TAU, 8),
    arc(62, 55, 4, 5, 0, TAU, 8),
    path([46, 65], [54, 65], [50, 70], [46, 65]),
    seg(32, 67, 4, 60, 3),
    seg(32, 71, 4, 74, 3),
    seg(68, 67, 96, 60, 3),
    seg(68, 71, 96, 74, 3),
  ],
  star: (r) => {
    const pts = [];
    const a0 = -Math.PI / 2 + (r() - 0.5) * 0.2;
    for (let i = 0; i <= 5; i++) {
      const a = a0 + (i * 2 * TAU) / 5;
      pts.push([50 + Math.cos(a) * 46, 54 + Math.sin(a) * 46]);
    }
    return [path(...pts)];
  },
  cloud: (r) => {
    // a bumpy line all the way round
    const pts = [];
    const n = 9 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const cx = 50 + Math.cos(a) * 34;
      const cy = 52 + Math.sin(a) * 18;
      pts.push(...arc(cx, cy, 11, 9, a - Math.PI / 2, a + Math.PI / 2, 7).slice(i ? 1 : 0));
    }
    pts.push(pts[0]);
    return [pts];
  },
  fish: (r) => [
    arc(42, 50, 32, 19 + r() * 4, 0, TAU, 30),
    path([73, 50], [95, 32], [95, 68], [73, 50]),
    arc(26, 45, 3, 3, 0, TAU, 6),
    arc(36, 50, 6, 12, -1.2, 1.2, 6),
  ],
  sailboat: (r) => [
    path([10, 70], [90, 70], [76, 86], [24, 86], [10, 70]),
    seg(50, 70, 50, 8, 8),
    path([52, 10], [84, 62], [52, 62]),
    path([48, 18], [20, 62], [48, 62]),
    path([4, 94], [16, 90], [28, 94], [40, 90], [52, 94], [64, 90], [76, 94], [88, 90], [98, 94]),
  ],
  umbrella: (r) => {
    const canopy = arc(50, 50, 46, 40 + r() * 4, Math.PI, TAU, 24);
    for (let i = 0; i < 4; i++) canopy.push(...arc(84.5 - i * 23, 50, 11.5, 6, 0, Math.PI, 8).slice(1));
    return [canopy, seg(50, 50, 50, 88, 6), arc(43, 88, 7, 7, 0, Math.PI, 8)];
  },
  'hot air balloon': (r) => [
    arc(50, 34, 30, 31, 0, TAU, 30),
    arc(50, 34, 11, 31, -Math.PI / 2, Math.PI / 2, 12),
    seg(29, 56, 40, 78, 3),
    seg(71, 56, 60, 78, 3),
    path([38, 78], [62, 78], [60, 95], [40, 95], [38, 78]),
  ],
  key: (r) => [
    arc(22, 50, 15, 15, 0, TAU, 20),
    path([37, 46], [93, 46], [93, 54], [37, 54]),
    path([70, 54], [70, 64], [76, 64], [76, 54]),
    path([82, 54], [82, 67], [88, 67], [88, 54]),
  ],
  ladder: (r) => {
    const s = [seg(32, 3, 32, 97, 10), seg(68, 3, 68, 97, 10)];
    for (let y = 13 + r() * 3; y < 96; y += 13) s.push(seg(32, y, 68, y, 4));
    return s;
  },
  car: (r) => [
    path([5, 66], [5, 50], [24, 47], [34, 28 + r() * 4], [68, 28], [80, 47], [95, 50], [95, 66], [5, 66]),
    arc(26, 68, 10, 10, 0, TAU, 16),
    arc(74, 68, 10, 10, 0, TAU, 16),
    path([38, 32], [38, 47], [64, 47], [64, 32]),
  ],
  airplane: (r) => [
    path([5, 50], [18, 42], [86, 42], [97, 50], [86, 58], [18, 58], [5, 50]),
    path([40, 42], [58, 8], [67, 8], [60, 42]),
    path([40, 58], [58, 92], [67, 92], [60, 58]),
    path([12, 44], [6, 24], [15, 24], [26, 42]),
  ],
  bicycle: (r) => [
    arc(23, 66, 18, 18, 0, TAU, 24),
    arc(77, 66, 18, 18, 0, TAU, 24),
    path([23, 66], [42, 40], [70, 40], [77, 66]),
    path([42, 40], [50, 66], [23, 66]),
    path([50, 66], [70, 40]),
    path([36, 32], [48, 32]),
    seg(42, 40, 42, 32, 2),
    path([70, 40], [68, 27], [78, 25]),
  ],
  helicopter: (r) => [
    arc(40, 56, 24, 16, 0, TAU, 24),
    path([62, 51], [95, 47], [95, 55], [62, 61]),
    seg(8, 34, 74, 34, 8),
    seg(40, 34, 40, 40, 2),
    arc(94, 43, 4, 9, 0, TAU, 8),
    path([20, 78], [62, 78]),
    seg(30, 71, 30, 78, 2),
    seg(52, 71, 52, 78, 2),
  ],
};

// an artist's drawing of it: their hand (a little off, more for the less skilled; now and then a
// detail left out)
export function doodle(c, rng, skill) {
  let st = DOODLES[c](rng);
  st = st.filter((s, i) => i < 2 || rng() > (1 - skill) * 0.7);
  const amp = (1 - skill) * 8 + 0.8;
  const sx = 0.86 + rng() * 0.28;
  const sy = 0.86 + rng() * 0.28;
  return st.map((s, si) => {
    const ox = (rng() - 0.5) * amp;
    const oy = (rng() - 0.5) * amp;
    const ph = rng() * 6;
    return s.map(([x, y], i) => [50 + (x - 50) * sx + ox + Math.sin(i * 0.9 + si * 3 + ph) * amp * 0.45, 50 + (y - 50) * sy + oy + Math.cos(i * 1.1 + si + ph) * amp * 0.45]);
  });
}

// what the judges make of a drawing: how sure they are it is c, and what they see most
export function judge(strokes, c) {
  if (!strokes.length || strokes.every((s) => s.length < 2)) return { p: 0, best: null, bp: 0 };
  const L = look(strokes);
  let p = 0;
  for (const k of FAMILY[c] || [c]) {
    const i = CLASSES.indexOf(k);
    if (i >= 0) p += L.p[i];
  }
  let bi = 0;
  for (let i = 1; i < L.p.length; i++) if (L.p[i] > L.p[bi]) bi = i;
  let best = CLASSES[bi];
  for (const [fam, ks] of Object.entries(FAMILY)) if (ks.includes(best)) best = fam;
  return { p: Math.min(1, p), best, bp: L.p[bi] };
}

const pts = (p, left) => Math.round(p * 100) + (p >= 0.35 ? Math.round((15 * Math.max(0, left)) / TIME) : 0);

export class DrawOff {
  // o: { venue (the name on the banner, the world's English), fee (to play again), prize (x1) }
  constructor(o = {}) {
    this.o = o;
    this.title = 'Draw-Off · קרב ציור';
    this.help = 'ציירו עם העכבר על הדף · Enter: סיימתי · K / Shift: מחיקת הקו האחרון · Esc ליציאה';
    this.helpTouch = 'ציירו באצבע על הדף · "סיימתי" כשגמרתם';
    this.pad = 'tap';
    // (drawn with the pointer: in the world, the screen's face takes the mouse and the finger)
    this.pointer = true;
  }

  start(api, o = {}) {
    this.api = api;
    this.o = { ...this.o, ...o };
    this.rec = { best: 0, wins: 0 };
    try {
      this.rec = { ...this.rec, ...(JSON.parse(localStorage.getItem(STORE) || '{}') || {}) };
    } catch (e) {
      // (nothing kept: a first time)
    }
    this.newContest();
  }

  newContest() {
    const r = this.api.rng;
    // three things, never the same twice in a contest
    const pool = SUBJECTS.slice();
    this.subjects = [];
    for (let k = 0; k < ROUNDS; k++) this.subjects.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    this.round = -1;
    this.totals = [0, 0, 0, 0];
    this.gallery = [];
    this.nextRound();
  }

  nextRound() {
    this.round++;
    const r = this.api.rng;
    this.subj = this.subjects[this.round];
    this.strokes = [];
    this.cur = null;
    this.lastDrag = null;
    this.scene = 'intro';
    this.t = 0;
    this.left = TIME;
    this.guess = null;
    this.guessT = 0;
    this.guessN = -1;
    this.doneAt = null;
    // the artists: what each will draw, and how long they take over it
    // (now and then one of them hears it wrong and draws something else: the crowd loves it; and
    // the slow one does not always finish)
    this.rivals = RIVALS.map((R) => {
      const oops = r() < R.oops;
      const c = oops ? SUBJECTS[Math.floor(r() * SUBJECTS.length)].c : this.subj.c;
      const st = doodle(c, r, R.skill);
      const n = st.reduce((a, s) => a + s.length, 0);
      return { R, st, n, pace: R.pace * (0.8 + r() * 0.65), j: null, oops: oops && c !== this.subj.c };
    });
    this.res = null;
    this.api.status(`סיבוב ${this.round + 1} מתוך ${ROUNDS}`);
    this.api.audio.play('click', 0.5);
  }

  result() {
    return this.scene === 'final' ? this.final : null;
  }

  stop() {}

  update(dt, inp) {
    this.t += dt;
    // (you are done: the clock runs on, three times as fast, while the artists finish)
    if (this.scene === 'draw' && this.doneAt !== null) this.t += dt * 2;
    if (this.scene === 'intro') {
      if (this.t > 2.6) {
        this.scene = 'draw';
        this.t = 0;
        this.api.audio.play('whoosh', 0.4);
      }
      return;
    }
    if (this.scene === 'draw') return this.drawing(dt, inp);
    if (this.scene === 'judge') {
      if (this.t > 1 + this.order.length * 1.1 && (this.t > 7.5 || inp.hit.has('enter') || inp.hit.has('a') || inp.taps.length)) {
        if (this.round + 1 < ROUNDS) this.nextRound();
        else this.end();
      }
      return;
    }
    if (this.scene === 'final') {
      if (this.t < 1) return;
      const again = inp.hit.has('enter') || inp.hit.has('a') || inp.taps.some(([x, y]) => y > 500 && x >= 500);
      const out = inp.hit.has('b') || inp.taps.some(([x, y]) => y > 500 && x < 500);
      if (again) {
        const fee = this.o.fee || 0;
        if (fee && this.api.money && !this.api.money.pay(fee, 'Draw-Off')) {
          this.api.toast('אין מספיק כסף לעוד קרב', 'bad', 2);
          return;
        }
        this.newContest();
      } else if (out) this.api.finish(this.final);
    }
  }

  inPaper(x, y) {
    return x > PX && x < PX + PW && y > PY && y < PY + PH;
  }

  drawing(dt, inp) {
    this.left = TIME - this.t;
    if (this.doneAt !== null) {
      // (judged when the last of them has put the pen down, or the time is up)
      if (this.left <= 0 || this.rivals.every((v) => this.rivalAt(v, this.t) >= 1)) this.judgeRound();
      return;
    }
    // the pen: a drag that began on the paper draws a line; let go, the line is done
    const d = inp.drag;
    if (d !== this.lastDrag) {
      this.cur = null;
      this.lastDrag = d;
    }
    if (d && d.down && this.inPaper(d.x0, d.y0)) {
      const x = Math.max(PX + 4, Math.min(PX + PW - 4, d.x));
      const y = Math.max(PY + 4, Math.min(PY + PH - 4, d.y));
      if (!this.cur) {
        this.cur = [[x, y]];
        this.strokes.push(this.cur);
      } else {
        const [lx, ly] = this.cur[this.cur.length - 1];
        if (Math.hypot(x - lx, y - ly) > 2.5) this.cur.push([x, y]);
      }
    } else this.cur = null;
    // the buttons under the paper: rub out the last line, done
    let done = inp.hit.has('enter') || inp.hit.has('a');
    let undo = inp.hit.has('b');
    for (const [x, y] of inp.taps) {
      if (y < PY + PH + 6 || y > 600) continue;
      if (x > PX + PW / 2 + 6 && x < PX + PW) done = true;
      else if (x > PX && x < PX + PW / 2 - 6) undo = true;
    }
    if (undo && this.strokes.length) {
      this.strokes.pop();
      this.cur = null;
      this.guessN = -1;
    }
    // what the judges see, as you draw (now and then: a look takes a few milliseconds)
    this.guessT -= dt;
    const n = this.strokes.reduce((a, s) => a + s.length, 0);
    if (this.guessT <= 0 && n !== this.guessN && this.strokes.some((s) => s.length > 2)) {
      this.guessT = 0.9;
      this.guessN = n;
      this.guess = judge(this.mine(), this.subj.c);
    }
    if (done && this.strokes.length) {
      this.doneAt = this.t;
      this.cur = null;
      this.api.audio.play('click', 0.6);
    } else if (this.left <= 0) this.judgeRound();
  }

  // your lines, in the judges' box (they look at the shape, not where on the paper)
  mine() {
    return this.strokes.filter((s) => s.length > 1).map((s) => s.map(([x, y]) => [x, y]));
  }

  rivalAt(v, t) {
    return Math.max(0, Math.min(1, (t - 0.4) / v.pace));
  }

  judgeRound() {
    const left = this.doneAt !== null ? TIME - this.doneAt : 0;
    const me = judge(this.mine(), this.subj.c);
    const scores = [{ who: -1, j: me, pts: pts(me.p, left) }];
    for (let i = 0; i < this.rivals.length; i++) {
      const v = this.rivals[i];
      // (what they had drawn when the time was up: all of it, unless they were slow)
      const f = this.rivalAt(v, Math.min(this.t, TIME));
      const st = cut(v.st, f);
      v.j = judge(st, this.subj.c);
      v.shown = f;
      scores.push({ who: i, j: v.j, pts: pts(v.j.p, Math.max(0, TIME - v.pace - 0.4)) * (f >= 1 ? 1 : 0.8) | 0 });
    }
    for (const s of scores) this.totals[s.who + 1] += s.pts;
    this.res = scores;
    // (revealed one by one, the artists first, yours last)
    this.order = [1, 2, 3, 0];
    this.scene = 'judge';
    this.t = 0;
    this.gallery.push({ c: this.subj.c, he: this.subj.he, strokes: this.mine(), p: me.p });
    this.api.audio.play('click', 0.6);
  }

  end() {
    const order = [0, 1, 2, 3].sort((a, b) => this.totals[b] - this.totals[a]);
    const place = order.indexOf(0);
    const mult = this.o.prize || 1;
    const prize = place < 3 ? PRIZE[place] * mult : 0;
    const total = this.totals[0];
    const record = total > (this.rec.best || 0);
    if (record) this.rec.best = total;
    if (place === 0) this.rec.wins = (this.rec.wins || 0) + 1;
    try {
      localStorage.setItem(STORE, JSON.stringify(this.rec));
    } catch (e) {
      // (no room: the record is only for now)
    }
    if (prize && this.api.money) this.api.money.earn(prize, place === 0 ? 'פרס ראשון: קרב ציור' : 'פרס: קרב ציור');
    this.final = { place: place + 1, total, prize, record, won: place === 0, gallery: this.gallery, wins: this.rec.wins };
    this.ranking = order;
    this.scene = 'final';
    this.t = 0;
    this.api.audio.play(place === 0 ? 'cheer' : place < 3 ? 'coins' : 'buzzer', 0.6);
    this.api.status(place === 0 ? 'ניצחון!' : `מקום ${place + 1}`);
  }

  // ------------------------------------------------------------------ drawing
  draw(g, W, H) {
    this.wall(g, W, H);
    this.banner(g, W);
    if (this.scene === 'final') return this.drawFinal(g, W, H);
    this.drawPaper(g);
    this.drawRivals(g);
    if (this.scene === 'intro') this.drawIntro(g, W, H);
    if (this.scene === 'judge') this.drawJudge(g);
  }

  // the yard's wall behind the stage: bricks, the lights strung over it
  wall(g, W, H) {
    g.fillStyle = '#3b1f2a';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    g.lineWidth = 2;
    g.beginPath();
    for (let y = 0; y < H; y += 22) {
      g.moveTo(0, y);
      g.lineTo(W, y);
      for (let x = (y / 22) % 2 ? 0 : 30; x < W; x += 60) {
        g.moveTo(x, y);
        g.lineTo(x, y + 22);
      }
    }
    g.stroke();
    // the lights, a string sagging across the top
    const cols = [PENS.yellow, PENS.pink, PENS.cyan, PENS.orange, PENS.green];
    g.strokeStyle = '#120a10';
    g.lineWidth = 2;
    g.beginPath();
    for (let x = 0; x <= W; x += 10) g.lineTo(x, 8 + Math.sin((x / W) * Math.PI * 3) * 6 + 6);
    g.stroke();
    for (let i = 0, x = 18; x < W; x += 48, i++) {
      const y = 8 + Math.sin((x / W) * Math.PI * 3) * 6 + 12;
      const on = 0.6 + 0.4 * Math.sin(this.t * 3 + i);
      g.fillStyle = cols[i % cols.length];
      g.globalAlpha = 0.25 * on;
      g.beginPath();
      g.arc(x, y, 12, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
      g.beginPath();
      g.arc(x, y, 4.5, 0, TAU);
      g.fill();
    }
  }

  banner(g, W) {
    const sub = this.subj;
    if (this.scene === 'final') {
      text(g, this.o.venue || 'PAINTWOOD DRAW-OFF', W / 2, 62, { font: MARKER, size: 40, color: PENS.yellow, outline: '#120a10' });
      return;
    }
    // the round, the thing to draw, the clock
    text(g, `סיבוב ${this.round + 1}/${ROUNDS}`, 905, 62, { size: 26, color: PAPER, outline: '#120a10' });
    text(g, `ציירו: ${sub.he}!`, 450, 64, { size: 46, color: PENS.yellow, outline: '#120a10', ow: 8 });
    if (this.scene === 'draw') {
      const k = Math.max(0, this.left / TIME);
      const cx = 92;
      const cy = 64;
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = 9;
      g.beginPath();
      g.arc(cx, cy, 30, 0, TAU);
      g.stroke();
      g.strokeStyle = this.left < 6 ? PENS.red : PENS.green;
      g.beginPath();
      g.arc(cx, cy, 30, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      g.stroke();
      text(g, String(Math.ceil(Math.max(0, this.left))), cx, cy + 2, { size: 30, color: PAPER, outline: '#120a10' });
    }
  }

  drawPaper(g) {
    box(g, PX, PY, PW, PH, { fill: PAPER, color: '#120a10', w: 4, seed: 5, r: 4 });
    // its faint lines
    g.save();
    g.beginPath();
    g.rect(PX + 4, PY + 4, PW - 8, PH - 8);
    g.clip();
    g.strokeStyle = 'rgba(90, 120, 200, 0.13)';
    g.lineWidth = 1;
    g.beginPath();
    for (let y = PY + 26; y < PY + PH; y += 26) {
      g.moveTo(PX, y);
      g.lineTo(PX + PW, y);
    }
    g.stroke();
    // your lines
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of this.strokes) {
      g.beginPath();
      s.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      if (s.length === 1) g.lineTo(s[0][0] + 0.1, s[0][1]);
      g.stroke();
    }
    g.restore();
    // what the judges make of it so far
    if (this.scene === 'draw') {
      const q = this.guess;
      let say = 'השופטים מסתכלים...';
      let col = PAPER;
      const slow = this.rivals.find((v) => this.rivalAt(v, this.t) < 1);
      if (this.doneAt !== null) {
        say = slow ? 'סיימתם! מחכים לשאר הציירים...' : 'סיימתם!';
        col = PENS.yellow;
      } else if (q && q.best) {
        if (q.best === this.subj.c && q.p > 0.35) {
          say = `השופטים: זה ${this.subj.he}! (${Math.round(q.p * 100)}%)`;
          col = PENS.green;
        } else say = `השופטים רואים: ${heName(q.best)}...`;
      }
      text(g, say, PX + PW / 2, PY - 14, { size: 22, color: col, outline: '#120a10' });
      // the two buttons under the paper
      if (this.doneAt !== null) return;
      const by = PY + PH + 10;
      box(g, PX + PW / 2 + 8, by, PW / 2 - 8, 44, { fill: this.strokes.length ? PENS.green : '#4a4a52', color: '#120a10', r: 10, seed: 41 });
      text(g, 'סיימתי!', PX + (PW * 3) / 4 + 4, by + 23, { size: 26, color: PAPER, outline: '#120a10' });
      box(g, PX, by, PW / 2 - 8, 44, { fill: '#6b4a5a', color: '#120a10', r: 10, seed: 42 });
      text(g, 'מחיקת הקו האחרון', PX + PW / 4 - 4, by + 23, { size: 22, color: PAPER, outline: '#120a10' });
    }
  }

  // the artists, each at their sheet, drawing
  drawRivals(g) {
    const t = this.scene === 'draw' ? this.t : this.scene === 'judge' ? TIME - Math.max(0, this.left) : 0;
    for (let i = 0; i < this.rivals.length; i++) {
      const v = this.rivals[i];
      const y = PY + i * 144;
      const x = 612;
      box(g, x, y, 372, 136, { fill: 'rgba(18, 10, 16, 0.55)', color: '#120a10', r: 8, seed: 60 + i, twice: false });
      // the artist, the pen in hand
      const drawingNow = this.scene === 'draw' && this.rivalAt(v, t) < 1 && this.rivalAt(v, t) > 0;
      const wob = drawingNow ? Math.sin(this.t * 14 + i) * 0.25 : 0;
      figure(g, x + 44, y + 128, 62, { ra: -1.2 + wob, rab: -0.6, la: 0.25 }, { shirt: v.R.shirt, hair: v.R.hair, skin: v.R.skin });
      text(g, v.R.name, x + 44, y + 16, { font: MARKER, size: 15, color: v.R.shirt, outline: '#120a10' });
      // their sheet
      const sx = x + 96;
      const sy = y + 8;
      const sw = 268;
      const sh = 120;
      box(g, sx, sy, sw, sh, { fill: PAPER, color: '#120a10', w: 2.5, r: 3, seed: 70 + i, twice: false });
      const f = this.scene === 'judge' ? v.shown : this.rivalAt(v, t);
      const st = cut(v.st, f);
      const k = (sh - 12) / 100;
      const ox = sx + sw / 2 - 50 * k;
      const oy = sy + 6;
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const s of st) {
        g.beginPath();
        s.forEach(([px, py], j) => (j ? g.lineTo(ox + px * k, oy + py * k) : g.moveTo(ox + px * k, oy + py * k)));
        g.stroke();
      }
      if (this.scene === 'draw' && f >= 1) text(g, 'סיים!', sx + sw - 30, sy + sh - 16, { size: 18, color: PENS.green, outline: PAPER });
    }
  }

  drawIntro(g, W, H) {
    g.fillStyle = 'rgba(10, 6, 12, 0.55)';
    g.fillRect(0, 0, W, H);
    const n = Math.max(1, 3 - Math.floor(this.t / 0.75));
    text(g, `ציירו: ${this.subj.he}!`, W / 2, H / 2 - 50, { size: 76, color: PENS.yellow, outline: '#120a10', ow: 12 });
    if (this.t > 0.3) text(g, String(n), W / 2, H / 2 + 70, { font: MARKER, size: 96, color: PAPER, outline: '#120a10', ow: 12 });
  }

  // the scores, one by one: a stamp on each sheet
  drawJudge(g) {
    for (let k = 0; k < this.order.length; k++) {
      if (this.t < 0.6 + k * 1.1) break;
      const who = this.order[k];
      const s = this.res.find((q) => q.who === who - 1);
      const pct = Math.round(s.j.p * 100);
      const good = s.j.p >= 0.35;
      const col = good ? PENS.green : PENS.red;
      if (who === 0) {
        // yours: the big stamp on your paper
        const say = good ? `השופטים: ${pct}% ${this.subj.he}!` : s.j.best ? `השופטים ראו: ${heName(s.j.best)}` : 'השופטים לא ראו כלום';
        g.save();
        g.translate(PX + PW / 2, PY + PH / 2);
        g.rotate(-0.08);
        box(g, -230, -58, 460, 116, { fill: 'rgba(255, 253, 246, 0.92)', color: col, w: 6, r: 14, seed: 90 });
        text(g, say, 0, -16, { size: 34, color: col, outline: PAPER });
        text(g, `${s.pts} נקודות`, 0, 30, { size: 30, color: INK, outline: PAPER });
        g.restore();
      } else {
        const y = PY + (who - 1) * 144;
        g.save();
        g.translate(612 + 96 + 210, y + 70);
        g.rotate(-0.12);
        box(g, -62, -30, 124, 60, { fill: 'rgba(255, 253, 246, 0.9)', color: col, w: 4, r: 10, seed: 95 + who });
        text(g, `${pct}%`, 0, -8, { size: 26, color: col, outline: PAPER });
        text(g, `+${s.pts}`, 0, 18, { size: 18, color: INK, outline: PAPER });
        g.restore();
      }
    }
    // the totals so far, at the bottom of the artists' column
    if (this.t > 0.6 + this.order.length * 1.1) text(g, 'לחצו להמשך', 798, 574, { size: 22, color: PAPER, outline: '#120a10' });
  }

  drawFinal(g, W, H) {
    const F = this.final;
    const names = ['אתם', ...RIVALS.map((R) => R.name)];
    const cols = [PENS.yellow, ...RIVALS.map((R) => R.shirt)];
    // the podium: the first three on it, in their order (each one's name and points over the head)
    const base = 498;
    const steps = [[W / 2, 120, 0], [W / 2 - 230, 88, 1], [W / 2 + 230, 64, 2]];
    for (const [x, h, place] of steps) {
      const who = this.ranking[place];
      box(g, x - 100, base - h, 200, h, { fill: ['#e8c050', '#c0c4cc', '#c08050'][place], color: '#120a10', r: 6, seed: 120 + place });
      text(g, String(place + 1), x, base - h / 2, { font: MARKER, size: 44, color: PAPER, outline: '#120a10' });
      figure(g, x, base - h, 70, place === 0 ? { ra: -2.7, la: 2.7, hop: 0.05 * Math.abs(Math.sin(this.t * 6)) } : {}, who === 0 ? { shirt: PENS.violet } : { shirt: RIVALS[who - 1].shirt, hair: RIVALS[who - 1].hair, skin: RIVALS[who - 1].skin });
      const top = base - h - 133 - (place === 0 ? 6 : 0);
      text(g, who === 0 ? 'אתם!' : names[who], x, top - 34, { font: who === 0 ? HAND : MARKER, size: 22, color: cols[who], outline: '#120a10' });
      text(g, `${this.totals[who]}`, x, top - 12, { font: MARKER, size: 18, color: PAPER, outline: '#120a10' });
    }
    // fourth, off the podium
    const fourth = this.ranking[3];
    text(g, `${fourth === 0 ? 'אתם' : names[fourth]} · ${this.totals[fourth]}`, W / 2, 514, { font: fourth === 0 ? HAND : MARKER, size: 18, color: '#d8c8d0', outline: '#120a10' });
    const say = F.won ? `ניצחתם בקרב הציור! ${cash(F.prize)}` : F.prize ? `מקום ${F.place}! ${cash(F.prize)}` : 'הפעם לא עליתם לפודיום';
    text(g, say, W / 2, 120, { size: 36, color: F.won ? PENS.yellow : PAPER, outline: '#120a10', ow: 7 });
    if (F.record) text(g, `שיא חדש: ${F.total}`, W / 2, 158, { size: 24, color: PENS.green, outline: '#120a10' });
    // the buttons
    box(g, 530, 532, 300, 52, { fill: PENS.green, color: '#120a10', r: 12, seed: 140 });
    text(g, this.o.fee ? `עוד קרב (${cash(this.o.fee)})` : 'עוד קרב', 680, 559, { size: 26, color: PAPER, outline: '#120a10' });
    box(g, 170, 532, 300, 52, { fill: '#6b4a5a', color: '#120a10', r: 12, seed: 141 });
    text(g, 'יציאה', 320, 559, { size: 26, color: PAPER, outline: '#120a10' });
  }
}

// the first f of a drawing's lines (drawn in order, a point at a time)
function cut(st, f) {
  if (f >= 1) return st;
  const n = st.reduce((a, s) => a + s.length, 0);
  let left = Math.floor(n * f);
  const out = [];
  for (const s of st) {
    if (left <= 0) break;
    out.push(left >= s.length ? s : s.slice(0, left));
    left -= s.length;
  }
  return out;
}
