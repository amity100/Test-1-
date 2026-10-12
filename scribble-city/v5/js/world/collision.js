// Static world collision: axis-aligned boxes in a uniform grid, ray casts (DDA),
// circle push-out for walkers/vehicles and a walkability grid for enemy navigation.

const CELL = 8;
const GX0 = -310;
const GZ0 = -470;
const GW = 48;
const GH = 110;

export class Collision {
  constructor() {
    this.boxes = [];
    this.cells = new Array(GW * GH);
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
    this.stamp = 1;
    this.marks = new Uint32Array(0);
  }

  addBox(x0, z0, x1, z1, y0, y1, tag = 'wall', data = null) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    const id = this.boxes.length;
    this.boxes.push({ x0, z0, x1, z1, y0, y1, tag, data, id, alive: true });
    const cx0 = Math.max(0, Math.floor((x0 - GX0) / CELL));
    const cx1 = Math.min(GW - 1, Math.floor((x1 - GX0) / CELL));
    const cz0 = Math.max(0, Math.floor((z0 - GZ0) / CELL));
    const cz1 = Math.min(GH - 1, Math.floor((z1 - GZ0) / CELL));
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) this.cells[cz * GW + cx].push(id);
    if (this.marks.length < this.boxes.length) {
      const m = new Uint32Array(Math.max(1024, this.boxes.length * 2));
      m.set(this.marks);
      this.marks = m;
    }
    return id;
  }

  addCircle(x, z, r, y0, y1, tag = 'pole', data = null) {
    return this.addBox(x - r, z - r, x + r, z + r, y0, y1, tag, data);
  }

  remove(id) {
    const b = this.boxes[id];
    if (b) b.alive = false;
  }

  // Calls fn(box) once per box overlapping the xz rectangle.
  forEachIn(x0, z0, x1, z1, fn) {
    const st = ++this.stamp;
    const cx0 = Math.max(0, Math.floor((x0 - GX0) / CELL));
    const cx1 = Math.min(GW - 1, Math.floor((x1 - GX0) / CELL));
    const cz0 = Math.max(0, Math.floor((z0 - GZ0) / CELL));
    const cz1 = Math.min(GH - 1, Math.floor((z1 - GZ0) / CELL));
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const list = this.cells[cz * GW + cx];
        for (let i = 0; i < list.length; i++) {
          const id = list[i];
          if (this.marks[id] === st) continue;
          this.marks[id] = st;
          const b = this.boxes[id];
          if (!b.alive) continue;
          if (b.x1 < x0 || b.x0 > x1 || b.z1 < z0 || b.z0 > z1) continue;
          if (fn(b) === true) return;
        }
      }
    }
  }

  // Is the point inside any solid box?
  pointInside(x, y, z, pad = 0) {
    let hit = null;
    this.forEachIn(x - pad, z - pad, x + pad, z + pad, (b) => {
      if (y >= b.y0 - pad && y <= b.y1 + pad && x >= b.x0 - pad && x <= b.x1 + pad && z >= b.z0 - pad && z <= b.z1 + pad) {
        hit = b;
        return true;
      }
      return false;
    });
    return hit;
  }

  /**
   * Push a vertical cylinder (feet at pos.y, given height) out of boxes.
   * Boxes whose top is within stepUp of the feet become floor instead.
   * prevY: where the feet were a step ago (a fall that came down through the top of a box lands
   * on it, however fast; ROADMAP 5.1, not with ?classic).
   * Returns { floor, hitWall, nx, nz }.
   */
  resolveCylinder(pos, radius, height, stepUp = 0.45, prevY = null) {
    const out = { floor: -Infinity, hitWall: false, nx: 0, nz: 0, box: null };
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      this.forEachIn(pos.x - radius, pos.z - radius, pos.x + radius, pos.z + radius, (b) => {
        if (pos.y + height <= b.y0 || pos.y >= b.y1) {
          // above or below; may be a floor candidate
          if (pos.y >= b.y1 - 0.02) {
            const cx = Math.max(b.x0, Math.min(pos.x, b.x1));
            const cz = Math.max(b.z0, Math.min(pos.z, b.z1));
            const dx = pos.x - cx;
            const dz = pos.z - cz;
            if (dx * dx + dz * dz < radius * radius * 0.6) out.floor = Math.max(out.floor, b.y1);
          }
          return false;
        }
        const cx = Math.max(b.x0, Math.min(pos.x, b.x1));
        const cz = Math.max(b.z0, Math.min(pos.z, b.z1));
        let dx = pos.x - cx;
        let dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) return false;
        // can we step onto it? (or did we come down onto it?)
        if ((b.y1 - pos.y <= stepUp || (prevY !== null && prevY >= b.y1 - 0.02)) && b.tag !== 'water') {
          out.floor = Math.max(out.floor, b.y1);
          return false;
        }
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = radius - d;
          dx /= d;
          dz /= d;
          pos.x += dx * push;
          pos.z += dz * push;
          out.nx = dx;
          out.nz = dz;
        } else {
          // center inside the box: push out along the smallest axis
          const pl = pos.x - b.x0;
          const pr = b.x1 - pos.x;
          const pn = pos.z - b.z0;
          const ps = b.z1 - pos.z;
          const m = Math.min(pl, pr, pn, ps);
          if (m === pl) { pos.x = b.x0 - radius; out.nx = -1; out.nz = 0; }
          else if (m === pr) { pos.x = b.x1 + radius; out.nx = 1; out.nz = 0; }
          else if (m === pn) { pos.z = b.z0 - radius; out.nx = 0; out.nz = -1; }
          else { pos.z = b.z1 + radius; out.nx = 0; out.nz = 1; }
        }
        out.hitWall = true;
        out.box = b;
        moved = true;
        return false;
      });
      if (!moved) break;
    }
    return out;
  }

  /**
   * Ray cast against boxes using a DDA walk through grid cells.
   * ignoreTag: a tag, a Set of tags or a single box to pass through.
   * Returns { t, x, y, z, nx, ny, nz, box } or null.
   */
  raycast(ox, oy, oz, dx, dy, dz, maxT, ignoreTag = null) {
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len;
    dy /= len;
    dz /= len;
    let cx = Math.floor((ox - GX0) / CELL);
    let cz = Math.floor((oz - GZ0) / CELL);
    const stepX = dx > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = Math.abs(dx) > 1e-9 ? CELL / Math.abs(dx) : Infinity;
    const tDeltaZ = Math.abs(dz) > 1e-9 ? CELL / Math.abs(dz) : Infinity;
    const nextX = GX0 + (cx + (dx > 0 ? 1 : 0)) * CELL;
    const nextZ = GZ0 + (cz + (dz > 0 ? 1 : 0)) * CELL;
    let tMaxX = Math.abs(dx) > 1e-9 ? (nextX - ox) / dx : Infinity;
    let tMaxZ = Math.abs(dz) > 1e-9 ? (nextZ - oz) / dz : Infinity;
    const st = ++this.stamp;
    let best = null;
    let bestT = maxT;
    let tCell = 0;
    for (let guard = 0; guard < 400; guard++) {
      if (cx >= 0 && cx < GW && cz >= 0 && cz < GH) {
        const list = this.cells[cz * GW + cx];
        for (let i = 0; i < list.length; i++) {
          const id = list[i];
          if (this.marks[id] === st) continue;
          this.marks[id] = st;
          const b = this.boxes[id];
          if (!b.alive || (ignoreTag && ignored(b, ignoreTag))) continue;
          const hit = rayBox(ox, oy, oz, dx, dy, dz, b, bestT);
          if (hit && hit.t < bestT) {
            bestT = hit.t;
            best = hit;
            best.box = b;
          }
        }
      }
      if (best && bestT <= Math.min(tMaxX, tMaxZ)) break;
      if (tMaxX < tMaxZ) {
        tCell = tMaxX;
        tMaxX += tDeltaX;
        cx += stepX;
      } else {
        tCell = tMaxZ;
        tMaxZ += tDeltaZ;
        cz += stepZ;
      }
      if (tCell > bestT || tCell > maxT) break;
    }
    if (best) {
      best.x = ox + dx * best.t;
      best.y = oy + dy * best.t;
      best.z = oz + dz * best.t;
    }
    return best;
  }

  lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-3) return true;
    const h = this.raycast(ax, ay, az, dx, dy, dz, d - 0.2);
    return !h;
  }
}

