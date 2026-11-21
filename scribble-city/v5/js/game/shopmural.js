import * as THREE from 'three';
import { painterLook } from './looks.js';

// (v5, ROADMAP 16.2) Now and then - not every time you come in - one of the shop's people is at a
// wall of it with the pens out: a mural, in a style of its own (leaves and flowers, the sea, bold
// shapes, the skyline at night, a face in one line, a rainbow), a piece at a time, a step back to
// look between. It stays on the wall once it is done (for as long as the game is on). Not in the food
// shops - their cooks draw the food (game/streetlife.js); a shop of the new kind only
// (game/shoplife.js).

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const P = (pts, col, w = 1) => ({ pts, col, w });
const ring = (cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 18) => {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
};
// a polyline turned by a about (0, 0) and moved to (cx, cy)
const turn = (pts, a, cx, cy) => pts.map(([x, y]) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);

// ------------------------------------------------------------------ the styles
// each makes the pieces of a mural W x H metres: { x, y (its middle, from the mural's), lines }
function leaf(len, col, vein) {
  const out = [];
  const half = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    half.push([t * len, Math.sin(t * Math.PI) * len * 0.32]);
  }
  out.push(P([...half, ...half.slice(0, -1).reverse().map(([x, y]) => [x, -y])], col, 1.6));
  out.push(P([[0, 0], [len * 0.95, 0]], vein, 1));
  for (let i = 1; i < 4; i++) {
    const x = (len * i) / 4;
    const h = Math.sin((i / 4) * Math.PI) * len * 0.26;
    out.push(P([[x - len * 0.1, 0], [x, h]], vein, 0.8));
    out.push(P([[x - len * 0.1, 0], [x, -h]], vein, 0.8));
  }
  return out;
}
const STYLES = {
  // big leaves and flowers in greens and pinks, a vine through them
  botanical(W, H) {
    const G = [0.22, 0.52, 0.32];
    const G2 = [0.4, 0.68, 0.38];
    const PK = [0.95, 0.52, 0.62];
    const YL = [0.98, 0.84, 0.36];
    const out = [];
    const vine = [];
    for (let i = 0; i <= 24; i++) vine.push([-W / 2 + (W * i) / 24, Math.sin(i * 0.7) * H * 0.12 - H * 0.05]);
    out.push({ x: 0, y: 0, lines: [P(vine, G, 1.4)] });
    for (let i = 0; i < 4; i++) {
      const x = -W * 0.38 + (W * 0.76 * i) / 3;
      const up = i % 2 ? 1 : -1;
      // (the first two to the left, the others to the right, up and down in turn)
      const a = up * (0.8 + Math.random() * 0.5) * (i < 2 ? -1 : 1) + (i < 2 ? Math.PI : 0);
      out.push({ x, y: up * H * 0.08, lines: leaf(H * 0.42, i % 2 ? G : G2, G).map((l) => ({ ...l, pts: turn(l.pts, a, 0, 0) })) });
    }
    for (let i = 0; i < 3; i++) {
      const x = -W * 0.28 + W * 0.28 * i;
      const y = (i % 2 ? -1 : 1) * H * 0.22;
      const r = H * 0.09;
      const lines = [];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        lines.push(P(ring(Math.cos(a) * r, Math.sin(a) * r, r * 0.8, r * 0.8, 0, Math.PI * 2, 12), PK, 1.5));
      }
      lines.push(P(ring(0, 0, r * 0.45, r * 0.45, 0, Math.PI * 2, 10), YL, 2));
      out.push({ x, y, lines });
    }
    return out;
  },
  // the sea: waves one over another, the sun, gulls
  waves(W, H) {
    const B = [0.16, 0.42, 0.72];
    const B2 = [0.38, 0.7, 0.88];
    const OR = [0.98, 0.6, 0.25];
    const out = [];
    out.push({ x: W * 0.22, y: H * 0.18, lines: [P(ring(0, 0, H * 0.2, H * 0.2), OR, 2), ...Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return P([[Math.cos(a) * H * 0.26, Math.sin(a) * H * 0.26], [Math.cos(a) * H * 0.34, Math.sin(a) * H * 0.34]], OR, 1.4); })] });
    for (let j = 0; j < 3; j++) {
      const pts = [];
      for (let i = 0; i <= 30; i++) {
        const x = -W / 2 + (W * i) / 30;
        pts.push([x, -H * 0.1 - j * H * 0.14 + Math.sin(i * 0.9 + j) * H * 0.06]);
      }
      out.push({ x: 0, y: 0, lines: [P(pts, j % 2 ? B2 : B, 2.2)] });
    }
    for (let k = 0; k < 3; k++) out.push({ x: -W * 0.3 + k * W * 0.12, y: H * 0.28 - k * H * 0.05, lines: [P([[-0.09, 0.02], [-0.04, 0.05], [0, 0], [0.04, 0.05], [0.09, 0.02]], [0.15, 0.15, 0.18], 1)] });
    return out;
  },
  // bold shapes in the primary colours
  bauhaus(W, H) {
    const R = [0.85, 0.2, 0.18];
    const Bl = [0.15, 0.3, 0.68];
    const Y = [0.98, 0.78, 0.15];
    const K = [0.1, 0.1, 0.12];
    return [
      { x: -W * 0.28, y: H * 0.05, lines: [P(ring(0, 0, H * 0.32, H * 0.32, 0, Math.PI * 2, 24), R, 2.4)] },
      { x: W * 0.02, y: -H * 0.05, lines: [P([[-H * 0.3, -H * 0.3], [H * 0.3, -H * 0.3], [0, H * 0.32], [-H * 0.3, -H * 0.3]], Bl, 2.4)] },
      { x: W * 0.3, y: H * 0.08, lines: [P([[-H * 0.22, -H * 0.3], [H * 0.22, -H * 0.3], [H * 0.22, H * 0.3], [-H * 0.22, H * 0.3], [-H * 0.22, -H * 0.3]], Y, 2.4)] },
      { x: 0, y: -H * 0.4, lines: [P([[-W * 0.45, 0], [W * 0.45, 0]], K, 1.6)] },
      { x: W * 0.15, y: H * 0.3, lines: [P(ring(0, 0, H * 0.14, H * 0.14, 0, Math.PI, 12), K, 1.6)] },
    ];
  },
  // the city at night: the towers, their windows, the moon
  skyline(W, H) {
    const N = [0.05, 0.06, 0.12];
    const Y = [0.98, 0.82, 0.3];
    const out = [];
    let x = -W / 2 + 0.05;
    const tops = [];
    while (x < W / 2 - 0.15) {
      const w = 0.16 + Math.random() * 0.22;
      const h = H * (0.3 + Math.random() * 0.5);
      tops.push([x, w, h]);
      x += w + 0.03;
    }
    for (const [x0, w, h] of tops) {
      const lines = [P([[0, 0], [0, h], [w, h], [w, 0]], N, 1.8)];
      for (let r = 0.12; r < h - 0.08; r += 0.14) for (let c = 0.05; c < w - 0.04; c += 0.08) if (Math.random() < 0.55) lines.push(P([[c, r], [c + 0.03, r]], Y, 1.6));
      out.push({ x: x0, y: -H / 2, lines });
    }
    out.push({ x: W * 0.32, y: H * 0.3, lines: [P(ring(0, 0, H * 0.12, H * 0.12, -1.2, 1.9, 14), Y, 2), P(ring(0.03, 0, H * 0.09, H * 0.1, -1.0, 1.7, 12), Y, 1.2)] });
    return out;
  },
  // a face in one line (the profile, the eye, the hand at the cheek)
  oneline(W, H) {
    const K = [0.1, 0.1, 0.12];
    const s = H * 0.9;
    const face = [[0.1, 0.5], [0.02, 0.36], [0.04, 0.24], [-0.06, 0.14], [0.02, 0.1], [-0.02, 0.04], [0.03, 0.0], [0.0, -0.06], [0.06, -0.12], [0.16, -0.16], [0.18, -0.36], [0.3, -0.5]].map(([x, y]) => [x * s, y * s]);
    const eye = ring(0.12 * s, 0.24 * s, 0.05 * s, 0.025 * s, 0, Math.PI * 2, 10);
    const hair = [[0.1 * s, 0.5 * s], [0.32 * s, 0.56 * s], [0.48 * s, 0.4 * s], [0.46 * s, 0.1 * s], [0.36 * s, -0.08 * s]];
    return [
      { x: -W * 0.1, y: 0, lines: [P(face, K, 1)] },
      { x: -W * 0.1, y: 0, lines: [P(eye, K, 0.9)] },
      { x: -W * 0.1, y: 0, lines: [P(hair, K, 1)] },
      { x: W * 0.28, y: -H * 0.1, lines: [P(ring(0, 0, H * 0.12, H * 0.12, 0, Math.PI * 2, 16), [0.85, 0.3, 0.3], 1.6)] },
    ];
  },
  // a rainbow, a cloud at each end
  rainbow(W, H) {
    const C = [[0.95, 0.42, 0.42], [0.98, 0.66, 0.36], [0.98, 0.9, 0.42], [0.45, 0.78, 0.5], [0.42, 0.62, 0.95], [0.66, 0.5, 0.9]];
    const out = [];
    const r0 = Math.min(W * 0.4, H * 0.8);
    C.forEach((col, i) => out.push({ x: 0, y: -H / 2 + 0.05, lines: [P(ring(0, 0, r0 - i * 0.07, r0 - i * 0.07, 0, Math.PI, 26), col, 2.6)] }));
    // (over the top of three puffs, left to right, and back along the bottom)
    const cloud = [...ring(-0.12, 0, 0.08, 0.08, Math.PI, 0.3, 8), ...ring(0, 0.04, 0.1, 0.1, 2.6, 0.5, 8), ...ring(0.12, 0, 0.08, 0.08, 2.8, 0, 8), [-0.2, 0]];
    for (const sx of [-1, 1]) out.push({ x: sx * (r0 - 0.2), y: -H / 2 + 0.1, lines: [P(cloud, [0.6, 0.66, 0.78], 1.6)] });
    return out;
  },
};
const NAMES = Object.keys(STYLES);
// the ground each is painted on: a base coat first, as a muralist does
const GROUND = { botanical: [0.93, 0.9, 0.78], waves: [0.8, 0.9, 0.96], bauhaus: [0.95, 0.93, 0.86], skyline: [0.2, 0.25, 0.46], oneline: [0.97, 0.86, 0.78], rainbow: [0.84, 0.93, 0.98] };

