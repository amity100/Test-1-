// (v5, ROADMAP 12.7) INK RALLY: the sit-down racer. A road into the sunset, drawn the way the old
// machines drew it - a slice at a time, each smaller and higher than the one before, bent by the
// curves and lifted by the hills - palms and billboards going by, cars to pass. The gas is down by
// itself; you steer, and brake on the bends. Every checkpoint gives you time; when it runs out, so
// does the race.

import { CabGame, NEON, glowLine, glowText, FONT } from './cab.js';

const SEG = 200;
const RUMBLE = 3;
const ROAD_W = 2000;
const CAM_H = 1000;
const DEPTH = 1 / Math.tan((100 / 2) * (Math.PI / 180));
const PLAYER_Z = CAM_H * DEPTH;
const MAX = SEG * 60;
const ACC = MAX / 5;
const BRAKE = -MAX;
const DECEL = -MAX / 5;
const OFF_DECEL = -MAX / 2;
const OFF_LIMIT = MAX / 4;
const CENTRIFUGAL = 0.3;
const VW = 1000;
const VH = 600;

const easeIn = (a, b, p) => a + (b - a) * Math.pow(p, 2);
const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

export class InkRally extends CabGame {
  constructor(o) {
    super(o);
    this.id = 'rally';
    this.name = 'INK RALLY';
    this.title = 'INK RALLY · מכונת מרוצים';
    this.help = 'ימינה ושמאלה להיגוי · למטה לבלום · הגז לחוץ לבד · Esc לצאת';
    this.helpTouch = 'החצים להיגוי · למטה לבלום';
    this.color = NEON.pink;
    this.lives0 = 1;
    this.perTicket = 200;
    this.hud = false;
  }

  reset() {
    this.build();
    this.pos = 0;
    this.x = 0;
    this.speed = 0;
    this.time = 40;
    this.dist = 0;
    this.passed = 0;
    this.sky = 0;
    this.hill = 0;
    this.check = 1;
    this.msg = null;
    this.steer = 0;
  }

  // the road: a loop of slices, its bends and hills
  build() {
    const S = (this.segs = []);
    const lastY = () => (S.length ? S[S.length - 1].p2.y : 0);
    const add = (curve, y) => {
      const n = S.length;
      S.push({ i: n, p1: { y: lastY(), z: n * SEG, s: {} }, p2: { y, z: (n + 1) * SEG, s: {} }, curve, sprites: [], cars: [], dark: Math.floor(n / RUMBLE) % 2 });
    };
    const road = (enter, hold, leave, curve, h) => {
      const y0 = lastY();
      const y1 = y0 + h * SEG;
      const tot = enter + hold + leave;
      for (let n = 0; n < enter; n++) add(easeIn(0, curve, n / enter), easeInOut(y0, y1, n / tot));
      for (let n = 0; n < hold; n++) add(curve, easeInOut(y0, y1, (enter + n) / tot));
      for (let n = 0; n < leave; n++) add(easeInOut(curve, 0, n / leave), easeInOut(y0, y1, (enter + hold + n) / tot));
    };
    road(25, 25, 25, 0, 0);
    road(50, 50, 50, 0, 20);
    road(50, 50, 50, -2, 0);
    road(50, 50, 50, 4, 40);
    road(50, 50, 50, 2, -20);
    road(50, 50, 50, -2, 40);
    road(50, 50, 50, -4, -40);
    road(100, 100, 100, 0, 0);
    road(50, 50, 50, 6, 0);
    road(25, 25, 25, 0, 60);
    road(50, 50, 50, -6, -20);
    road(50, 50, 50, 2, 20);
    road(25, 25, 25, 0, -40);
    road(50, 50, 50, -2, 0);
    road(100, 100, 100, 4, 0);
    road(50, 50, 50, 0, -lastY() / SEG);
    this.len = S.length * SEG;
    // the roadside: palms, lamps, the billboards
    for (let n = 10; n < S.length; n += 6) S[n].sprites.push({ k: 'palm', off: (n / 6) % 2 ? -1.4 - Math.random() * 0.6 : 1.4 + Math.random() * 0.6 });
    for (let n = 20; n < S.length; n += 24) for (const s of [-1, 1]) S[n].sprites.push({ k: 'lamp', off: s * 1.15 });
    const BOARDS = ['INK', 'SCRIBBLE CITY', 'INK ARCADE', 'DRAW FAST', 'NEON INK'];
    for (let n = 60; n < S.length; n += 110) S[n].sprites.push({ k: 'board', off: n % 220 < 110 ? -1.9 : 1.9, t: BOARDS[(n / 110) % BOARDS.length | 0] });
    for (let k = 1; k < 4; k++) S[Math.floor((S.length * k) / 4)].sprites.push({ k: 'gate', off: 0 });
    // the other cars, keeping to their lanes
    this.cars = [];
    const COLS = [NEON.cyan, NEON.yellow, NEON.green, NEON.orange, NEON.violet, NEON.red, NEON.white];
    for (let n = 0; n < 24; n++) {
      const z = (0.05 + Math.random() * 0.95) * this.len;
      const c = { off: [-0.66, 0, 0.66][n % 3] + (Math.random() - 0.5) * 0.1, z, speed: MAX * (0.3 + Math.random() * 0.35), c: COLS[n % COLS.length] };
      this.cars.push(c);
      this.seg(z).cars.push(c);
    }
  }

