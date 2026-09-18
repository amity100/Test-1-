// Collision world built from yaw-rotated boxes (OBBs) and wedges (ramps).
// Supports: capsule/cylinder character resolution with step-up, ground queries,
// raycasts for bullets and AI vision, overlap tests for module placement.
import * as THREE from 'three';

export class Collider {
  constructor({ x, y, z, hx, hy, hz, yaw = 0, wedge = false, tag = 'static', material = 'concrete', owner = null, passable = false, climbable = true }) {
    this.x = x; this.y = y; this.z = z;          // center
    this.hx = hx; this.hy = hy; this.hz = hz;    // half extents
    this.yaw = yaw;
    this.wedge = wedge;                          // sloped top: low at local -z, high at local +z
    this.tag = tag;
    this.material = material;
    this.owner = owner;
    this.passable = passable;                    // blocks bullets/vision but not movement (e.g. chain-link fence blocks nothing)
    this.blocksVision = true;
    this.blocksBullets = true;
    this.blocksMovement = !passable;
    this.climbable = climbable;
    this.id = Collider._next++;
    this.enabled = true;
    this._update();
  }
  _update() {
    this.cos = Math.cos(this.yaw); this.sin = Math.sin(this.yaw);
    const ex = Math.abs(this.cos) * this.hx + Math.abs(this.sin) * this.hz;
    const ez = Math.abs(this.sin) * this.hx + Math.abs(this.cos) * this.hz;
    this.minX = this.x - ex; this.maxX = this.x + ex;
    this.minZ = this.z - ez; this.maxZ = this.z + ez;
    this.minY = this.y - this.hy; this.maxY = this.y + this.hy;
  }
  set(x, y, z, yaw) { this.x = x; this.y = y; this.z = z; if (yaw !== undefined) this.yaw = yaw; this._update(); }
  get top() { return this.maxY; }
  get bottom() { return this.minY; }
  // world → local (2D)
  // Same convention as a three.js mesh with rotation.y = yaw: local +x → (cos, -sin), local +z → (sin, cos).
  toLocal(wx, wz) { const dx = wx - this.x, dz = wz - this.z; return [dx * this.cos - dz * this.sin, dx * this.sin + dz * this.cos]; }
  toWorld(lx, lz) { return [this.x + lx * this.cos + lz * this.sin, this.z - lx * this.sin + lz * this.cos]; }
  // height of the top surface at a world position (wedge-aware). Assumes inside footprint.
  surfaceHeightAt(wx, wz) {
    if (!this.wedge) return this.maxY;
    const [, lz] = this.toLocal(wx, wz);
    const t = THREE.MathUtils.clamp((lz + this.hz) / (2 * this.hz), 0, 1);
    return this.minY + t * (2 * this.hy);
  }
  // top-surface height at the footprint point nearest to a world position (wedge-aware)
  surfaceHeightNear(wx, wz) {
    if (!this.wedge) return this.maxY;
    const [, lz] = this.toLocal(wx, wz);
    const t = THREE.MathUtils.clamp((lz + this.hz) / (2 * this.hz), 0, 1);
    return this.minY + t * (2 * this.hy);
  }
  containsXZ(wx, wz, margin = 0) {
    const [lx, lz] = this.toLocal(wx, wz);
    return Math.abs(lx) <= this.hx + margin && Math.abs(lz) <= this.hz + margin;
  }
}
Collider._next = 1;

const CELL = 4;

export class CollisionWorld {
  constructor(bounds = { minX: -80, maxX: 80, minZ: -80, maxZ: 80 }) {
    this.bounds = bounds;
    this.colliders = [];
    this.cols = Math.ceil((bounds.maxX - bounds.minX) / CELL);
    this.rows = Math.ceil((bounds.maxZ - bounds.minZ) / CELL);
    this.grid = new Array(this.cols * this.rows);
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = [];
    this.groundY = 0;
    this.version = 0;
  }