// the base coat: the picture's rectangle filled with slanted strokes, edge to edge
function ground(W, H, col) {
  const lines = [];
  const k = Math.tan(1.15);
  const step = 0.05;
  for (let c = -W / 2 - H / k; c < W / 2; c += step) {
    // (a stroke from the bottom edge up and to the right, cut to the rectangle)
    let x0 = c;
    let y0 = -H / 2;
    let x1 = c + H / k;
    let y1 = H / 2;
    if (x0 < -W / 2) {
      y0 += (-W / 2 - x0) * k;
      x0 = -W / 2;
    }
    if (x1 > W / 2) {
      y1 -= (x1 - W / 2) * k;
      x1 = W / 2;
    }
    if (y1 - y0 > 0.02) lines.push(P([[x0, y0], [x1, y1]], col, 2.6));
  }
  return { x: 0, y: 0, lines, dur: 7, ground: true };
}

// a free stretch of wall: nothing before it from the hip to above the head, and the wall really
// there (not a doorway) - the longest, on the back wall or a side
function findWall(R, col) {
  const c = R.corners;
  const f = R.facade;
  if (!c || !f) return null;
  const walls = [
    { a: c[3], b: c[2], n: [f.nx, f.nz] },
    { a: c[0], b: c[3], n: [f.rx, f.rz] },
    { a: c[2], b: c[1], n: [-f.rx, -f.rz] },
  ];
  const y0 = R.floor;
  let best = null;
  for (const w of walls) {
    const dx = w.b.x - w.a.x;
    const dz = w.b.z - w.a.z;
    const len = Math.hypot(dx, dz);
    if (len < 2) continue;
    const ux = dx / len;
    const uz = dz / len;
    let start = -1;
    for (let s = 0.3; s <= len - 0.3 + 1e-6; s += 0.2) {
      const x = w.a.x + ux * s + w.n[0] * 0.32;
      const z = w.a.z + uz * s + w.n[1] * 0.32;
      let free = true;
      // (nothing standing before it; and nothing up on the wall itself there - a screen, a sign, a
      // panel, a shelf: world/shopkit.js)
      const wx = w.a.x + ux * s + w.n[0] * 0.04;
      const wz = w.a.z + uz * s + w.n[1] * 0.04;
      for (const h of [0.95, 1.45, 1.95, 2.35]) {
        // (up on the wall: only where the picture would be - a band along the top of the walls, a
        // skirting, are not in its way)
        if (col.pointInside(x, y0 + h, z, 0.08) || (h > 1 && R.wallBusy && R.wallBusy(wx, y0 + h - 0.1, wz, 0.1))) {
          free = false;
          break;
        }
      }
      if (free) {
        const hit = col.raycast(x, y0 + 1.6, z, -w.n[0], 0, -w.n[1], 0.6);
        free = !!hit && hit.t < 0.45;
      }
      if (free) {
        if (start < 0) start = s;
        const run = s - start + 0.2;
        if (!best || run > best.len) best = { w, s0: start - 0.1, len: run, ux, uz };
      } else start = -1;
    }
  }
  if (!best || best.len < 1.4) return null;
  const W = Math.min(3.2, best.len - 0.2);
  const mid = best.s0 + best.len / 2;
  const { w } = best;
  const H = Math.min(1.25, Math.max(0.9, (R.height || 3) - 2.0));
  return {
    W,
    H,
    // the middle of the picture on the wall, the way along it (to the right as you face it), its
    // face into the room
    at: new THREE.Vector3(w.a.x + best.ux * mid, y0 + 1.72, w.a.z + best.uz * mid),
    rx: w.n[1],
    rz: -w.n[0],
    nx: w.n[0],
    nz: w.n[1],
  };
}

