import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Collider, CollisionWorld, RayHit, RayOptions } from '../../src/world/collision';

// ---- brute-force reference (the pre-broadphase implementation) ----

function bfRaycast(cs: Collider[], origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, opts: RayOptions = {}): RayHit | null {
  let best = maxDist;
  let bestC: Collider | null = null;
  let bestAxis = 0;
  let bestSign = 0;
  const ox = origin.x, oy = origin.y, oz = origin.z;
  const dx = dir.x || 1e-9, dy = dir.y || 1e-9, dz = dir.z || 1e-9;
  const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
  for (const c of cs) {
    if (!c.enabled || c === opts.ignore) continue;
    if (opts.sight && c.seeThrough) continue;
    let t1 = (c.min.x - ox) * ix, t2 = (c.max.x - ox) * ix;
    let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
    let axis = 0, sign = dx > 0 ? -1 : 1;
    t1 = (c.min.y - oy) * iy; t2 = (c.max.y - oy) * iy;
    let a = Math.min(t1, t2), b = Math.max(t1, t2);
    if (a > tmin) { tmin = a; axis = 1; sign = dy > 0 ? -1 : 1; }
    if (b < tmax) tmax = b;
    t1 = (c.min.z - oz) * iz; t2 = (c.max.z - oz) * iz;
    a = Math.min(t1, t2); b = Math.max(t1, t2);
    if (a > tmin) { tmin = a; axis = 2; sign = dz > 0 ? -1 : 1; }
    if (b < tmax) tmax = b;
    if (tmax < 0 || tmin > tmax) continue;
    if (tmin < 0) continue;
    if (tmin < best) { best = tmin; bestC = c; bestAxis = axis; bestSign = sign; }
  }
  if (!bestC) return null;
  const normal = new THREE.Vector3();
  normal.setComponent(bestAxis, bestSign);
  return { point: origin.clone().addScaledVector(dir, best), normal, distance: best, collider: bestC };
}

function bfGround(cs: Collider[], x: number, z: number, r: number, maxY: number) {
  let g = -Infinity;
  for (const c of cs) {
    if (!c.enabled) continue;
    if (c.max.y > maxY || c.max.y <= g) continue;
    if (x + r < c.min.x || x - r > c.max.x || z + r < c.min.z || z - r > c.max.z) continue;
    g = c.max.y;
  }
  return g;
}

function bfCeiling(cs: Collider[], x: number, z: number, r: number, y: number) {
  let top = Infinity;
  for (const c of cs) {
    if (!c.enabled) continue;
    if (c.min.y < y || c.min.y >= top) continue;
    if (x + r < c.min.x || x - r > c.max.x || z + r < c.min.z || z - r > c.max.z) continue;
    top = c.min.y;
  }
  return top;
}

function bfResolve(cs: Collider[], pos: THREE.Vector3, r: number, feetY: number, headY: number, stepUp: number, skip?: (c: Collider) => boolean) {
  let hit = false;
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const c of cs) {
      if (!c.enabled) continue;
      if (c.max.y <= feetY + stepUp || c.min.y >= headY) continue;
      if (skip && skip(c)) continue;
      const cx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
      const cz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
      const ddx = pos.x - cx, ddz = pos.z - cz;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = r - d;
        pos.x += (ddx / d) * push;
        pos.z += (ddz / d) * push;
      } else {
        const l = pos.x - c.min.x, rr = c.max.x - pos.x, b = pos.z - c.min.z, f = c.max.z - pos.z;
        const m = Math.min(l, rr, b, f);
        if (m === l) pos.x = c.min.x - r;
        else if (m === rr) pos.x = c.max.x + r;
        else if (m === b) pos.z = c.min.z - r;
        else pos.z = c.max.z + r;
      }
      moved = true;
      hit = true;
    }
    if (!moved) break;
  }
  return hit;
}

function bfOverlaps(cs: Collider[], x: number, z: number, r: number, feetY: number, headY: number, skip?: (c: Collider) => boolean) {
  for (const c of cs) {
    if (!c.enabled) continue;
    if (c.max.y <= feetY + 0.05 || c.min.y >= headY) continue;
    if (skip && skip(c)) continue;
    const cx = Math.max(c.min.x, Math.min(x, c.max.x));
    const cz = Math.max(c.min.z, Math.min(z, c.max.z));
    const ddx = x - cx, ddz = z - cz;
    if (ddx * ddx + ddz * ddz < r * r) return true;
  }
  return false;
}