  seg(z) {
    const S = this.segs;
    return S[Math.floor(z / SEG) % S.length];
  }

  step(dt, inp) {
    const pseg = this.seg(this.pos + PLAYER_Z);
    const pct = this.speed / MAX;
    const dx = dt * 2 * pct;
    const was = this.pos;
    this.pos = (this.pos + dt * this.speed) % this.len;
    this.dist += dt * this.speed;
    const steer = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    this.steer += (steer - this.steer) * Math.min(1, dt * 8);
    this.x += dx * steer;
    this.x -= dx * pct * pseg.curve * CENTRIFUGAL;
    const brake = inp.down || inp.b;
    if (this.time <= 0) this.speed = Math.max(0, this.speed + BRAKE * 0.3 * dt);
    else if (brake) this.speed += BRAKE * dt;
    else this.speed += ACC * dt;
    if ((this.x < -1 || this.x > 1) && this.speed > OFF_LIMIT) this.speed += OFF_DECEL * dt;
    // into the car ahead: slowed to its speed, behind it
    for (const c of pseg.cars) {
      if (this.speed > c.speed && Math.abs(this.x - c.off) < 0.55) {
        this.speed = c.speed * (c.speed / this.speed);
        this.pos = (c.z - PLAYER_Z + this.len) % this.len;
        this.sfx('hit', 0.7);
        this.flash = 0.25;
        break;
      }
    }
    this.x = Math.max(-2.5, Math.min(2.5, this.x));
    this.speed = Math.max(0, Math.min(MAX, this.speed));
    // the background turns with the bends
    this.sky += pseg.curve * pct * 0.0006;
    this.hill += pseg.curve * pct * 0.0012;
    // the other cars on: passing them counts
    for (const c of this.cars) {
      const s0 = this.seg(c.z);
      const before = (c.z - (was + PLAYER_Z) + this.len) % this.len;
      c.z = (c.z + dt * c.speed) % this.len;
      const after = (c.z - (this.pos + PLAYER_Z) + this.len) % this.len;
      if (before < this.len / 2 && after > this.len / 2 && this.speed > c.speed) {
        this.passed++;
        this.add(50);
      }
      const s1 = this.seg(c.z);
      if (s0 !== s1) {
        s0.cars.splice(s0.cars.indexOf(c), 1);
        s1.cars.push(c);
      }
    }
    // the clock, the checkpoints
    if (this.time > 0) {
      this.time -= dt;
      if (this.time <= 0) {
        this.time = 0;
        this.msg = { t: 3, s: 'TIME UP!' };
        this.sfx('over');
      }
    }
    const lap = Math.floor((this.dist + PLAYER_Z) / (this.len / 4));
    if (lap >= this.check && this.time > 0) {
      // (less each time: the road is yours only as long as you keep up)
      const plus = Math.max(7, 19 - this.check * 2);
      this.check = lap + 1;
      this.time += plus;
      this.msg = { t: 2, s: `CHECKPOINT! +${plus}` };
      this.sfx('win');
    }
    if (this.msg) {
      this.msg.t -= dt;
      if (this.msg.t <= 0) this.msg = null;
    }
    this.score = Math.floor(this.dist / 100) + this.passed * 50 + (this.check - 1) * 500;
    if (this.time <= 0 && this.speed < 50) this.over();
    // (the engine, up with the speed)
    this.engT = (this.engT || 0) - dt;
    if (this.engT <= 0) {
      this.engT = 0.12;
      if (this.api.audio && this.api.audio.ctx && this.api.audio.ctx.state === 'running') this.api.audio.tone('sawtooth', 60 + pct * 140, 64 + pct * 150, 0.13, 0.025);
    }
  }

