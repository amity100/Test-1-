// (v5, ROADMAP 12.7) PEN-MAN: round, yellow, always hungry - through the maze eating its dots of ink,
// four erasers after it. The big drops turn the tables: for a while the erasers run, and an eaten one
// goes home as a pair of eyes. Eat the page clean and the next is quicker.

import { CabGame, NEON, glowLine, glowCircle, glowText } from './cab.js';

const MAP = [
  '#####################',
  '#o.......#.#.......o#',
  '#.##.###.#.#.###.##.#',
  '#...................#',
  '#.##.#.###-###.#.##.#',
  '#....#.#GGGGG#.#....#',
  '####.#.#######.#.####',
  '#......... .........#',
  '#.##.###.###.###.##.#',
  '#o.#.............#.o#',
  '##.#.#.#######.#.#.##',
  '#....#....#....#....#',
  '#####################',
];
const MW = 21;
const MH = 13;
const T = 40;
const OX = 80;
const OY = 72;
const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const ERASERS = [
  { c: NEON.red, home: [10, 3], corner: [19, 0] },
  { c: NEON.pink, home: [9, 5], corner: [1, 0] },
  { c: NEON.cyan, home: [10, 5], corner: [19, 12] },
  { c: NEON.orange, home: [11, 5], corner: [1, 12] },
];

// back the way it came, from between two squares: the one it was going to is the one it left
function turnBack(m) {
  if (m.fx !== m.x || m.fy !== m.y) {
    m.x += m.d[0];
    m.y += m.d[1];
  }
  m.d = [-m.d[0], -m.d[1]];
}

const wall = (x, y) => x < 0 || x >= MW || y < 0 || y >= MH || MAP[y][x] === '#';
const center = (x, y) => [OX + x * T + T / 2, OY + y * T + T / 2];

export class PenMan extends CabGame {
  constructor(o) {
    super(o);
    this.id = 'penman';
    this.name = 'PEN-MAN';
    this.title = 'PEN-MAN · מכונת משחק';
    this.help = 'חצים לנוע במבוך · Esc לצאת';
    this.helpTouch = 'החצים לנוע במבוך';
    this.color = NEON.yellow;
    this.tint = '#0a0a24';
    this.perTicket = 150;
  }

  reset() {
    this.level = 0;
    this.nextLevel();
  }