// ---- random world ----

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBox(w: CollisionWorld, R: () => number) {
  const u = R();
  // mostly small / medium props and walls, some huge slabs, some grid-aligned (shared faces, exact ties)
  const size = (s: number) => (u < 0.08 ? 60 + R() * 200 : u < 0.5 ? 0.05 + R() * 2 : 0.5 + R() * s);
  const snap = R() < 0.3;
  const q = (v: number) => (snap ? Math.round(v / 2) * 2 : v);
  const cx = q(-110 + R() * 220), cy = q(-5 + R() * 40), cz = q(-110 + R() * 220);
  const sx = snap ? 2 * (1 + Math.floor(R() * 4)) : size(30), sy = snap ? 2 : size(10), sz = snap ? 2 * (1 + Math.floor(R() * 4)) : size(30);
  const c = w.addBox(cx, cy, cz, sx, sy, sz, { seeThrough: R() < 0.15, noPortal: R() < 0.2 });
  if (R() < 0.1) c.enabled = false;
  return c;
}

function randomDir(R: () => number) {
  const k = R();
  if (k < 0.1) return new THREE.Vector3(...([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][Math.floor(R() * 6)] as [number, number, number]));
  if (k < 0.2) return new THREE.Vector3(R() - 0.5, 0, R() - 0.5).normalize();
  if (k < 0.3) return new THREE.Vector3(0, R() - 0.5, R() - 0.5).normalize();
  return new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize();
}

function sameHit(a: RayHit | null, b: RayHit | null) {
  if (!a || !b) return a === b;
  return a.collider === b.collider && a.distance === b.distance && a.normal.equals(b.normal) && a.point.equals(b.point);
}

function checkAll(w: CollisionWorld, R: () => number, n: number) {
  const cs = w.colliders;
  let fails = 0;
  for (let i = 0; i < n; i++) {
    const o = new THREE.Vector3(-130 + R() * 260, -10 + R() * 50, -130 + R() * 260);
    const d = randomDir(R);
    const maxDist = R() < 0.1 ? Infinity : 0.5 + R() * 300;
    const opts: RayOptions = { sight: R() < 0.5, ignore: R() < 0.2 ? cs[Math.floor(R() * cs.length)] : null };
    if (!sameHit(w.raycast(o, d, maxDist, opts), bfRaycast(cs, o, d, maxDist, opts))) fails++;

    const b = new THREE.Vector3(-130 + R() * 260, -10 + R() * 50, -130 + R() * 260);
    if (w.lineOfSight(o, b) !== !bfRaycast(cs, o, b.clone().sub(o).normalize(), o.distanceTo(b) - 0.05, { sight: true })) fails++;

    const x = o.x, z = o.z, r = R() * 1.5, y = o.y;
    if (w.groundAt(x, z, r, y) !== bfGround(cs, x, z, r, y)) fails++;
    if (w.ceilingAt(x, z, r, y) !== bfCeiling(cs, x, z, r, y)) fails++;
    const skip = R() < 0.5 ? (c: Collider) => c.id % 5 === 0 : undefined;
    if (w.overlapsCylinder(x, z, r, y, y + 1.8, skip) !== bfOverlaps(cs, x, z, r, y, y + 1.8, skip)) fails++;
    const p1 = o.clone(), p2 = o.clone();
    const rr = 0.1 + R() * 0.6;
    const h1 = w.resolveCircle(p1, rr, y, y + 1.8, 0.45, skip);
    const h2 = bfResolve(cs, p2, rr, y, y + 1.8, 0.45, skip);
    if (h1 !== h2 || !p1.equals(p2)) fails++;
  }
  return fails;
}