  render(g) {
    this.background(g);
    const S = this.segs;
    const base = this.seg(this.pos);
    const bpct = (this.pos % SEG) / SEG;
    const pseg = this.seg(this.pos + PLAYER_Z);
    const ppct = ((this.pos + PLAYER_Z) % SEG) / SEG;
    const py = pseg.p1.y + (pseg.p2.y - pseg.p1.y) * ppct;
    let maxy = VH;
    let x = 0;
    let dx = -(base.curve * bpct);
    const N = this.touch ? 70 : 110;
    for (let n = 0; n < N; n++) {
      const s = S[(base.i + n) % S.length];
      const loop = s.i < base.i ? this.len : 0;
      s.clip = maxy;
      project(s.p1, this.x * ROAD_W - x, py + CAM_H, this.pos - loop);
      project(s.p2, this.x * ROAD_W - x - dx, py + CAM_H, this.pos - loop);
      x += dx;
      dx += s.curve;
      s.vis = !(s.p1.cz <= DEPTH || s.p2.s.y >= s.p1.s.y || s.p2.s.y >= maxy);
      if (!s.vis) continue;
      slice(g, s, n);
      maxy = s.p1.s.y;
    }
    // what stands by the road and the cars on it, far to near
    for (let n = N - 1; n > 0; n--) {
      const s = S[(base.i + n) % S.length];
      if (!s.vis && s.p1.cz <= DEPTH) continue;
      const k = s.p1.s.scale;
      for (const sp of s.sprites) {
        const sx = s.p1.s.x + k * sp.off * ROAD_W * (VW / 2);
        prop(g, sp, sx, s.p1.s.y, k * (VW / 2) * ROAD_W, s.clip);
      }
      for (const c of s.cars) {
        const p = (c.z % SEG) / SEG;
        const sc = k + (s.p2.s.scale - k) * p;
        const cx = s.p1.s.x + (s.p2.s.x - s.p1.s.x) * p + sc * c.off * ROAD_W * (VW / 2);
        const cy = s.p1.s.y + (s.p2.s.y - s.p1.s.y) * p;
        car(g, cx, cy, sc * (VW / 2) * 520, c.c, s.clip);
      }
    }
    // you
    const bounce = this.speed > 0 ? Math.sin(this.t * 40) * 1.5 * (this.speed / MAX) : 0;
    myCar(g, VW / 2, VH - 30 + bounce, this.steer, this.speed > 0 && (this.x < -1 || this.x > 1));
    // the dashboard: time, speed, score
    glowText(g, `${Math.ceil(this.time)}`, VW / 2, 50, 56, this.time < 10 ? NEON.red : NEON.yellow);
    glowText(g, 'TIME', VW / 2, 92, 18, NEON.yellow);
    glowText(g, `${Math.round((this.speed / MAX) * 280)} KM/H`, VW - 30, 40, 30, NEON.cyan, 'right');
    glowText(g, `${this.score}`, 30, 40, 30, NEON.white, 'left');
    glowText(g, `PASSED ${this.passed}`, 30, 76, 18, NEON.pink, 'left');
    if (this.msg) glowText(g, this.msg.s, VW / 2, 200, 48, NEON.green);
  }

