// (ROADMAP 11.10, parts 2) A drawing seen as a whole, on a grid: what its lines close round (its
// body, however many lines it was drawn in - a van drawn as four lines is still a box), how thick
// each bit of it is (a gun's barrel, a rotor, a mast are thin: they are what sticks out of the
// body), where its edge is, and its outline. game/parts.js reads each line against it.
// Points in the frame's units (x right, y up).

const NEIGH4 = [1, 0, -1, 0, 0, 1, 0, -1];

export class PGrid {
  // P: the lines (arrays of [x, y]); n: cells along the longer side
  constructor(P, n = 72) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const s of P) {
      for (const [x, y] of s) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    const size = Math.max(x1 - x0, y1 - y0, 1e-3);
    this.cell = size / n;
    const pad = 5;
    this.ox = x0 - pad * this.cell;
    this.oy = y0 - pad * this.cell;
    this.nx = Math.ceil((x1 - x0) / this.cell) + pad * 2 + 1;
    this.ny = Math.ceil((y1 - y0) / this.cell) + pad * 2 + 1;
  }

  // a cell's index for a point (-1: off the grid)
  at(x, y) {
    const i = Math.round((x - this.ox) / this.cell);
    const j = Math.round((y - this.oy) / this.cell);
    return i >= 0 && j >= 0 && i < this.nx && j < this.ny ? j * this.nx + i : -1;
  }

  // the middle of a cell
  xy(k) {
    return [this.ox + (k % this.nx) * this.cell, this.oy + Math.floor(k / this.nx) * this.cell];
  }

  // lines onto a fresh grid (a line through every cell it crosses)
  ink(P) {
    const g = new Uint8Array(this.nx * this.ny);
    for (const s of P) {
      for (let k = 0; k < s.length; k++) {
        const ax = (s[k][0] - this.ox) / this.cell;
        const ay = (s[k][1] - this.oy) / this.cell;
        const b = s[Math.min(k + 1, s.length - 1)];
        const bx = (b[0] - this.ox) / this.cell;
        const by = (b[1] - this.oy) / this.cell;
        const m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
        for (let t = 0; t <= m; t++) {
          const i = Math.round(ax + ((bx - ax) * t) / m);
          const j = Math.round(ay + ((by - ay) * t) / m);
          if (i >= 0 && j >= 0 && i < this.nx && j < this.ny) g[j * this.nx + i] = 1;
        }
      }
    }
    return g;
  }

  // what the lines close round, filled: their little gaps (r cells) closed first
  solid(P, r = 2) {
    let g = this.ink(P);
    if (r > 0) g = this.erode(this.dilate(g, r), r);
    this.fill(g);
    return g;
  }

  dilate(src, r) {
    const { nx, ny } = this;
    const out = new Uint8Array(nx * ny);
    const offs = disk(r);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (!src[j * nx + i]) continue;
        for (let q = 0; q < offs.length; q += 2) {
          const a = i + offs[q];
          const b = j + offs[q + 1];
          if (a >= 0 && b >= 0 && a < nx && b < ny) out[b * nx + a] = 1;
        }
      }
    }
    return out;
  }

  erode(src, r) {
    const { nx, ny } = this;
    const out = new Uint8Array(nx * ny);
    const offs = disk(r);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (!src[j * nx + i]) continue;
        let all = 1;
        for (let q = 0; q < offs.length && all; q += 2) {
          const a = i + offs[q];
          const b = j + offs[q + 1];
          if (a < 0 || b < 0 || a >= nx || b >= ny || !src[b * nx + a]) all = 0;
        }
        out[j * nx + i] = all;
      }
    }
    return out;
  }

  // what nothing outside reaches is inside: filled
  fill(g) {
    const { nx, ny } = this;
    const out = new Uint8Array(nx * ny);
    const q = [];
    const push = (i, j) => {
      const k = j * nx + i;
      if (out[k] || g[k]) return;
      out[k] = 1;
      q.push(k);
    };
    for (let i = 0; i < nx; i++) {
      push(i, 0);
      push(i, ny - 1);
    }
    for (let j = 0; j < ny; j++) {
      push(0, j);
      push(nx - 1, j);
    }
    while (q.length) {
      const k = q.pop();
      const i = k % nx;
      const j = (k - i) / nx;
      for (let d = 0; d < 8; d += 2) {
        const a = i + NEIGH4[d];
        const b = j + NEIGH4[d + 1];
        if (a >= 0 && b >= 0 && a < nx && b < ny) push(a, b);
      }
    }
    for (let k = 0; k < g.length; k++) if (!out[k]) g[k] = 1;
    return g;
  }

  // the thick of it: what is left when everything thinner than 2r + 1 cells is taken away
  open(src, r) {
    return this.dilate(this.erode(src, r), r);
  }

  // its pieces (4-connected): [{ cells: [k...], n, x0, x1, y0, y1 (cells) }], biggest first
  pieces(g) {
    const { nx, ny } = this;
    const seen = new Uint8Array(nx * ny);
    const out = [];
    for (let k0 = 0; k0 < g.length; k0++) {
      if (!g[k0] || seen[k0]) continue;
      const cells = [];
      const q = [k0];
      seen[k0] = 1;
      let i0 = Infinity;
      let i1 = -Infinity;
      let j0 = Infinity;
      let j1 = -Infinity;
      while (q.length) {
        const k = q.pop();
        cells.push(k);
        const i = k % nx;
        const j = (k - i) / nx;
        if (i < i0) i0 = i;
        if (i > i1) i1 = i;
        if (j < j0) j0 = j;
        if (j > j1) j1 = j;
        for (let d = 0; d < 8; d += 2) {
          const a = i + NEIGH4[d];
          const b = j + NEIGH4[d + 1];
          if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
          const kk = b * nx + a;
          if (g[kk] && !seen[kk]) {
            seen[kk] = 1;
            q.push(kk);
          }
        }
      }
      out.push({ cells, n: cells.length, i0, i1, j0, j1 });
    }
    return out.sort((a, b) => b.n - a.n);
  }

  // a piece alone on a grid of its own
  only(piece) {
    const g = new Uint8Array(this.nx * this.ny);
    for (const k of piece.cells) g[k] = 1;
    return g;
  }

  // how far each cell is from the edge of g, in cells (inside: +, outside: -), 3-4 chamfer
  dist(g) {
    const { nx, ny } = this;
    const N = nx * ny;
    const din = new Float32Array(N);
    const dout = new Float32Array(N);
    const BIG = 1e6;
    for (let k = 0; k < N; k++) {
      din[k] = g[k] ? BIG : 0;
      dout[k] = g[k] ? 0 : BIG;
    }
    const pass = (d) => {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          if (!d[k]) continue;
          let v = d[k];
          if (i > 0) v = Math.min(v, d[k - 1] + 3);
          if (j > 0) v = Math.min(v, d[k - nx] + 3);
          if (i > 0 && j > 0) v = Math.min(v, d[k - nx - 1] + 4);
          if (i < nx - 1 && j > 0) v = Math.min(v, d[k - nx + 1] + 4);
          d[k] = v;
        }
      }
      for (let j = ny - 1; j >= 0; j--) {
        for (let i = nx - 1; i >= 0; i--) {
          const k = j * nx + i;
          if (!d[k]) continue;
          let v = d[k];
          if (i < nx - 1) v = Math.min(v, d[k + 1] + 3);
          if (j < ny - 1) v = Math.min(v, d[k + nx] + 3);
          if (i < nx - 1 && j < ny - 1) v = Math.min(v, d[k + nx + 1] + 4);
          if (i > 0 && j < ny - 1) v = Math.min(v, d[k + nx - 1] + 4);
          d[k] = v;
        }
      }
    };
    pass(din);
    pass(dout);
    const out = new Float32Array(N);
    for (let k = 0; k < N; k++) out[k] = g[k] ? din[k] / 3 - 0.5 : -(dout[k] / 3 - 0.5);
    return out;
  }

  // the outline of g's biggest loop, in the frame's units (marching squares, walked with the
  // inside on the left - anticlockwise, y up)
  outline(g) {
    const { nx, ny, cell, ox, oy } = this;
    const at = (i, j) => (i >= 0 && j >= 0 && i < nx && j < ny ? g[j * nx + i] : 0);
    const next = new Map();
    const key = (x, y) => x * 8209 + y;
    for (let j = -1; j < ny; j++) {
      for (let i = -1; i < nx; i++) {
        const a = at(i, j);
        const b = at(i + 1, j);
        const c = at(i + 1, j + 1);
        const d = at(i, j + 1);
        const m = a | (b << 1) | (c << 2) | (d << 3);
        if (m === 0 || m === 15) continue;
        const T = [2 * i + 1, 2 * j];
        const R = [2 * i + 2, 2 * j + 1];
        const B = [2 * i + 1, 2 * j + 2];
        const L = [2 * i, 2 * j + 1];
        const seg = (p, q) => next.set(key(p[0], p[1]), q);
        switch (m) {
          case 1: seg(L, T); break;
          case 2: seg(T, R); break;
          case 3: seg(L, R); break;
          case 4: seg(R, B); break;
          case 5: seg(L, T); seg(R, B); break;
          case 6: seg(T, B); break;
          case 7: seg(L, B); break;
          case 8: seg(B, L); break;
          case 9: seg(B, T); break;
          case 10: seg(T, R); seg(B, L); break;
          case 11: seg(B, R); break;
          case 12: seg(R, L); break;
          case 13: seg(R, T); break;
          case 14: seg(T, L); break;
          default: break;
        }
      }
    }
    let best = null;
    const used = new Set();
    for (const [k0] of next) {
      if (used.has(k0)) continue;
      const loop = [];
      let k = k0;
      let guard = 0;
      while (!used.has(k) && guard++ < 200000) {
        used.add(k);
        const q = next.get(k);
        if (!q) break;
        loop.push([ox + (q[0] / 2) * cell, oy + (q[1] / 2) * cell]);
        k = key(q[0], q[1]);
      }
      if (loop.length >= 6 && (!best || loop.length > best.length)) best = loop;
    }
    return best || [];
  }
}