export class ShopMural {
  constructor(life) {
    this.life = life;
    this.game = life.game;
    this.c = null;
    this.sk = [];
    this.st = 'off';
  }

  // (the shop's life starting: game/shoplife.js) a mural there already, finished; or one to paint,
  // now and then
  start() {
    const L = this.life;
    const g = this.game;
    const shop = L.shop;
    if (!g.airsketch || !L.room || !L.room.corners) return;
    const M = shop.mural;
    if (M) {
      // (done before you came; or half done - and the painter back at it)
      this.show(M, M.done ? M.pieces.length : M.n);
      if (!M.done && L.open.open) this.spawn();
      return;
    }
    if (!L.open.open) return;
    const chance = shop.muralChance !== undefined ? shop.muralChance : 0.3;
    if (Math.random() >= chance) return;
    const wall = findWall(L.room, g.world.collision);
    if (!wall) return;
    const style = pick(NAMES);
    shop.mural = { wall, style, pieces: [ground(wall.W, wall.H, GROUND[style]), ...STYLES[style](wall.W * 0.9, wall.H * 0.86)], done: false, n: 0 };
    this.spawn();
  }

  // the finished pieces on the wall (all of them at once: it was done before you came)
  show(M, n) {
    for (let i = 0; i < n; i++) {
      const sk = this.piece(M, M.pieces[i], null);
      sk.phase = 'kept';
      sk.t = 0;
      this.sk.push(sk);
    }
  }