  background(g) {
    // the sky: violet to the pink of the horizon, a striped sun, the stars, hills turning with you
    const gr = g.createLinearGradient(0, 0, 0, VH / 2 + 40);
    gr.addColorStop(0, '#120628');
    gr.addColorStop(0.65, '#5a1460');
    gr.addColorStop(1, '#ff5a8a');
    g.fillStyle = gr;
    g.fillRect(0, 0, VW, VH);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 40; i++) {
      const sx = (((i * 97.3 + this.sky * 300) % VW) + VW) % VW;
      g.fillRect(sx, (i * 53.7) % 180, 2, 2);
    }
    const sx = VW / 2 - this.sky * 200;
    const sy = VH / 2 - 10;
    const sg = g.createLinearGradient(0, sy - 110, 0, sy + 20);
    sg.addColorStop(0, '#ffe14a');
    sg.addColorStop(1, '#ff4fa8');
    g.fillStyle = sg;
    g.beginPath();
    g.arc(sx, sy, 110, Math.PI, 0);
    g.fill();
    g.fillStyle = '#5a1460';
    for (let i = 0; i < 6; i++) g.fillRect(sx - 115, sy - 52 + i * 11, 230, 2 + i);
    for (const [k, amp, col, line] of [[0.5, 60, '#2a0a3e', NEON.violet], [1, 34, '#1a0628', NEON.pink]]) {
      const off = this.hill * k * 400;
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const x = (i / 40) * VW;
        const u = (x + off) / 120;
        pts.push([x, VH / 2 + 30 - Math.abs(Math.sin(u) * amp + Math.sin(u * 2.3) * amp * 0.4)]);
      }
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, VH);
      for (const [x, y] of pts) g.lineTo(x, y);
      g.lineTo(VW, VH);
      g.fill();
      glowLine(g, pts, line, 2);
    }
  }
}

function project(p, cx, cy, cz) {
  const X = -cx;
  const Y = p.y - cy;
  const Z = p.z - cz;
  p.cz = Z;
  const k = DEPTH / Z;
  p.s.scale = k;
  p.s.x = Math.round(VW / 2 + k * X * (VW / 2));
  p.s.y = Math.round(VH / 2 - k * Y * (VH / 2));
  p.s.w = Math.round(k * ROAD_W * (VW / 2));
}

function poly(g, x1, y1, x2, y2, x3, y3, x4, y4, c) {
  g.fillStyle = c;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.lineTo(x3, y3);
  g.lineTo(x4, y4);
  g.closePath();
  g.fill();
}

// one slice of the road: the ground either side, the kerbs, the road, its lines
function slice(g, s, n) {
  const a = s.p1.s;
  const b = s.p2.s;
  const dark = s.dark;
  g.fillStyle = dark ? '#160a2a' : '#1c0e34';
  g.fillRect(0, b.y, VW, a.y - b.y + 1);
  // (a grid on the ground, the old way: a light line across every few slices)
  if (s.i % 8 === 0) {
    g.fillStyle = 'rgba(176,123,255,0.45)';
    g.fillRect(0, b.y, VW, Math.max(1, (a.y - b.y) * 0.25));
  }
  const r1 = a.w / 6;
  const r2 = b.w / 6;
  poly(g, a.x - a.w - r1, a.y, a.x - a.w, a.y, b.x - b.w, b.y, b.x - b.w - r2, b.y, dark ? NEON.pink : '#f6f4ff');
  poly(g, a.x + a.w + r1, a.y, a.x + a.w, a.y, b.x + b.w, b.y, b.x + b.w + r2, b.y, dark ? NEON.pink : '#f6f4ff');
  poly(g, a.x - a.w, a.y, a.x + a.w, a.y, b.x + b.w, b.y, b.x - b.w, b.y, dark ? '#221c3c' : '#262042');
  if (dark) {
    const l1 = a.w / 32;
    const l2 = b.w / 32;
    for (const k of [-1 / 3, 1 / 3]) poly(g, a.x + a.w * k * 2 - l1 / 2, a.y, a.x + a.w * k * 2 + l1 / 2, a.y, b.x + b.w * k * 2 + l2 / 2, b.y, b.x + b.w * k * 2 - l2 / 2, b.y, NEON.cyan);
  }
}

