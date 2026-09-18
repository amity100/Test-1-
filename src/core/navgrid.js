// Layered navigation grid (2.5D). Each cell may hold several walkable surfaces
// (ground, top of a container, a catwalk...). A* runs over (cell, layer) nodes.
// Regions are rebuilt incrementally when the Architect moves a module.
import * as THREE from 'three';

const MAX_LAYERS = 4;
const AGENT_H = 1.7;
const AGENT_MARGIN = 0.3;

class Heap {
  constructor() { this.a = []; }
  push(node, f) { const a = this.a; a.push([f, node]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

export class NavGrid {
  constructor(world, bounds, cell = 0.5, stepHeight = 0.42) {
    this.world = world;
    this.bounds = bounds;
    this.cell = cell;
    this.step = stepHeight;
    this.cols = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.rows = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    const n = this.cols * this.rows;
    this.count = new Uint8Array(n);
    this.heights = new Float32Array(n * MAX_LAYERS);
    this.nearWall = new Uint8Array(n * MAX_LAYERS);
    // scratch for A*
    this.gScore = new Float32Array(n * MAX_LAYERS);
    this.came = new Int32Array(n * MAX_LAYERS);
    this.closed = new Uint32Array(n * MAX_LAYERS);
    this.stamp = 1;
    this.version = 0;
  }

  cellOf(x, z) {
    const cx = Math.floor((x - this.bounds.minX) / this.cell), cz = Math.floor((z - this.bounds.minZ) / this.cell);
    if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) return -1;
    return cz * this.cols + cx;
  }
  cellCenter(idx) {
    const cx = idx % this.cols, cz = (idx / this.cols) | 0;
    return [this.bounds.minX + (cx + 0.5) * this.cell, this.bounds.minZ + (cz + 0.5) * this.cell];
  }

  buildAll() { this._buildRange(0, 0, this.cols - 1, this.rows - 1); this.version++; }

  rebuildRegion(minX, minZ, maxX, maxZ) {
    const m = 1.2;
    const cx0 = Math.max(0, Math.floor((minX - m - this.bounds.minX) / this.cell));
    const cx1 = Math.min(this.cols - 1, Math.floor((maxX + m - this.bounds.minX) / this.cell));
    const cz0 = Math.max(0, Math.floor((minZ - m - this.bounds.minZ) / this.cell));
    const cz1 = Math.min(this.rows - 1, Math.floor((maxZ + m - this.bounds.minZ) / this.cell));
    this._buildRange(cx0, cz0, cx1, cz1);
    this.version++;
  }

  _buildRange(cx0, cz0, cx1, cz1) {
    const w = this.world, cands = [];
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      const idx = cz * this.cols + cx;
      const x = this.bounds.minX + (cx + 0.5) * this.cell, z = this.bounds.minZ + (cz + 0.5) * this.cell;
      cands.length = 0; cands.push([w.groundY, null]);
      const near = [];
      w.query(x - AGENT_MARGIN, z - AGENT_MARGIN, x + AGENT_MARGIN, z + AGENT_MARGIN, (c) => {
        if (!c.blocksMovement) return;
        if (c.tag === 'door' && c.owner && !c.owner.locked) return; // unlocked doors open for whoever walks up: passable when planning
        near.push(c);
        if (c.climbable && c.containsXZ(x, z, 0)) cands.push([c.surfaceHeightAt(x, z), c]);
      });
      cands.sort((a, b) => a[0] - b[0]);
      let n = 0;
      for (let i = 0; i < cands.length && n < MAX_LAYERS; i++) {
        const [h, src] = cands[i];
        if (n > 0 && Math.abs(h - this.heights[idx * MAX_LAYERS + n - 1]) < 0.05) continue;
        let blocked = false, wall = false, superseded = false;
        for (let k = 0; k < near.length; k++) {
          const c = near[k];
          if (c === src) continue;
          if (c.maxY <= h + this.step + 0.01 || c.minY >= h + AGENT_H) continue;
          if (c.wedge) {
            // A ramp is walkable ground: where it covers the cell its own surface replaces this candidate
            // (no phantom floor under the low end), and its low edge never blocks the cell in front of it.
            const sh = c.surfaceHeightNear(x, z);
            if (sh <= h + this.step + 0.01) { if (c.climbable && sh >= h - 0.05 && c.containsXZ(x, z, 0)) { superseded = true; break; } continue; }
          }
          if (c.containsXZ(x, z, AGENT_MARGIN)) { blocked = true; break; }
        }
        if (blocked || superseded) continue;
        // near-wall flag (for path cost): any blocker within 0.75m
        for (let k = 0; k < near.length && !wall; k++) {
          const c = near[k];
          if (c === src) continue;
          if (c.maxY <= h + this.step + 0.01 || c.minY >= h + AGENT_H) continue;
          if (c.containsXZ(x, z, 0.75)) wall = true;
        }
        this.heights[idx * MAX_LAYERS + n] = h;
        this.nearWall[idx * MAX_LAYERS + n] = wall ? 1 : 0;
        n++;
      }
      this.count[idx] = n;
    }
  }

  // Find the layer in cell idx whose height is closest to y (within tol). Returns layer or -1.
  layerAt(idx, y, tol = 0.6) {
    if (idx < 0) return -1;
    const n = this.count[idx]; let best = -1, bd = tol;
    for (let i = 0; i < n; i++) { const d = Math.abs(this.heights[idx * MAX_LAYERS + i] - y); if (d < bd) { bd = d; best = i; } }
    return best;
  }

  // Nearest walkable node to a world position (spiral search). Returns node id or -1.
  nearestNode(pos, maxRadius = 3) {
    const cx = Math.floor((pos.x - this.bounds.minX) / this.cell), cz = Math.floor((pos.z - this.bounds.minZ) / this.cell);
    const r = Math.ceil(maxRadius / this.cell);
    let best = -1, bestD = Infinity;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= this.cols || z >= this.rows) continue;
      const idx = z * this.cols + x; const n = this.count[idx];
      for (let i = 0; i < n; i++) {
        const h = this.heights[idx * MAX_LAYERS + i];
        const dy = h - pos.y;
        if (dy > 1.0 || dy < -2.5) continue;
        const d = dx * dx + dz * dz + dy * dy * 4;
        if (d < bestD) { bestD = d; best = idx * MAX_LAYERS + i; }
      }
    }
    return best;
  }

  nodePos(node) {
    const idx = (node / MAX_LAYERS) | 0, layer = node % MAX_LAYERS;
    const [x, z] = this.cellCenter(idx);
    return new THREE.Vector3(x, this.heights[idx * MAX_LAYERS + layer], z);
  }

  isWalkable(x, y, z, tol = 0.6) { return this.layerAt(this.cellOf(x, z), y, tol) >= 0; }

  // Straight-line walkability between two points (same rough height), sampled.
  lineWalkable(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y;
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / (this.cell * 0.5)));
    let lastY = a.y;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const idx = this.cellOf(a.x + dx * t, a.z + dz * t);
      const layer = this.layerAt(idx, lastY, this.step + 0.05);
      if (layer < 0) return false;
      lastY = this.heights[idx * MAX_LAYERS + layer];
    }
    return Math.abs(lastY - b.y) < this.step + 0.05 && Math.abs(dy) < 3;
  }

  // A* from world point a to world point b. Returns array of Vector3 waypoints (excluding start) or null.
  findPath(a, b, opts = {}) {
    this.searches = (this.searches || 0) + 1;
    const start = this.nearestNode(a, 2.5), goal = this.nearestNode(b, opts.goalRadius ?? 3);
    if (start < 0 || goal < 0) return null;
    if (start === goal) return [this.nodePos(goal)];
    const maxExpand = opts.maxExpand ?? 24000;
    const stamp = ++this.stamp;
    const closed = this.closed, g = this.gScore, came = this.came, H = this.heights, cols = this.cols, rows = this.rows;
    const gi = (goal / MAX_LAYERS) | 0, gx = gi % cols, gz = (gi / cols) | 0, gy = H[goal];
    const heur = (idx, h) => { const x = idx % cols, z = (idx / cols) | 0; const ddx = Math.abs(x - gx), ddz = Math.abs(z - gz); return (Math.max(ddx, ddz) + 0.4142 * Math.min(ddx, ddz)) * this.cell + Math.abs(h - gy) * 0.5; };
    const open = new Heap();
    g[start] = 0; came[start] = -1; open.push(start, heur((start / MAX_LAYERS) | 0, H[start]));
    let expanded = 0, bestNode = start, bestH = Infinity;
    const avoid = opts.avoid; // optional fn(x,z,y)->penalty
    while (open.size) {
      const [, cur] = open.pop();
      if (closed[cur] === stamp) continue;
      closed[cur] = stamp;
      if (cur === goal) { bestNode = goal; break; }
      if (++expanded > maxExpand) break;
      this.expandedTotal = (this.expandedTotal || 0) + 1;
      const idx = (cur / MAX_LAYERS) | 0, h = H[cur];
      const hv = heur(idx, h); if (hv < bestH) { bestH = hv; bestNode = cur; }
      const x = idx % cols, z = (idx / cols) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
        const nidx = nz * cols + nx;
        const layer = this.layerAt(nidx, h, this.step + 0.02);
        if (layer < 0) continue;
        if (dx && dz) { // no corner cutting
          if (this.layerAt(z * cols + nx, h, this.step + 0.02) < 0 || this.layerAt(nz * cols + x, h, this.step + 0.02) < 0) continue;
        }
        const nn = nidx * MAX_LAYERS + layer;
        if (closed[nn] === stamp) continue;
        const nh = H[nn];
        let cost = (dx && dz ? 1.4142 : 1) * this.cell + Math.abs(nh - h) * 0.6;
        if (this.nearWall[nn]) cost += 0.12;
        if (avoid) cost += avoid(this.bounds.minX + (nx + 0.5) * this.cell, this.bounds.minZ + (nz + 0.5) * this.cell, nh);
        const ng = g[cur] + cost;
        if (came[nn] !== undefined && closed[nn] !== stamp && g[nn] <= ng && this._seen(nn, stamp)) continue;
        g[nn] = ng; came[nn] = cur; this._mark(nn, stamp);
        open.push(nn, ng + heur(nidx, nh));
      }
    }
    if (bestNode === start) return null;
    const path = [];
    for (let n = bestNode; n !== -1 && n !== start; n = came[n]) path.push(this.nodePos(n));
    path.reverse();
    if (bestNode === goal) { const last = path[path.length - 1]; if (last) { last.x = b.x; last.z = b.z; if (Math.abs(last.y - b.y) > 0.6) { last.x = path[path.length - 1].x; } } }
    return this._smooth(a, path);
  }
  // per-search "seen" bookkeeping using a second stamp array
  _seen(n, stamp) { if (!this._seenArr) this._seenArr = new Uint32Array(this.closed.length); return this._seenArr[n] === stamp; }
  _mark(n, stamp) { if (!this._seenArr) this._seenArr = new Uint32Array(this.closed.length); this._seenArr[n] = stamp; }

  _smooth(start, path) {
    if (path.length < 3) return path;
    const out = [];
    let cur = start, i = 0;
    while (i < path.length) {
      let j = path.length - 1;
      while (j > i + 1 && !this.lineWalkable(cur, path[j])) j--;
      // never skip a big height change (ramps): keep intermediate points if height differs
      out.push(path[j]); cur = path[j]; i = j + 1;
      if (j === i - 1) continue;
    }
    return out;
  }

  // Random walkable point around a center within radius (for search/patrol wandering).
  randomPointNear(center, radius, tries = 12) {
    for (let t = 0; t < tries; t++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
      const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
      const idx = this.cellOf(x, z); const layer = this.layerAt(idx, center.y, 1.2);
      if (layer >= 0) return new THREE.Vector3(x, this.heights[idx * MAX_LAYERS + layer], z);
    }
    return null;
  }
}
