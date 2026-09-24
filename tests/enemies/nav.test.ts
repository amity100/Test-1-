import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CollisionWorld } from '../../src/world/collision';
import { NavGrid } from '../../src/world/nav';

/** Skeleton-style floor at y 30 over the void, a column, a shaft, and the floor above at 36. */
function skeleton() {
  const w = new CollisionWorld();
  // the yard far below must not count as ground for floor 30
  w.add({ x: -20, y: -1, z: -20 }, { x: 40, y: 0, z: 40 });
  // floor slab x,z ∈ [0,20] with a 2×4 m shaft at x ∈ [14,16], z ∈ [2,6]
  w.add({ x: 0, y: 29.7, z: 0 }, { x: 14, y: 30, z: 20 });
  w.add({ x: 16, y: 29.7, z: 0 }, { x: 20, y: 30, z: 20 });
  w.add({ x: 14, y: 29.7, z: 0 }, { x: 16, y: 30, z: 2 });
  w.add({ x: 14, y: 29.7, z: 6 }, { x: 16, y: 30, z: 20 });
  // a column on floor 30, and the next slab up at 36
  w.add({ x: 9, y: 30, z: 9 }, { x: 11, y: 35.7, z: 11 });
  w.add({ x: 0, y: 35.7, z: 0 }, { x: 20, y: 36, z: 20 });
  return w;
}

describe('NavGrid (multi-floor)', () => {
  const grid = new NavGrid(skeleton(), { minX: -5, maxX: 25, minZ: -5, maxZ: 25, floorY: 30 });

  it('blocks the void around a floor at y 30', () => {
    expect(grid.floorY).toBe(30);
    expect(grid.walkable(5, 5)).toBe(true);
    expect(grid.walkable(-2, 5)).toBe(false); // off the west edge
    expect(grid.walkable(22, 10)).toBe(false); // off the east edge
    expect(grid.drop[grid.idx(-2, 5)]).toBe(1);
    expect(grid.drop[grid.idx(22, 10)]).toBe(1);
  });

  it('blocks the shaft, obstacles in the body band, but not the slab above', () => {
    expect(grid.walkable(15, 4)).toBe(false);
    expect(grid.drop[grid.idx(15, 4)]).toBe(1);
    expect(grid.walkable(10, 10)).toBe(false); // column
    expect(grid.drop[grid.idx(10, 10)]).toBe(0); // blocked, but not a drop
    expect(grid.walkable(5, 15)).toBe(true); // slab at 36 overhead is fine
  });

  it('measures distance to drops so AI keeps off ledges', () => {
    expect(grid.edgeDistance(0.5, 10)).toBeLessThan(1.5);
    expect(grid.nearEdge(0.5, 10)).toBe(true);
    expect(grid.edgeDistance(5, 5)).toBeGreaterThan(4);
    expect(grid.safeSpot(5, 5)).toBe(true);
    expect(grid.safeSpot(0.5, 10)).toBe(false);
    expect(grid.safeSpot(13.4, 4)).toBe(false); // beside the shaft
    // the column is an obstacle, not a drop: standing next to it is safe
    expect(grid.edgeDistance(8.2, 10)).toBeGreaterThan(4);
    expect(grid.edgeDistance(-3, 5)).toBe(0);
  });

  it('paths around the column and never through the shaft', () => {
    const path = grid.findPath(new THREE.Vector3(3, 30, 3), new THREE.Vector3(17, 30, 17));
    expect(path).not.toBeNull();
    let ax = 3, az = 3;
    for (const p of path!) {
      expect(grid.clearLine(ax, az, p.x, p.z)).toBe(true);
      expect(p.y).toBe(30);
      ax = p.x;
      az = p.z;
    }
    const last = path![path!.length - 1];
    expect(last.x).toBeCloseTo(17);
    expect(last.z).toBeCloseTo(17);
    const across = grid.findPath(new THREE.Vector3(13, 30, 4), new THREE.Vector3(17.5, 30, 4));
    expect(across).not.toBeNull();
    let x = 13, z = 4;
    for (const p of across!) {
      expect(grid.clearLine(x, z, p.x, p.z)).toBe(true);
      x = p.x;
      z = p.z;
    }
  });

  it('reuses output vectors between searches', () => {
    const out: THREE.Vector3[] = [];
    const n1 = grid.findPathInto(new THREE.Vector3(2, 30, 2), new THREE.Vector3(18, 30, 18), out);
    const first = out[0];
    const n2 = grid.findPathInto(new THREE.Vector3(2, 30, 18), new THREE.Vector3(18, 30, 2), out);
    expect(n1).toBeGreaterThan(0);
    expect(n2).toBeGreaterThan(0);
    expect(out[0]).toBe(first);
    expect(grid.findPathInto(new THREE.Vector3(2, 30, 2), new THREE.Vector3(-4, 30, -4), out)).toBeGreaterThan(0);
  });

  it('a man pressed against a wall starts on his side of it, not in the room behind', () => {
    // a floor, a wall across it at x 10.85..11 (a closed room beyond), a man right against it
    // (the lab's gate mouths: cells laid so the one past the wall is the nearer)
    const w = new CollisionWorld();
    w.add({ x: -18, y: 59.7, z: 22 }, { x: 18, y: 60, z: 58 });
    w.add({ x: 10.85, y: 60, z: 22 }, { x: 11, y: 63, z: 58 });
    const g = new NavGrid(w, { minX: -18, maxX: 18, minZ: 22, maxZ: 58, floorY: 60 });
    expect(g.cellCenter(g.nearestWalkable(10.84, 41, 3), new THREE.Vector3()).x).toBeGreaterThan(11);
    const at = new THREE.Vector3(10.84, 60, 41);
    expect(g.walkable(at.x, at.z)).toBe(false);
    const path = g.findPath(at, new THREE.Vector3(0, 60, 35));
    expect(path).not.toBeNull();
    expect(path!.every((p) => p.x < 10.85)).toBe(true);
    const i = g.nearestWalkable(at.x, at.z, 3, at.y);
    expect(g.cellCenter(i, new THREE.Vector3()).x).toBeLessThan(10.85);
  });

  it('reports no path between disconnected islands', () => {
    const w = new CollisionWorld();
    w.add({ x: 0, y: 29.7, z: 0 }, { x: 5, y: 30, z: 5 });
    w.add({ x: 10, y: 29.7, z: 0 }, { x: 15, y: 30, z: 5 });
    const g = new NavGrid(w, { minX: -1, maxX: 16, minZ: -1, maxZ: 6, floorY: 30 });
    expect(g.findPath(new THREE.Vector3(2, 30, 2), new THREE.Vector3(12, 30, 2))).toBeNull();
  });

  it('keeps working at floorY 0 (sea is not ground)', () => {
    const w = new CollisionWorld();
    w.add({ x: -10, y: -1, z: -10 }, { x: 10, y: 0, z: 10 }); // quay; beyond is sea
    w.add({ x: -1, y: 0, z: -4 }, { x: 1, y: 2.5, z: 4 }); // container
    const g = new NavGrid(w, { minX: -15, maxX: 15, minZ: -15, maxZ: 15 });
    expect(g.floorY).toBe(0);
    expect(g.walkable(-5, 0)).toBe(true);
    expect(g.walkable(12, 0)).toBe(false);
    expect(g.walkable(0, 0)).toBe(false);
    const path = g.findPath(new THREE.Vector3(-5, 0, 0), new THREE.Vector3(5, 0, 0));
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(1);
  });
});