describe('CollisionWorld broadphase', () => {
  it('matches brute force exactly on random worlds and queries', () => {
    for (const seed of [1, 7, 42, 1234]) {
      const R = rng(seed);
      const w = new CollisionWorld();
      for (let i = 0; i < 400; i++) randomBox(w, R);
      expect(checkAll(w, R, 1500)).toBe(0);

      // mutate after the grid is built: add, move (lifts), remove, toggle
      for (let i = 0; i < 40; i++) randomBox(w, R);
      for (let i = 0; i < 40; i++) {
        const c = w.colliders[Math.floor(R() * w.colliders.length)];
        w.moveCollider(c, (R() - 0.5) * 30, (R() - 0.5) * 6, R() < 0.3 ? 0 : (R() - 0.5) * 30);
      }
      for (let i = 0; i < 20; i++) w.remove(w.colliders[Math.floor(R() * w.colliders.length)]);
      for (let i = 0; i < 20; i++) w.colliders[Math.floor(R() * w.colliders.length)].enabled = R() < 0.5;
      // far outside the original grid
      w.addBox(500, 0, 500, 4, 4, 4);
      expect(checkAll(w, R, 1500)).toBe(0);
    }
  });

  it('resolveCircle in dense clutter (order-dependent pushes) matches', () => {
    const R = rng(5);
    const w = new CollisionWorld();
    for (let i = 0; i < 300; i++) w.addBox(-6 + R() * 12, R() * 2, -6 + R() * 12, 0.1 + R() * 1.2, 0.5 + R() * 2, 0.1 + R() * 1.2);
    // stacked unit crates: shared faces, exact ray ties
    for (let i = 0; i < 60; i++) w.addBox(Math.round(-6 + R() * 12) + 0.5, Math.floor(R() * 3) + 0.5, Math.round(-6 + R() * 12) + 0.5, 1, 1, 1);
    let moved = 0;
    for (let i = 0; i < 3000; i++) {
      const p = new THREE.Vector3(-6 + R() * 12, R() * 1.5, -6 + R() * 12);
      const q = p.clone();
      const r = 0.2 + R() * 0.8;
      const a = w.resolveCircle(p, r, p.y, p.y + 1.8, 0.3);
      const b = bfResolve(w.colliders, q, r, q.y, q.y + 1.8, 0.3);
      expect(a).toBe(b);
      expect(p.equals(q)).toBe(true);
      if (a) moved++;
      const o = new THREE.Vector3(-8 + R() * 16, R() * 3, -8 + R() * 16);
      const d = randomDir(R);
      expect(sameHit(w.raycast(o, d, 30), bfRaycast(w.colliders, o, d, 30))).toBe(true);
    }
    expect(moved).toBeGreaterThan(1000);
  });

  it('resolveCircle deep inside a big box (long pushes) still matches', () => {
    const R = rng(99);
    const w = new CollisionWorld();
    w.addBox(0, 1, 0, 40, 2, 40);
    for (let i = 0; i < 60; i++) randomBox(w, R);
    for (let i = 0; i < 500; i++) {
      const p = new THREE.Vector3(-20 + R() * 40, 0, -20 + R() * 40);
      const q = p.clone();
      expect(w.resolveCircle(p, 0.4, -0.5, 1.5, 0.1)).toBe(bfResolve(w.colliders, q, 0.4, -0.5, 1.5, 0.1));
      expect(p.equals(q)).toBe(true);
    }
  });

  it('reports the deciding colliders and supports queryBox', () => {
    const w = new CollisionWorld();
    const floor = w.add({ x: -5, y: -1, z: -5 }, { x: 5, y: 0, z: 5 });
    const roof = w.add({ x: -5, y: 3, z: -5 }, { x: 5, y: 3.2, z: 5 });
    const wall = w.add({ x: 1, y: 0, z: -5 }, { x: 1.2, y: 3, z: 5 });
    expect(w.groundAt(0, 0, 0.2, 1)).toBe(0);
    expect(w.lastGround).toBe(floor);
    expect(w.ceilingAt(0, 0, 0.2, 1)).toBe(3);
    expect(w.lastCeiling).toBe(roof);
    const p = new THREE.Vector3(0.9, 0, 0);
    expect(w.resolveCircle(p, 0.3, 0, 1.8, 0.4)).toBe(true);
    expect(w.lastPush).toBe(wall);
    expect(p.x).toBeCloseTo(0.7, 9);
    expect(w.queryBox(0.9, -1, 1.3, 1)).toContain(wall);
  });
});