// ignore: a tag, a Set of tags or one particular box
function ignored(b, ig) {
  if (typeof ig === 'string') return b.tag === ig;
  if (ig instanceof Set) return ig.has(b.tag);
  return b === ig;
}

function rayBox(ox, oy, oz, dx, dy, dz, b, maxT) {
  let tmin = 0;
  let tmax = maxT;
  let nAxis = -1;
  let nSign = 0;
  // x
  if (Math.abs(dx) < 1e-9) {
    if (ox < b.x0 || ox > b.x1) return null;
  } else {
    let t1 = (b.x0 - ox) / dx;
    let t2 = (b.x1 - ox) / dx;
    let s = -1;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
      s = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nAxis = 0;
      nSign = s;
    }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (Math.abs(dy) < 1e-9) {
    if (oy < b.y0 || oy > b.y1) return null;
  } else {
    let t1 = (b.y0 - oy) / dy;
    let t2 = (b.y1 - oy) / dy;
    let s = -1;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
      s = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nAxis = 1;
      nSign = s;
    }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (Math.abs(dz) < 1e-9) {
    if (oz < b.z0 || oz > b.z1) return null;
  } else {
    let t1 = (b.z0 - oz) / dz;
    let t2 = (b.z1 - oz) / dz;
    let s = -1;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
      s = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nAxis = 2;
      nSign = s;
    }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (nAxis < 0) {
    // origin inside the box
    return { t: 0, nx: -dx, ny: -dy, nz: -dz };
  }
  return { t: tmin, nx: nAxis === 0 ? nSign : 0, ny: nAxis === 1 ? nSign : 0, nz: nAxis === 2 ? nSign : 0 };
}