  nextLevel() {
    this.level++;
    this.dots = new Set();
    this.power = new Set();
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        if (MAP[y][x] === '.') this.dots.add(y * MW + x);
        if (MAP[y][x] === 'o') this.power.add(y * MW + x);
      }
    }
    this.place();
  }

  // everyone to their places: you at the middle of the bottom corridor, the erasers home
  place() {
    this.me = { x: 10, y: 7, fx: 10, fy: 7, d: [0, 0], want: [-1, 0], speed: 5.6 + this.level * 0.25, mouth: 0 };
    this.foes = ERASERS.map((e, i) => ({ ...e, x: e.home[0], y: e.home[1], fx: e.home[0], fy: e.home[1], d: [0, 0], wait: i * 2.2, mode: 'home', eyes: false }));
    this.scare = 0;
    this.chain = 0;
    this.modeT = 0;
    this.deadT = 0;
    this.pops = [];
  }

  open(x, y, d, foe) {
    const nx = x + d[0];
    const ny = y + d[1];
    if (wall(nx, ny)) return false;
    // (the door of their home: theirs only, and only on the way out or home)
    if (MAP[ny][nx] === '-' || MAP[ny][nx] === 'G') return !!foe && (foe.mode === 'home' || foe.eyes);
    return true;
  }

  step(dt, inp) {
    if (this.deadT > 0) {
      this.deadT -= dt;
      if (this.deadT <= 0) {
        if (this.lives <= 0) return this.over();
        this.place();
      }
      return;
    }
    this.modeT += dt;
    if (this.scare > 0) this.scare -= dt;
    const me = this.me;
    for (const k of ['left', 'right', 'up', 'down']) if (inp.hit.has(k) || inp[k]) me.want = DIRS[k];
    // (back the way you came: at once, not at the next square)
    if (me.want[0] === -me.d[0] && me.want[1] === -me.d[1] && (me.d[0] || me.d[1])) turnBack(me);
    // (a swipe on the screen)
    if (inp.drag && Math.hypot(inp.drag.x - inp.drag.x0, inp.drag.y - inp.drag.y0) > 30) {
      const dx = inp.drag.x - inp.drag.x0;
      const dy = inp.drag.y - inp.drag.y0;
      me.want = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
      inp.drag.x0 = inp.drag.x;
      inp.drag.y0 = inp.drag.y;
    }
    this.move(me, me.speed * dt, (m) => {
      // at a square's middle: turn where you want, if you can; eat what is there
      if (this.open(m.x, m.y, m.want)) m.d = m.want;
      else if (!this.open(m.x, m.y, m.d)) m.d = [0, 0];
      const k = m.y * MW + m.x;
      if (this.dots.delete(k)) {
        this.add(10);
        this.sfx('pick', 0.35);
      }
      if (this.power.delete(k)) {
        this.add(50);
        this.scare = Math.max(3.5, 8 - this.level);
        this.chain = 0;
        for (const f of this.foes) if (!f.eyes && f.mode !== 'home' && (f.d[0] || f.d[1])) turnBack(f);
        this.sfx('power');
      }
    });
    if (me.d[0] || me.d[1]) me.mouth += dt * 12;
    // the erasers
    // (to their corners at first and for a while every so often; after you the rest of the time)
    const ph = this.modeT - 6;
    const chase = ph > 0 && ph % 25 < 20;
    for (const f of this.foes) {
      if (f.wait > 0) {
        f.wait -= dt;
        continue;
      }
      const sp = f.eyes ? 11 : this.scare > 0 && f.mode !== 'home' ? 3.4 : f.mode === 'home' ? 3 : 5.0 + this.level * 0.3;
      this.move(f, sp * dt, (m) => this.think(m, chase));
      // met: eaten, or it eats you
      const [ax, ay] = this.pos(f);
      const [bx, by] = this.pos(me);
      if (Math.hypot(ax - bx, ay - by) < T * 0.6 && !f.eyes) {
        if (this.scare > 0 && f.mode !== 'home') {
          f.eyes = true;
          this.chain++;
          const pts = 200 * Math.pow(2, Math.min(3, this.chain - 1));
          this.add(pts);
          this.pops.push({ x: ax, y: ay, t: 1, txt: `${pts}` });
          this.sfx('hit');
        } else if (f.mode !== 'home') {
          this.lives--;
          this.deadT = 1.8;
          this.flash = 0.6;
          this.sfx('die');
          return;
        }
      }
    }
    for (const p of this.pops) p.t -= dt;
    this.pops = this.pops.filter((p) => p.t > 0);
    if (!this.dots.size && !this.power.size) {
      this.add(1000);
      this.sfx('win');
      this.flash = 0.6;
      this.nextLevel();
    }
  }

  pos(m) {
    return [OX + (m.fx + 0.5) * T, OY + (m.fy + 0.5) * T];
  }

  // along its way, a square at a time: at each middle `at(m)` chooses the next way
  move(m, dist, at) {
    let left = dist;
    for (let guard = 0; guard < 4 && left > 0; guard++) {
      if (!m.d[0] && !m.d[1]) {
        at(m);
        if (!m.d[0] && !m.d[1]) return;
      }
      const tx = m.x + m.d[0];
      const ty = m.y + m.d[1];
      const rem = Math.abs(tx - m.fx) + Math.abs(ty - m.fy);
      if (left < rem) {
        m.fx += m.d[0] * left;
        m.fy += m.d[1] * left;
        return;
      }
      left -= rem;
      m.x = tx;
      m.y = ty;
      m.fx = tx;
      m.fy = ty;
      at(m);
    }
  }

  // an eraser at a crossing: where it is after (you, ahead of you, its corner, home)
  think(f, chase) {
    if (f.eyes && f.x === f.home[0] && f.y === f.home[1]) {
      f.eyes = false;
      f.mode = 'home';
    }
    if (f.mode === 'home' && !f.eyes) {
      // (out through the door, then out in the maze)
      if (f.y <= 3) f.mode = 'out';
    }
    let target;
    if (f.eyes) target = ERASERS.find((e) => e.c === f.c).home;
    else if (f.mode === 'home') target = [10, 3];
    else if (this.scare > 0) target = [Math.floor(Math.random() * MW), Math.floor(Math.random() * MH)];
    else if (!chase) target = f.corner;
    else {
      const me = this.me;
      const i = ERASERS.findIndex((e) => e.c === f.c);
      if (i === 0) target = [me.x, me.y];
      else if (i === 1) target = [me.x + me.d[0] * 4, me.y + me.d[1] * 4];
      else if (i === 2) target = [2 * me.x - this.foes[0].x, 2 * me.y - this.foes[0].y];
      else target = Math.hypot(me.x - f.x, me.y - f.y) > 6 ? [me.x, me.y] : f.corner;
    }
    let best = null;
    let bd = Infinity;
    for (const d of [[0, -1], [-1, 0], [0, 1], [1, 0]]) {
      if (d[0] === -f.d[0] && d[1] === -f.d[1] && (f.d[0] || f.d[1])) continue;
      if (!this.open(f.x, f.y, d, f)) continue;
      const dd = Math.hypot(f.x + d[0] - target[0], f.y + d[1] - target[1]);
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    f.d = best || [-f.d[0], -f.d[1]];
  }

  render(g) {
    // the maze: its walls drawn once, then copied each frame
    if (!this.mazeC) this.mazeC = mazeCanvas();
    g.drawImage(this.mazeC, 0, 0, 1000, 600);
    // the dots
    g.fillStyle = '#ffd9a8';
    for (const k of this.dots) {
      const [x, y] = center(k % MW, Math.floor(k / MW));
      g.fillRect(x - 3, y - 3, 6, 6);
    }
    const blink = Math.floor(this.t * 4) % 2 === 0;
    for (const k of this.power) {
      const [x, y] = center(k % MW, Math.floor(k / MW));
      if (blink) glowCircle(g, x, y, 9, NEON.white, 2, '#ffe9c8');
    }
    // the erasers
    for (const f of this.foes) {
      const [x, y] = this.pos(f);
      eraser(g, x, y, f, this.scare, this.t);
    }
    // you
    const me = this.me;
    const [x, y] = this.pos(me);
    if (this.deadT > 0) {
      const k = 1 - this.deadT / 1.8;
      g.fillStyle = NEON.yellow;
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, 16, -Math.PI / 2 + k * Math.PI, -Math.PI / 2 - k * Math.PI + Math.PI * 2);
      g.fill();
    } else {
      const a = Math.atan2(me.d[1] || me.want[1], me.d[0] || me.want[0]);
      const open = 0.08 + Math.abs(Math.sin(me.mouth)) * 0.7;
      g.fillStyle = NEON.yellow;
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, 16, a + open, a - open + Math.PI * 2);
      g.closePath();
      g.fill();
      // (its cap: the pen's, on its head)
      glowLine(g, [[x - 6, y - 15], [x, y - 24], [x + 6, y - 15]], NEON.blue, 2);
    }
    for (const p of this.pops) glowText(g, p.txt, p.x, p.y - (1 - p.t) * 20, 24, NEON.cyan);
    glowText(g, `PAGE ${this.level}`, 960, 590, 16, NEON.yellow, 'right');
  }

  lifeIcon(g, x, y) {
    g.fillStyle = NEON.yellow;
    g.beginPath();
    g.moveTo(x, y);
    g.arc(x, y, 11, Math.PI + 0.6, Math.PI - 0.6 + Math.PI * 2);
    g.closePath();
    g.fill();
  }
}