  piece(M, p, author) {
    const w = M.wall;
    const at = w.at.clone();
    at.x += w.rx * p.x;
    at.z += w.rz * p.x;
    at.y += p.y;
    let total = 0;
    for (const l of p.lines) for (let i = 1; i < l.pts.length; i++) total += Math.hypot(l.pts[i][0] - l.pts[i - 1][0], l.pts[i][1] - l.pts[i - 1][1]);
    // (the base coat a little nearer the wall than what is painted over it)
    return this.game.airsketch.draw({ shape: p.lines, at, size: 1, author, wall: { rx: w.rx, rz: w.rz, nx: w.nx * (p.ground ? 0.5 : 1), nz: w.nz * (p.ground ? 0.5 : 1) }, keep: true, width: 7, dur: p.dur || Math.min(9, 1.4 + total * 1.6), pen: 'magicPencil' });
  }

  spawn() {
    const L = this.life;
    const M = L.shop.mural;
    const from = L.marks.stock || L.room.center;
    const c = this.game.civilians.spawnScripted(from.x, from.z, painterLook(), L.open);
    c.noCollide = true;
    c.exitRoom = L.room;
    c.exitShop = L.shop;
    L.open.extras.push(c);
    this.c = c;
    this.st = 'walk';
    this.t = 0;
    this.v = { c, pts: null, t: 0 };
    this.goTo(M.n);
    c.ctrl = (civ, dt) => this.ctrl(civ, dt);
  }