/**
 * Walkability grid (2m cells) for enemy path finding, with BFS flow fields.
 */
export class NavGrid {
  constructor(collision, bounds, cell = 2) {
    this.cell = cell;
    this.x0 = bounds.minX;
    this.z0 = bounds.minZ;
    this.w = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.h = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    this.blocked = new Uint8Array(this.w * this.h);
    this.collision = collision;
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) this.computeCell(i, j);
    this.dist = new Float32Array(this.w * this.h);
    this.queue = new Int32Array(this.w * this.h);
  }

  computeCell(i, j) {
    const cell = this.cell;
    const pad = 0.45;
    const x0 = this.x0 + i * cell;
    const z0 = this.z0 + j * cell;
    let solid = false;
    this.collision.forEachIn(x0 - pad, z0 - pad, x0 + cell + pad, z0 + cell + pad, (b) => {
      if (b.alive && b.y1 > 0.7 && b.y0 < 1.6) {
        // require real overlap (not just touching the padded border)
        const ox = Math.min(b.x1, x0 + cell + pad) - Math.max(b.x0, x0 - pad);
        const oz = Math.min(b.z1, z0 + cell + pad) - Math.max(b.z0, z0 - pad);
        if (ox > 0.35 && oz > 0.35) {
          solid = true;
          return true;
        }
      }
      return false;
    });
    this.blocked[j * this.w + i] = solid ? 1 : 0;
  }

  // something was removed (or added) in this area
  refresh(x0, z0, x1, z1) {
    const i0 = Math.max(0, Math.floor((x0 - this.x0) / this.cell));
    const i1 = Math.min(this.w - 1, Math.floor((x1 - this.x0) / this.cell));
    const j0 = Math.max(0, Math.floor((z0 - this.z0) / this.cell));
    const j1 = Math.min(this.h - 1, Math.floor((z1 - this.z0) / this.cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.computeCell(i, j);
  }

  idx(x, z) {
    const i = Math.floor((x - this.x0) / this.cell);
    const j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return j * this.w + i;
  }

  center(id) {
    const i = id % this.w;
    const j = Math.floor(id / this.w);
    return [this.x0 + (i + 0.5) * this.cell, this.z0 + (j + 0.5) * this.cell];
  }

  walkable(x, z) {
    const id = this.idx(x, z);
    return id >= 0 && !this.blocked[id];
  }

  nearestWalkable(x, z, maxR = 6) {
    let id = this.idx(x, z);
    if (id >= 0 && !this.blocked[id]) return id;
    const i0 = Math.floor((x - this.x0) / this.cell);
    const j0 = Math.floor((z - this.z0) / this.cell);
    for (let r = 1; r <= maxR; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.abs(di) !== r && Math.abs(dj) !== r) continue;
          const i = i0 + di;
          const j = j0 + dj;
          if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
          id = j * this.w + i;
          if (!this.blocked[id]) return id;
        }
      }
    }
    return -1;
  }

  // Breadth-first distance field from a target (8-connected, limited radius in cells).
  flowFrom(x, z, maxCells = 70, out = null) {
    const dist = out || this.dist;
    dist.fill(1e9);
    const start = this.nearestWalkable(x, z);
    if (start < 0) return dist;
    const q = this.queue;
    let head = 0;
    let tail = 0;
    q[tail++] = start;
    dist[start] = 0;
    const w = this.w;
    const h = this.h;
    const bl = this.blocked;
    while (head < tail) {
      const id = q[head++];
      const d = dist[id];
      if (d > maxCells) continue;
      const i = id % w;
      const j = (id - i) / w;
      for (let k = 0; k < 8; k++) {
        const di = k === 0 ? 1 : k === 1 ? -1 : k === 2 ? 0 : k === 3 ? 0 : k === 4 ? 1 : k === 5 ? 1 : k === 6 ? -1 : -1;
        const dj = k === 0 ? 0 : k === 1 ? 0 : k === 2 ? 1 : k === 3 ? -1 : k === 4 ? 1 : k === 5 ? -1 : k === 6 ? 1 : -1;
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        const nid = nj * w + ni;
        if (bl[nid]) continue;
        if (di !== 0 && dj !== 0 && (bl[j * w + ni] || bl[nj * w + i])) continue;
        const nd = d + (di !== 0 && dj !== 0 ? 1.414 : 1);
        if (nd < dist[nid]) {
          dist[nid] = nd;
          q[tail++] = nid;
          if (tail >= q.length) tail = q.length - 1;
        }
      }
    }
    return dist;
  }

  // Direction (unit xz) that descends the given distance field from (x,z).
  descend(dist, x, z) {
    const id = this.idx(x, z);
    if (id < 0) return null;
    const i = id % this.w;
    const j = Math.floor(id / this.w);
    let best = dist[id];
    let bx = 0;
    let bz = 0;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= this.w || nj >= this.h) continue;
        const nid = nj * this.w + ni;
        if (this.blocked[nid]) continue;
        if (di !== 0 && dj !== 0 && (this.blocked[j * this.w + ni] || this.blocked[nj * this.w + i])) continue;
        if (dist[nid] < best) {
          best = dist[nid];
          bx = di;
          bz = dj;
        }
      }
    }
    if (!bx && !bz) return null;
    // aim toward the center of the chosen neighbor cell (avoids wall hugging)
    const [cx, cz] = this.center((j + bz) * this.w + (i + bx));
    const ddx = cx - x;
    const ddz = cz - z;
    const l = Math.hypot(ddx, ddz) || 1;
    return [ddx / l, ddz / l];
  }
}