const DISKS = new Map();
function disk(r) {
  if (DISKS.has(r)) return DISKS.get(r);
  const o = [];
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) o.push(x, y);
  DISKS.set(r, o);
  return o;
}

// fewer points, the same loop (Douglas-Peucker on a closed loop)
export function simplifyLoop(loop, eps) {
  if (loop.length < 8) return loop;
  const dp = (pts) => {
    if (pts.length < 3) return pts;
    const a = pts[0];
    const b = pts[pts.length - 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1e-9;
    let far = -1;
    let at = -1;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((pts[i][0] - a[0]) * dy - (pts[i][1] - a[1]) * dx) / L;
      if (d > far) {
        far = d;
        at = i;
      }
    }
    if (far <= eps) return [a, b];
    const l = dp(pts.slice(0, at + 1));
    const r = dp(pts.slice(at));
    return l.slice(0, -1).concat(r);
  };
  // (split at the point furthest from the first, so both halves are open lines)
  let far = 0;
  let at = 0;
  for (let i = 1; i < loop.length; i++) {
    const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]);
    if (d > far) {
      far = d;
      at = i;
    }
  }
  const A = dp(loop.slice(0, at + 1));
  const B = dp(loop.slice(at).concat([loop[0]]));
  return A.slice(0, -1).concat(B.slice(0, -1));
}

// a loop with its corners rounded a little (Chaikin, once)
export function smoothLoop(loop) {
  const out = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  return out;
}