// the walls: dark blue, their edges in light where they meet the corridors
function mazeCanvas() {
  const c = document.createElement('canvas');
  c.width = 1000;
  c.height = 600;
  const g = c.getContext('2d');
  g.lineCap = 'round';
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const ch = MAP[y][x];
      const x0 = OX + x * T;
      const y0 = OY + y * T;
      if (ch === '-') {
        g.strokeStyle = NEON.pink;
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(x0 + 4, y0 + T / 2);
        g.lineTo(x0 + T - 4, y0 + T / 2);
        g.stroke();
        continue;
      }
      if (ch !== '#') continue;
      g.fillStyle = '#10124a';
      g.fillRect(x0 + 6, y0 + 6, T - 12, T - 12);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (wall(x + dx, y + dy)) g.fillRect(x0 + 6 + Math.max(0, dx) * (T - 12), y0 + 6 + Math.max(0, dy) * (T - 12), dx ? 12 : T - 12, dy ? 12 : T - 12);
      }
    }
  }
  // the edges: wherever a wall's square meets a corridor's
  for (const [w, a] of [[9, 0.3], [3, 1]]) {
    g.strokeStyle = NEON.blue;
    g.globalAlpha = a;
    g.lineWidth = w;
    g.beginPath();
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        if (MAP[y][x] !== '#') continue;
        const x0 = OX + x * T;
        const y0 = OY + y * T;
        if (!wall(x, y - 1) && y > 0) {
          g.moveTo(x0 + (wall(x - 1, y) ? 0 : 6), y0 + 6);
          g.lineTo(x0 + T - (wall(x + 1, y) ? 0 : 6), y0 + 6);
        }
        if (!wall(x, y + 1) && y < MH - 1) {
          g.moveTo(x0 + (wall(x - 1, y) ? 0 : 6), y0 + T - 6);
          g.lineTo(x0 + T - (wall(x + 1, y) ? 0 : 6), y0 + T - 6);
        }
        if (!wall(x - 1, y) && x > 0) {
          g.moveTo(x0 + 6, y0 + (wall(x, y - 1) ? 0 : 6));
          g.lineTo(x0 + 6, y0 + T - (wall(x, y + 1) ? 0 : 6));
        }
        if (!wall(x + 1, y) && x < MW - 1) {
          g.moveTo(x0 + T - 6, y0 + (wall(x, y - 1) ? 0 : 6));
          g.lineTo(x0 + T - 6, y0 + T - (wall(x, y + 1) ? 0 : 6));
        }
      }
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  g.strokeStyle = NEON.blue;
  g.lineWidth = 3;
  g.strokeRect(OX + 2, OY + 2, MW * T - 4, MH * T - 4);
  return c;
}