// a thing by the road at (x, y) - y its foot - `k` metres to the screen
function prop(g, sp, x, y, k, clip) {
  if (y > clip + 200) return;
  const u = k / ROAD_W;
  g.save();
  g.beginPath();
  g.rect(0, 0, VW, clip);
  g.clip();
  if (sp.k === 'palm') {
    const h = 1500 * u;
    const lean = 260 * u * Math.sign(sp.off);
    glowLine(g, [[x, y], [x + lean * 0.3, y - h * 0.5], [x + lean, y - h]], NEON.orange, Math.max(1, 70 * u));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      glowLine(g, [[x + lean, y - h], [x + lean + Math.cos(a) * 420 * u, y - h + Math.sin(a) * 160 * u + 120 * u]], NEON.green, Math.max(1, 50 * u));
    }
  } else if (sp.k === 'lamp') {
    const h = 1100 * u;
    glowLine(g, [[x, y], [x, y - h], [x - Math.sign(sp.off) * 220 * u, y - h]], '#8a84a8', Math.max(1, 30 * u));
    g.fillStyle = '#fff2b0';
    g.beginPath();
    g.arc(x - Math.sign(sp.off) * 220 * u, y - h + 20 * u, Math.max(1.5, 50 * u), 0, Math.PI * 2);
    g.fill();
  } else if (sp.k === 'board') {
    const w = 1400 * u;
    const h = 600 * u;
    g.fillStyle = '#1a0a30';
    g.fillRect(x - w / 2, y - h - 500 * u, w, h);
    g.strokeStyle = NEON.cyan;
    g.lineWidth = Math.max(1, 30 * u);
    g.strokeRect(x - w / 2, y - h - 500 * u, w, h);
    glowLine(g, [[x - w * 0.3, y], [x - w * 0.3, y - 500 * u]], '#6a6488', Math.max(1, 30 * u));
    glowLine(g, [[x + w * 0.3, y], [x + w * 0.3, y - 500 * u]], '#6a6488', Math.max(1, 30 * u));
    if (h > 8) {
      g.font = FONT(Math.max(6, h * 0.42));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = NEON.pink;
      g.fillText(sp.t, x, y - h / 2 - 500 * u);
    }
  } else if (sp.k === 'gate') {
    const w = 2.3 * k;
    const h = 1400 * u;
    glowLine(g, [[x - w, y], [x - w, y - h], [x + w, y - h], [x + w, y]], NEON.yellow, Math.max(1, 60 * u));
    if (h > 20) {
      g.font = FONT(Math.max(6, h * 0.2));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = NEON.yellow;
      g.fillText('CHECKPOINT', x, y - h * 0.86);
    }
  }
  g.restore();
}

// a car ahead, seen from behind: its body, its glass, its tail lights
function car(g, x, y, w, c, clip) {
  if (y - w * 0.6 > clip || w < 2) return;
  g.save();
  g.beginPath();
  g.rect(0, 0, VW, clip);
  g.clip();
  const h = w * 0.5;
  g.fillStyle = '#0a0814';
  g.fillRect(x - w / 2, y - h, w, h);
  g.strokeStyle = c;
  g.lineWidth = Math.max(1, w * 0.04);
  g.strokeRect(x - w / 2, y - h, w, h);
  g.fillStyle = 'rgba(63,240,255,0.3)';
  g.fillRect(x - w * 0.34, y - h * 1.5, w * 0.68, h * 0.5);
  g.strokeRect(x - w * 0.34, y - h * 1.5, w * 0.68, h * 0.5);
  g.fillStyle = NEON.red;
  g.fillRect(x - w * 0.46, y - h * 0.7, w * 0.2, h * 0.18);
  g.fillRect(x + w * 0.26, y - h * 0.7, w * 0.2, h * 0.18);
  g.restore();
}

// yours: the same, bigger, leaning into the turn, a little dust off the road
function myCar(g, x, y, steer, off) {
  const w = 230;
  const h = 80;
  g.save();
  g.translate(x, y);
  g.rotate(steer * 0.04);
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(-w / 2 - 6, -10, w + 12, 16);
  glowLine(g, [[-w / 2, 0], [-w / 2, -h], [-w * 0.32, -h * 1.7], [w * 0.32, -h * 1.7], [w / 2, -h], [w / 2, 0]], NEON.pink, 4, true, '#2a0a30');
  glowLine(g, [[-w * 0.28, -h * 1.05], [-w * 0.24, -h * 1.6], [w * 0.24, -h * 1.6], [w * 0.28, -h * 1.05]], NEON.cyan, 3, true, 'rgba(63,240,255,0.25)');
  g.fillStyle = NEON.red;
  g.fillRect(-w * 0.46, -h * 0.75, w * 0.22, 14);
  g.fillRect(w * 0.24, -h * 0.75, w * 0.22, 14);
  g.fillStyle = '#0a0814';
  g.fillRect(-w * 0.5, -6, 44, 12);
  g.fillRect(w * 0.5 - 44, -6, 44, 12);
  g.font = FONT(18);
  g.textAlign = 'center';
  g.fillStyle = NEON.yellow;
  g.fillText('INK', 0, -h * 0.55);
  if (off) {
    g.fillStyle = 'rgba(200,180,255,0.35)';
    for (let i = 0; i < 6; i++) g.fillRect(-w / 2 + Math.random() * w, -Math.random() * 30, 10, 10);
  }
  g.restore();
}