  _cellRange(c) {
    const cx0 = Math.max(0, Math.floor((c.minX - this.bounds.minX) / CELL));
    const cx1 = Math.min(this.cols - 1, Math.floor((c.maxX - this.bounds.minX) / CELL));
    const cz0 = Math.max(0, Math.floor((c.minZ - this.bounds.minZ) / CELL));
    const cz1 = Math.min(this.rows - 1, Math.floor((c.maxZ - this.bounds.minZ) / CELL));
    return [cx0, cx1, cz0, cz1];
  }
  add(c) {
    this.colliders.push(c);
    const [cx0, cx1, cz0, cz1] = this._cellRange(c);
    for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) this.grid[z * this.cols + x].push(c);
    this.version++;
    return c;
  }
  remove(c) {
    const i = this.colliders.indexOf(c);
    if (i >= 0) this.colliders.splice(i, 1);
    const [cx0, cx1, cz0, cz1] = this._cellRange(c);
    for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) {
      const cell = this.grid[z * this.cols + x]; const j = cell.indexOf(c); if (j >= 0) cell.splice(j, 1);
    }
    this.version++;
  }
  move(c, x, y, z, yaw) { this.remove(c); c.set(x, y, z, yaw); this.add(c); }

  // Visit all colliders whose AABB intersects the query box (deduplicated).
  query(minX, minZ, maxX, maxZ, fn) {
    const cx0 = Math.max(0, Math.floor((minX - this.bounds.minX) / CELL));
    const cx1 = Math.min(this.cols - 1, Math.floor((maxX - this.bounds.minX) / CELL));
    const cz0 = Math.max(0, Math.floor((minZ - this.bounds.minZ) / CELL));
    const cz1 = Math.min(this.rows - 1, Math.floor((maxZ - this.bounds.minZ) / CELL));
    const stamp = ++CollisionWorld._stamp;
    for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) {
      const cell = this.grid[z * this.cols + x];
      for (let i = 0; i < cell.length; i++) {
        const c = cell[i];
        if (c._stamp === stamp || !c.enabled) continue;
        c._stamp = stamp;
        if (c.maxX < minX || c.minX > maxX || c.maxZ < minZ || c.minZ > maxZ) continue;
        if (fn(c) === false) return;
      }
    }
  }

  // ---- Ground / support ----
  // Highest walkable surface under (x,z) with top <= maxY. Returns {y, collider|null}.
  groundAt(x, z, maxY, radius = 0, ignore = null) {
    let best = this.groundY, bestC = null;
    this.query(x - radius, z - radius, x + radius, z + radius, (c) => {
      if (!c.blocksMovement || c === ignore || (ignore && c.owner && c.owner === ignore.owner && ignore.owner)) return;
      if (c.minY > maxY) return;
      // sample the footprint: center + 4 points around if radius > 0
      let h = -Infinity;
      if (radius > 0) {
        const pts = [[x, z], [x + radius * 0.7, z], [x - radius * 0.7, z], [x, z + radius * 0.7], [x, z - radius * 0.7]];
        for (const [px, pz] of pts) if (c.containsXZ(px, pz)) h = Math.max(h, c.surfaceHeightAt(px, pz));
      } else if (c.containsXZ(x, z)) h = c.surfaceHeightAt(x, z);
      if (h > best && h <= maxY) { best = h; bestC = c; }
    });
    return { y: best, collider: bestC };
  }

  // Lowest ceiling above (x,z) with bottom >= minY within radius.
  ceilingAt(x, z, minY, radius = 0.3) {
    let best = Infinity;
    this.query(x - radius, z - radius, x + radius, z + radius, (c) => {
      if (!c.blocksMovement) return;
      if (c.minY >= minY && c.minY < best && c.containsXZ(x, z, radius * 0.6)) best = c.minY;
    });
    return best;
  }

  // ---- Character resolution ----
  // Resolves a vertical cylinder (radius r) whose feet are at pos.y with height h against colliders.
  // Modifies pos in place; returns {grounded, groundY, groundCollider, hitWall}.
  resolveCharacter(pos, r, h, stepHeight, vel, ignoreOwner = null) {
    const res = { grounded: false, groundY: this.groundY, groundCollider: null, hitWall: false, blockedDir: null };
    // 1) Horizontal push-out. Only colliders that overlap the body band [feet+step, feet+h].
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      const feet = pos.y, head = pos.y + h;
      this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r, (c) => {
        if (!c.blocksMovement) return;
        if (c.owner && ignoreOwner && c.owner === ignoreOwner) return;
        if (c.maxY <= feet + stepHeight || c.minY >= head) return;
        // wedge: treat as ground if surface is within step reach
        if (c.wedge && c.containsXZ(pos.x, pos.z, 0)) {
          const sh = c.surfaceHeightAt(pos.x, pos.z);
          if (sh <= feet + stepHeight + 0.01) return; // walkable
        }
        const [lx, lz] = c.toLocal(pos.x, pos.z);
        // wedge low edge: allow entering from the low side even if body band overlaps (surface is low there)
        if (c.wedge) {
          const t = THREE.MathUtils.clamp((lz + c.hz) / (2 * c.hz), 0, 1);
          const sh = c.minY + t * 2 * c.hy;
          if (sh <= feet + stepHeight + 0.05 && Math.abs(lx) <= c.hx + r) return;
        }
        const px = c.hx + r - Math.abs(lx);
        const pz = c.hz + r - Math.abs(lz);
        if (px <= 0 || pz <= 0) return;
        // corner rounding: if outside both faces, check circle vs corner
        const ox = Math.abs(lx) - c.hx, oz = Math.abs(lz) - c.hz;
        if (ox > 0 && oz > 0) {
          const d = Math.hypot(ox, oz);
          if (d >= r) return;
          const push = r - d + 1e-4;
          const nx = (ox / d) * Math.sign(lx), nz = (oz / d) * Math.sign(lz);
          const wx = nx * c.cos + nz * c.sin, wz = -nx * c.sin + nz * c.cos;
          pos.x += wx * push; pos.z += wz * push;
          res.hitWall = true; pushed = true;
          return;
        }
        let nx = 0, nz = 0;
        if (px < pz) nx = Math.sign(lx) || 1; else nz = Math.sign(lz) || 1;
        const push = (px < pz ? px : pz) + 1e-4;
        const wx = nx * c.cos + nz * c.sin, wz = -nx * c.sin + nz * c.cos;
        pos.x += wx * push; pos.z += wz * push;
        // cancel velocity into the wall
        if (vel) { const vd = vel.x * wx + vel.z * wz; if (vd < 0) { vel.x -= wx * vd; vel.z -= wz * vd; } }
        res.hitWall = true; pushed = true;
      });
      if (!pushed) break;
    }
    // 2) Ground.
    const g = this.groundAt(pos.x, pos.z, pos.y + stepHeight, r * 0.75, ignoreOwner ? { owner: ignoreOwner } : null);
    res.groundY = g.y; res.groundCollider = g.collider;
    if (pos.y <= g.y + 0.001) {
      if (!vel || vel.y <= 0.01) { pos.y = g.y; res.grounded = true; if (vel && vel.y < 0) vel.y = 0; }
    } else if (pos.y - g.y < 0.06 && vel && vel.y <= 0) { pos.y = g.y; res.grounded = true; vel.y = 0; }
    // 3) Ceiling.
    const ceil = this.ceilingAt(pos.x, pos.z, pos.y + h * 0.5, r * 0.8);
    if (ceil < pos.y + h) { pos.y = Math.max(g.y, ceil - h); if (vel && vel.y > 0) vel.y = 0; }
    return res;
  }

  // Is the cylinder (x,z, radius r, from y0 to y1) free of movement-blocking colliders?
  cylinderFree(x, z, r, y0, y1, ignoreOwner = null) {
    let free = true;
    this.query(x - r, z - r, x + r, z + r, (c) => {
      if (!c.blocksMovement) return;
      if (c.owner && ignoreOwner && c.owner === ignoreOwner) return;
      if (c.maxY <= y0 + 0.02 || c.minY >= y1) return;
      if (c.wedge) { if (c.containsXZ(x, z, r) && c.surfaceHeightAt(x, z) <= y0 + 0.02) return; }
      const [lx, lz] = c.toLocal(x, z);
      const ox = Math.max(0, Math.abs(lx) - c.hx), oz = Math.max(0, Math.abs(lz) - c.hz);
      if (ox * ox + oz * oz < r * r) { free = false; return false; }
    });
    return free;
  }

  // OBB overlap test for placement. Returns the first overlapping collider or null.
  boxOverlap(x, y, z, hx, hy, hz, yaw, ignore = null, tolerance = 0.02) {
    const test = new Collider({ x, y, z, hx, hy, hz, yaw });
    let hit = null;
    this.query(test.minX, test.minZ, test.maxX, test.maxZ, (c) => {
      if (c === ignore || (ignore && c.owner && c.owner === ignore.owner) || !c.blocksMovement) return;
      if (c.maxY <= y - hy + tolerance || c.minY >= y + hy - tolerance) return;
      if (obbOverlap2D(test, c, -tolerance)) { hit = c; return false; }
    });
    return hit;
  }

  // ---- Raycasts ----
  // Returns {t, point, normal, collider} or null. Skips colliders for which filter(c) is false.
  raycast(origin, dir, maxDist, filter = null) {
    let best = null;
    // Walk cells along the ray (DDA on the coarse grid) — simple approach: query the ray's AABB in chunks.
    const steps = Math.max(1, Math.ceil(maxDist / (CELL * 2)));
    const stamp = ++CollisionWorld._stamp;
    for (let s = 0; s < steps; s++) {
      const t0 = (s / steps) * maxDist, t1 = ((s + 1) / steps) * maxDist;
      const ax = origin.x + dir.x * t0, az = origin.z + dir.z * t0;
      const bx = origin.x + dir.x * t1, bz = origin.z + dir.z * t1;
      const minX = Math.min(ax, bx), maxX = Math.max(ax, bx), minZ = Math.min(az, bz), maxZ = Math.max(az, bz);
      const cx0 = Math.max(0, Math.floor((minX - this.bounds.minX) / CELL));
      const cx1 = Math.min(this.cols - 1, Math.floor((maxX - this.bounds.minX) / CELL));
      const cz0 = Math.max(0, Math.floor((minZ - this.bounds.minZ) / CELL));
      const cz1 = Math.min(this.rows - 1, Math.floor((maxZ - this.bounds.minZ) / CELL));
      for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) {
        const cell = this.grid[z * this.cols + x];
        for (let i = 0; i < cell.length; i++) {
          const c = cell[i];
          if (c._rstamp === stamp || !c.enabled) continue;
          c._rstamp = stamp;
          if (filter && filter(c) === false) continue;
          const hit = rayOBB(origin, dir, c, best ? best.t : maxDist);
          if (hit && (!best || hit.t < best.t)) best = hit;
        }
      }
      if (best && best.t <= t1) break;
    }
    return best;
  }

  // Convenience: is there an unobstructed line between a and b (vision/bullets)?
  lineOfSight(a, b, filter = null) {
    const d = _dir.subVectors(b, a); const len = d.length(); if (len < 1e-4) return true;
    d.multiplyScalar(1 / len);
    const hit = this.raycast(a, d, len, filter ? (c) => c.blocksVision && filter(c) : (c) => c.blocksVision);
    return !hit;
  }
}
CollisionWorld._stamp = 0;
const _dir = new THREE.Vector3();