  // where to stand for the i-th piece: before it, an arm's length out from the wall
  standAt(i, back = 0) {
    const M = this.life.shop.mural;
    const w = M.wall;
    const p = M.pieces[Math.min(i, M.pieces.length - 1)];
    const x = Math.max(-w.W / 2 + 0.3, Math.min(w.W / 2 - 0.3, p.x));
    return { x: w.at.x + w.rx * x + w.nx * (0.62 + back), z: w.at.z + w.rz * x + w.nz * (0.62 + back) };
  }

  goTo(i, back = 0) {
    const s = this.standAt(i, back);
    this.v.pts = this.life.room.path(this.c.pos.x, this.c.pos.z, s.x, s.z);
    this.v.t = 0;
  }

  ctrl(c, dt) {
    const L = this.life;
    const M = L.shop.mural;
    const f = c.fig;
    this.t += dt;
    this.v.t += dt;
    const w = M.wall;
    const faceWall = () => {
      c.faceYaw = Math.atan2(-w.nx, -w.nz);
    };
    switch (this.st) {
      case 'walk': {
        const m = L.open.follow(this.v);
        if (m) return { ...m, speed: 1.1 };
        faceWall();
        // the next piece: the pen to the wall
        this.st = 'paint';
        this.t = 0;
        this.cur = this.piece(M, M.pieces[M.n], c);
        this.sk.push(this.cur);
        return null;
      }
      case 'paint':
        faceWall();
        if (this.cur && (this.cur.phase === 'erase' || this.cur.phase === 'gone')) {
          // (rubbed out, or the pen dropped in a fright: that piece another time)
          this.st = 'done';
          return null;
        }
        if (this.cur && this.cur.phase !== 'draw') {
          M.n++;
          this.st = 'look';
          this.t = 0;
          this.goTo(Math.max(0, M.n - 1), 0.7);
        }
        return null;
      case 'look': {
        // a step back, a look at it
        const m = L.open.follow(this.v);
        if (m) return { ...m, speed: 0.8 };
        faceWall();
        f.lookAt = w.at;
        if (this.t > 1.6 + Math.random() * 0.02) {
          f.lookAt = null;
          if (M.n >= M.pieces.length) {
            M.done = true;
            this.st = 'done';
            this.t = 0;
            if (Math.random() < 0.8) L.say(c, pick(['Done!', 'There. What do you think?', 'Finally!', 'Not bad, if I say so myself.']), 1);
            return null;
          }
          this.st = 'walk';
          this.t = 0;
          this.goTo(M.n);
        }
        return null;
      }
      default:
        // finished: admiring it now and then, otherwise tidying the pens
        faceWall();
        f.lookAt = Math.sin(this.t * 0.4) > 0 ? w.at : null;
        return null;
    }
  }

  dispose() {
    // (the half-drawn piece fades: it is picked up from there next time; what is drawn stays drawn
    // in the shop's record - the pictures themselves go with the shop's life)
    for (const sk of this.sk) {
      this.game.airsketch.release(sk);
      sk.phase = 'gone';
    }
    this.sk = [];
    if (this.c && this.c.ctrl) this.c.ctrl = null;
    this.c = null;
  }
}
