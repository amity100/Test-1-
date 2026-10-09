// What is behind the buildings is not drawn at all (ROADMAP 0.5).
//
// The buildings' bodies (the boxes the facades are built from, see world/deco.js) are drawn on the
// processor into a small depth picture of their own; a piece of the city whose whole box is behind
// them is left out of the frame. It never leaves out anything that shows: a building counts only
// where it surely covers a whole cell of the small picture, and at the depth of its farthest
// corner; a piece is left out only if every cell its box could touch is covered nearer than the
// box's nearest corner. (A building with a hole rubbed in it, or a box the camera is in, is not
// counted at all.)

const NEAR = 0.1;
const _p = new Float32Array(8 * 3); // projected corners: x, y (cells), view depth
const _hull = new Float32Array(16 * 2);
const _order = new Int32Array(8);

export class Occlusion {
  constructor(w = 160, h = 90) {
    this.w = w;
    this.h = h;
    this.depth = new Float32Array(w * h);
    // blocks of 8 x 8 cells: the nearest and the farthest building in each (for quick answers)
    this.bw = Math.ceil(w / 8);
    this.bh = Math.ceil(h / 8);
    this.bmin = new Float32Array(this.bw * this.bh);
    this.bmax = new Float32Array(this.bw * this.bh);
    this.boxes = []; // occluders: { x0, y0, z0, x1, y1, z1, alive?, box }
    this.m = new Float32Array(16); // view-projection (column-major, as three.js)
    this.v = new Float32Array(16); // view
    this.on = false;
    this.stats = { occluders: 0, tested: 0, hidden: 0 };
  }

  // the buildings' boxes (each { x0, z0, x1, z1, y0, y1, alive })
  setOccluders(list) {
    this.boxes = list;
  }