// Ray vs yaw-rotated box (and wedge top plane). Returns {t, point, normal, collider}.
function rayOBB(origin, dir, c, maxT) {
  // Transform into box local space (rotate about Y by -yaw)
  const ox = origin.x - c.x, oy = origin.y - c.y, oz = origin.z - c.z;
  const lx = ox * c.cos - oz * c.sin, lz = ox * c.sin + oz * c.cos;
  const dx = dir.x * c.cos - dir.z * c.sin, dz = dir.x * c.sin + dir.z * c.cos;
  const dy = dir.y;
  let tmin = 0, tmax = maxT, nAxis = -1, nSign = 0;
  const axes = [[lx, dx, c.hx], [oy, dy, c.hy], [lz, dz, c.hz]];
  for (let i = 0; i < 3; i++) {
    const [o, d, h] = axes[i];
    if (Math.abs(d) < 1e-8) { if (Math.abs(o) > h) return null; continue; }
    let t1 = (-h - o) / d, t2 = (h - o) / d, sgn = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; sgn = 1; }
    if (t1 > tmin) { tmin = t1; nAxis = i; nSign = sgn; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (nAxis < 0) return null; // origin inside box: ignore (avoid self-hits)
  let t = tmin;
  if (c.wedge) {
    // reject hits that are above the sloped surface; walk to the plane intersection if needed
    const px = lx + dx * t, py = oy + dy * t, pz = lz + dz * t;
    const surf = -c.hy + ((pz + c.hz) / (2 * c.hz)) * 2 * c.hy;
    if (py > surf + 1e-3) {
      // intersect with the slope plane: y = -hy + (z+hz)/(2hz)*2hy  => y - (hy/hz) z - 0 = 0 (local)
      const k = c.hy / c.hz;
      const denom = dy - k * dz;
      if (Math.abs(denom) < 1e-8) return null;
      const tp = (k * lz - oy) / denom;
      if (tp < t || tp > tmax) return null;
      const qx = lx + dx * tp, qz = lz + dz * tp;
      if (Math.abs(qx) > c.hx || Math.abs(qz) > c.hz) return null;
      t = tp;
      const nl = new THREE.Vector3(0, 1, -k).normalize();
      const n = new THREE.Vector3(nl.x * c.cos + nl.z * c.sin, nl.y, -nl.x * c.sin + nl.z * c.cos);
      return { t, point: new THREE.Vector3(origin.x + dir.x * t, origin.y + dir.y * t, origin.z + dir.z * t), normal: n, collider: c };
    }
  }
  let n;
  if (nAxis === 1) n = new THREE.Vector3(0, nSign, 0);
  else if (nAxis === 0) n = new THREE.Vector3(nSign * c.cos, 0, -nSign * c.sin);
  else n = new THREE.Vector3(nSign * c.sin, 0, nSign * c.cos);
  return { t, point: new THREE.Vector3(origin.x + dir.x * t, origin.y + dir.y * t, origin.z + dir.z * t), normal: n, collider: c };
}

// Separating axis test between two yaw boxes in XZ (shrunk by `shrink`).
export function obbOverlap2D(a, b, shrink = 0) {
  const axes = [[a.cos, -a.sin], [a.sin, a.cos], [b.cos, -b.sin], [b.sin, b.cos]];
  const ca = [a.x, a.z], cb = [b.x, b.z];
  for (const [ax, az] of axes) {
    const ra = Math.abs(ax * a.cos - az * a.sin) * (a.hx + shrink) + Math.abs(ax * a.sin + az * a.cos) * (a.hz + shrink);
    const rb = Math.abs(ax * b.cos - az * b.sin) * (b.hx + shrink) + Math.abs(ax * b.sin + az * b.cos) * (b.hz + shrink);
    const d = Math.abs((cb[0] - ca[0]) * ax + (cb[1] - ca[1]) * az);
    if (d > ra + rb) return false;
  }
  return true;
}

// Ray vs vertical capsule-ish character (cylinder body + head sphere). Returns {t, part} or null.
export function rayCharacter(origin, dir, pos, radius, height, maxT) {
  // cylinder from pos.y to pos.y + height*0.85 (body), sphere head at height*0.9
  const bodyTop = pos.y + height * 0.82;
  const headC = pos.y + height * 0.9, headR = height * 0.11;
  let best = null;
  // cylinder: solve in XZ
  const ox = origin.x - pos.x, oz = origin.z - pos.z;
  const a = dir.x * dir.x + dir.z * dir.z;
  if (a > 1e-8) {
    const b = 2 * (ox * dir.x + oz * dir.z), c = ox * ox + oz * oz - radius * radius;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const t1 = (-b - sq) / (2 * a);
      const t = t1 > 0 ? t1 : (-b + sq) / (2 * a);
      if (t > 0 && t < maxT) {
        const y = origin.y + dir.y * t;
        if (y >= pos.y && y <= bodyTop) best = { t, part: y > pos.y + height * 0.62 ? 'chest' : 'body' };
      }
    }
  }
  // head sphere
  const hx = origin.x - pos.x, hy = origin.y - headC, hz = origin.z - pos.z;
  const bb = 2 * (hx * dir.x + hy * dir.y + hz * dir.z), cc = hx * hx + hy * hy + hz * hz - headR * headR;
  const disc2 = bb * bb - 4 * cc;
  if (disc2 >= 0) {
    const t = (-bb - Math.sqrt(disc2)) / 2;
    if (t > 0 && t < maxT && (!best || t < best.t)) best = { t, part: 'head' };
  }
  return best;
}