// an eraser on the run: its body (blue when it is scared, white blinking at the end of it), its eyes
function eraser(g, x, y, f, scare, t) {
  if (!f.eyes) {
    const scared = scare > 0 && f.mode !== 'home';
    const c = scared ? (scare < 2 && Math.floor(t * 6) % 2 ? NEON.white : NEON.blue) : f.c;
    const pts = [[x - 16, y + 16]];
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      pts.push([x + Math.cos(a) * 16, y - 2 + Math.sin(a) * 16]);
    }
    pts.push([x + 16, y + 16]);
    for (let i = 1; i < 4; i++) pts.push([x + 16 - i * 8, y + (i % 2 ? 10 : 16) + Math.sin(t * 12) * 2]);
    glowLine(g, pts, c, 3, true, scared ? '#1b2a7a' : '#2a1030');
    if (scared) {
      glowLine(g, [[x - 9, y + 6], [x - 5, y + 2], [x - 1, y + 6], [x + 3, y + 2], [x + 7, y + 6]], NEON.white, 2);
      return;
    }
  }
  // the eyes, looking the way it goes
  for (const s of [-6, 6]) {
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(x + s, y - 4, 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1b2a7a';
    g.fillRect(x + s - 2 + f.d[0] * 2, y - 6 + f.d[1] * 2, 4, 4);
  }
}