  // draw the buildings as the camera sees them (projection and view matrices of the camera).
  // holes: the rubbed-out spots ({ x, y, z, r }): a building near one is not counted
  begin(camera, holes = null, range = 320) {
    const w = this.w;
    const h = this.h;
    const D = this.depth;
    D.fill(Infinity);
    const P = camera.projectionMatrix.elements;
    const V = camera.matrixWorldInverse.elements;
    const m = this.m;
    // m = P * V
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        m[c * 4 + r] = P[r] * V[c * 4] + P[4 + r] * V[c * 4 + 1] + P[8 + r] * V[c * 4 + 2] + P[12 + r] * V[c * 4 + 3];
      }
    }
    this.v.set(V);
    const cam = camera.position;
    const r2 = range * range;
    let n = 0;
    for (const b of this.boxes) {
      if (b.alive === false) continue;
      // near enough, and not round the camera
      const cx = Math.max(b.x0, Math.min(cam.x, b.x1));
      const cz = Math.max(b.z0, Math.min(cam.z, b.z1));
      const dx = cx - cam.x;
      const dz = cz - cam.z;
      if (dx * dx + dz * dz > r2) continue;
      if (cam.x > b.x0 - 0.5 && cam.x < b.x1 + 0.5 && cam.z > b.z0 - 0.5 && cam.z < b.z1 + 0.5 && cam.y > b.y0 - 0.5 && cam.y < b.y1 + 0.5) continue;
      if (holes && nearHole(b, holes)) continue;
      if (this.project(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1) < 0) continue;
      this.fill(w, h, D);
      n++;
    }
    // the blocks
    const bw = this.bw;
    for (let by = 0; by < this.bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        let lo = Infinity;
        let hi = 0;
        const r1 = Math.min(h, by * 8 + 8);
        const c1 = Math.min(w, bx * 8 + 8);
        for (let r = by * 8; r < r1; r++) {
          for (let c = bx * 8; c < c1; c++) {
            const d = D[r * w + c];
            if (d < lo) lo = d;
            if (d > hi) hi = d;
          }
        }
        this.bmin[by * bw + bx] = lo;
        this.bmax[by * bw + bx] = hi;
      }
    }
    this.stats.occluders = n;
    this.stats.tested = 0;
    this.stats.hidden = 0;
    this.on = true;
  }

  // the 8 corners of a box into _p; returns the farthest view depth, or -1 if a corner is behind
  // the camera (or the whole box is off one side of the picture)
  project(x0, y0, z0, x1, y1, z1) {
    const m = this.m;
    const v = this.v;
    const w = this.w;
    const h = this.h;
    let zmax = 0;
    let left = 0;
    let right = 0;
    let below = 0;
    let above = 0;
    for (let i = 0; i < 8; i++) {
      const x = i & 1 ? x1 : x0;
      const y = i & 2 ? y1 : y0;
      const z = i & 4 ? z1 : z0;
      const zv = -(v[2] * x + v[6] * y + v[10] * z + v[14]);
      if (zv < NEAR) return -1;
      const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      const sx = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / cw) * 0.5 + 0.5;
      const sy = ((m[1] * x + m[5] * y + m[9] * z + m[13]) / cw) * 0.5 + 0.5;
      _p[i * 3] = sx * w;
      _p[i * 3 + 1] = sy * h;
      _p[i * 3 + 2] = zv;
      if (zv > zmax) zmax = zv;
      if (sx < 0) left++;
      if (sx > 1) right++;
      if (sy < 0) below++;
      if (sy > 1) above++;
    }
    if (left === 8 || right === 8 || below === 8 || above === 8) return -1;
    this.zmax = zmax;
    return zmax;
  }

  // the projected box's outline (convex hull of the 8 corners), filled where it covers whole cells
  fill(w, h, D) {
    // (smaller than a cell either way: it cannot cover one)
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const x = _p[i * 3];
      const y = _p[i * 3 + 1];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (x1 - x0 < 1 || y1 - y0 < 1) return;
    // monotone chain over the 8 points, sorted by x then y
    for (let i = 0; i < 8; i++) _order[i] = i;
    for (let i = 1; i < 8; i++) {
      const k = _order[i];
      let j = i - 1;
      while (j >= 0 && (_p[_order[j] * 3] > _p[k * 3] || (_p[_order[j] * 3] === _p[k * 3] && _p[_order[j] * 3 + 1] > _p[k * 3 + 1]))) {
        _order[j + 1] = _order[j];
        j--;
      }
      _order[j + 1] = k;
    }
    let n = 0;
    const cross = (a, b, c) => (_hull[b * 2] - _hull[a * 2]) * (_p[c * 3 + 1] - _hull[a * 2 + 1]) - (_hull[b * 2 + 1] - _hull[a * 2 + 1]) * (_p[c * 3] - _hull[a * 2]);
    // lower hull
    for (let i = 0; i < 8; i++) {
      const k = _order[i];
      while (n >= 2 && cross(n - 2, n - 1, k) <= 0) n--;
      _hull[n * 2] = _p[k * 3];
      _hull[n * 2 + 1] = _p[k * 3 + 1];
      n++;
    }
    // upper hull
    const lower = n + 1;
    for (let i = 6; i >= 0; i--) {
      const k = _order[i];
      while (n >= lower && cross(n - 2, n - 1, k) <= 0) n--;
      _hull[n * 2] = _p[k * 3];
      _hull[n * 2 + 1] = _p[k * 3 + 1];
      n++;
    }
    n--; // (the last point is the first again)
    if (n < 3) return;
    let ymin = Infinity;
    let ymax = -Infinity;
    for (let i = 0; i < n; i++) {
      const y = _hull[i * 2 + 1];
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
    const z = this.zmax;
    const r0 = Math.max(0, Math.ceil(ymin));
    const r1 = Math.min(h, Math.floor(ymax));
    for (let r = r0; r < r1; r++) {
      // the outline's extent at the cell row's two edges: the row is covered between them
      const a = spanAt(n, r);
      if (a === null) continue;
      const aL = spanL;
      const aR = spanR;
      if (spanAt(n, r + 1) === null) continue;
      const xl = Math.max(aL, spanL);
      const xr = Math.min(aR, spanR);
      const c0 = Math.max(0, Math.ceil(xl));
      const c1 = Math.min(w, Math.floor(xr));
      const row = r * w;
      for (let c = c0; c < c1; c++) if (D[row + c] > z) D[row + c] = z;
    }
  }

  // is the box (world space, axis aligned) surely behind the buildings?
  hidden(x0, y0, z0, x1, y1, z1) {
    if (!this.on) return false;
    this.stats.tested++;
    const m = this.m;
    const v = this.v;
    const w = this.w;
    const h = this.h;
    let zmin = Infinity;
    let sx0 = Infinity;
    let sx1 = -Infinity;
    let sy0 = Infinity;
    let sy1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const x = i & 1 ? x1 : x0;
      const y = i & 2 ? y1 : y0;
      const z = i & 4 ? z1 : z0;
      const zv = -(v[2] * x + v[6] * y + v[10] * z + v[14]);
      if (zv < NEAR) return false;
      const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      const sx = (((m[0] * x + m[4] * y + m[8] * z + m[12]) / cw) * 0.5 + 0.5) * w;
      const sy = (((m[1] * x + m[5] * y + m[9] * z + m[13]) / cw) * 0.5 + 0.5) * h;
      if (zv < zmin) zmin = zv;
      if (sx < sx0) sx0 = sx;
      if (sx > sx1) sx1 = sx;
      if (sy < sy0) sy0 = sy;
      if (sy > sy1) sy1 = sy;
    }
    const c0 = Math.max(0, Math.floor(sx0));
    const c1 = Math.min(w - 1, Math.floor(sx1));
    const r0 = Math.max(0, Math.floor(sy0));
    const r1 = Math.min(h - 1, Math.floor(sy1));
    // (all of it off the picture: the camera's own culling takes care of it)
    if (c0 > c1 || r0 > r1) return false;
    const D = this.depth;
    const zt = zmin - 0.05;
    // block by block: a block wholly in the box's rectangle answers for all its cells when it can
    const bw = this.bw;
    const b0x = c0 >> 3;
    const b1x = c1 >> 3;
    const b0y = r0 >> 3;
    const b1y = r1 >> 3;
    for (let by = b0y; by <= b1y; by++) {
      for (let bx = b0x; bx <= b1x; bx++) {
        const k = by * bw + bx;
        // (nothing of the buildings in this block is nearer than the box: it shows)
        if (!(this.bmin[k] < zt)) return false;
        const cx0 = Math.max(c0, bx * 8);
        const cx1 = Math.min(c1, bx * 8 + 7);
        const cy0 = Math.max(r0, by * 8);
        const cy1 = Math.min(r1, by * 8 + 7);
        const whole = cx0 === bx * 8 && cy0 === by * 8 && cx1 === Math.min(w - 1, bx * 8 + 7) && cy1 === Math.min(h - 1, by * 8 + 7);
        if (whole && this.bmax[k] < zt) continue;
        for (let r = cy0; r <= cy1; r++) {
          const row = r * w;
          for (let c = cx0; c <= cx1; c++) if (!(D[row + c] < zt)) return false;
        }
      }
    }
    this.stats.hidden++;
    return true;
  }
}

// the outline's x extent on the horizontal line y (spanL, spanR), or null if it misses it
let spanL = 0;
let spanR = 0;
function spanAt(n, y) {
  let l = Infinity;
  let r = -Infinity;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = _hull[i * 2];
    const ay = _hull[i * 2 + 1];
    const bx = _hull[j * 2];
    const by = _hull[j * 2 + 1];
    if ((ay <= y && by >= y) || (by <= y && ay >= y)) {
      const x = ay === by ? Math.min(ax, bx) : ax + ((y - ay) / (by - ay)) * (bx - ax);
      const x2 = ay === by ? Math.max(ax, bx) : x;
      if (x < l) l = x;
      if (x2 > r) r = x2;
    }
  }
  if (l > r) return null;
  spanL = l;
  spanR = r;
  return true;
}

function nearHole(b, holes) {
  for (const s of holes) {
    const dx = Math.max(b.x0 - s.x, 0, s.x - b.x1);
    const dy = Math.max(b.y0 - s.y, 0, s.y - b.y1);
    const dz = Math.max(b.z0 - s.z, 0, s.z - b.z1);
    if (dx * dx + dy * dy + dz * dz < (s.r + 1) * (s.r + 1)) return true;
  }
  return false;
}
