import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCombatLab } from '../../src/world/combatlab';
import type { TowerBuild } from '../../src/world/tower';
import { AIM_WAVES_C, PLAT_Y, PLATFORMS_C } from '../../src/world/combatlab/compound';
import { POOL } from '../../src/world/combatlab/layout';
import { NavGrid } from '../../src/world/nav';
import { KIND } from '../../src/actors/tuning';
import { AIMP, fitSnap, nearSpot, placeExit, type Spot } from '../../src/game/aimportal';
import { POSTS } from '../../src/world/combatlab/compound';

let L: TowerBuild;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

beforeAll(() => {
  L = buildCombatLab(null, false, { headless: true });
});

describe('AIM PORTAL: the lab it plays in', () => {
  it('sealed panels refuse portals (a ray at one is refused, at the deck is not)', () => {
    const sealed = L.world.colliders.filter((c) => c.tag === 'sealed');
    expect(sealed.length).toBeGreaterThanOrEqual(2);
    const ground = (x: number, z: number, y: number) => L.world.groundAt(x, z, 0.3, y);
    for (const c of sealed) {
      const cx = (c.min.x + c.max.x) / 2, cz = (c.min.z + c.max.z) / 2;
      // (aimed at its broad face from the open side: the pocket's panel from inside, the others from the street)
      const broadZ = c.max.z - c.min.z < c.max.x - c.min.x;
      const dirs = broadZ ? [V(0, 0, 1), V(0, 0, -1)] : [V(1, 0, 0), V(-1, 0, 0)];
      let refused = 0;
      for (const dir of dirs) {
        const from = V(cx - dir.x * 4, 1.6, cz - dir.z * 4);
        const s = placeExit(L.world, from, dir, from, null, ground);
        if (!s.ok && s.reason === 'sealed') refused++;
      }
      expect(refused, `panel (${c.min.x}, ${c.min.z})`).toBeGreaterThanOrEqual(1);
    }
    // the deck takes one
    const o = V(0, 1.6, -22);
    const floor = placeExit(L.world, o, V(0, -0.3, 1).normalize(), o, null, (x, z, y) => L.world.groundAt(x, z, 0.3, y));
    expect(floor.ok).toBe(true);
    expect(floor.surface).toBe('floor');
    // and an ordinary wall
    const wall = placeExit(L.world, V(0, 1.6, -24), V(0, 0, 1), V(0, 1.6, -24), null, ground);
    expect(wall.ok).toBe(true);
    expect(wall.surface).toBe('wall');
  });

  it('perches stand on the deck (nav on top), the void edge and the pool are still there', () => {
    const z = L.zones[0];
    for (const p of PLATFORMS_C) {
      const g = L.world.groundAt((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, 0.3, PLAT_Y + 0.1);
      expect(g).toBeCloseTo(PLAT_Y, 2);
      expect(z.nav.some((n) => Math.abs((n.floorY ?? 0) - PLAT_Y) < 0.01 && n.minX <= p.x0 && n.maxX >= p.x1 && n.minZ <= p.z0 && n.maxZ >= p.z1)).toBe(true);
    }
    expect(L.isSea(V((POOL.x0 + POOL.x1) / 2, 0, (POOL.z0 + POOL.z1) / 2))).toBe(true);
    expect(L.killYAt!(V(0, 0, 0))).toBeLessThan(-5);
  });

  it('every man of its five waves stands on nav, on the ground, with room', () => {
    const z = L.zones[0];
    const grids = z.nav.map((n) => new NavGrid(L.world, n));
    const layerOf = (p: THREE.Vector3) => z.nav.findIndex((n) => p.x >= n.minX && p.x <= n.maxX && p.z >= n.minZ && p.z <= n.maxZ && Math.abs((n.floorY ?? 0) - p.y) <= 0.3);
    for (const [wi, w] of AIM_WAVES_C.entries()) {
      for (const s of w.spawns) {
        const where = `A${wi + 1} ${s.aim} (${s.post.x}, ${s.post.y}, ${s.post.z})`;
        const li = layerOf(s.post);
        expect(li, `${where} on a layer`).toBeGreaterThanOrEqual(0);
        expect(grids[li].walkable(s.post.x, s.post.z), `${where} walkable`).toBe(true);
        const g = L.world.groundAt(s.post.x, s.post.z, 0.3, s.post.y + 0.3);
        expect(Math.abs(g - s.post.y), `${where} ground`).toBeLessThan(0.05);
        const k = KIND[s.kind];
        for (const c of L.world.colliders) {
          if (!c.enabled || c.max.y <= s.post.y + 0.05 || c.min.y >= s.post.y + k.height) continue;
          const cx = Math.max(c.min.x, Math.min(s.post.x, c.max.x)), cz = Math.max(c.min.z, Math.min(s.post.z, c.max.z));
          expect((s.post.x - cx) ** 2 + (s.post.z - cz) ** 2, `${where} clear of ${c.tag}`).toBeGreaterThan(k.radius * k.radius);
        }
        expect(s.aim).toBeTruthy();
      }
    }
  });

  it('in the compound every exit fits where it opens: none in a wall, none hanging off an edge, a door on a wall stands on the floor', () => {
    const w = L.world;
    const grid = new NavGrid(w, L.zones[0].nav[0]);
    const ground = (x: number, z: number, y: number) => w.groundAt(x, z, 0.3, y);
    const inside = (p: THREE.Vector3) => w.overlapsCylinder(p.x, p.z, 0.002, p.y - 0.002, p.y + 0.002);
    const face = (s: Spot) => {
      const n = s.normal;
      const up = Math.abs(n.y) > 0.9 ? V(s.hdir.x, 0, s.hdir.z).normalize() : V(0, 1, 0);
      const r = new THREE.Vector3().crossVectors(up, n).normalize();
      const pts = [s.pos.clone()];
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        pts.push(s.pos.clone().addScaledVector(r, (Math.cos(a) * s.w * 0.96) / 2).addScaledVector(up, (Math.sin(a) * s.h * 0.96) / 2));
      }
      return pts;
    };
    let n = 0, bad = 0, floating = 0;
    const why: string[] = [];
    for (let x = -28; x <= 28; x += 4) {
      for (let z = -28; z <= 26; z += 4) {
        if (!grid.walkable(x, z)) continue;
        const eye = V(x, 1.6, z);
        for (let k = 0; k < 8; k++) {
          const yaw = (k / 8) * Math.PI * 2;
          for (const pitch of [-0.3, -0.05, 0.15]) {
            const d = V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
            const s = placeExit(w, eye, d, eye, null, ground);
            if (!s.ok) continue;
            n++;
            const pts = face(s);
            const clips = pts.some(inside);
            const hangs = (s.surface === 'wall' || s.surface === 'floor' || s.surface === 'ceiling') && pts.some((p) => {
              const hit = w.raycast(p.clone().addScaledVector(s.normal, 0.2), s.normal.clone().negate(), 0.5);
              return !hit || Math.abs(hit.distance - 0.2 - AIMP.off) > 0.03;
            });
            if (clips || hangs) {
              bad++;
              if (why.length < 5) why.push(`${s.surface} at (${s.pos.toArray().map((v) => v.toFixed(2))}) from (${x}, ${z}) yaw ${yaw.toFixed(2)} pitch ${pitch}: ${clips ? 'in the world' : 'off its surface'}`);
            }
            // (a door on a wall, aimed lower than its height: on the floor in front of it)
            const hit = w.raycast(eye, d, 31);
            if (s.surface === 'wall' && hit && hit.point.y < 1.9) {
              const g = w.groundAt(s.pos.x + s.normal.x * 0.5, s.pos.z + s.normal.z * 0.5, 0.1, s.pos.y);
              // (the pool's walls under the deck have no floor in front of them: the water)
              if (g > -Infinity && s.pos.y - s.h / 2 - g > 0.1) floating++;
            }
          }
        }
      }
    }
    expect(n).toBeGreaterThan(500);
    // (a hair of slack for the sampling between two checks)
    expect(bad / n, why.join('\n')).toBeLessThan(0.01);
    expect(floating).toBe(0);
  });

  it('in the compound the exit by a man at any post, seen from where you see him, is clear of the walls and in sight of him', () => {
    const w = L.world;
    const inside = (p: THREE.Vector3) => w.overlapsCylinder(p.x, p.z, 0.002, p.y - 0.002, p.y + 0.002);
    let n = 0;
    for (const post of POSTS) {
      const m = V(post.x, post.y, post.z);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const view = V(Math.sin(a), 0, Math.cos(a));
        for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
          const s = fitSnap(w, { pos: m, yaw, height: 1.8 }, 'behind', post.y, view);
          if (!s.ok) continue;
          n++;
          const r = V(s.normal.z, 0, -s.normal.x);
          for (const [u, v] of [[0, 0], [0.62, 0], [-0.62, 0], [0, 1.0], [0, -1.0], [0.44, 0.74], [-0.44, -0.74]]) {
            expect(inside(s.pos.clone().addScaledVector(r, u).add(V(0, v, 0))), `${post.id} yaw ${yaw}`).toBe(false);
          }
          const from = s.pos.clone().addScaledVector(s.normal, 0.15);
          from.y = Math.min(from.y, post.y + 1.08);
          expect(w.lineOfSight(from, V(m.x, post.y + 1.08, m.z)), post.id).toBe(true);
        }
      }
    }
    expect(n).toBeGreaterThan(POSTS.length * 20);
  });

  it('in the compound the near twin opens clear of the walls (by a wall, in a doorway, at a window) nearly everywhere', () => {
    const w = L.world;
    const grid = new NavGrid(w, L.zones[0].nav[0]);
    const ground = (x: number, z: number, y: number) => w.groundAt(x, z, 0.3, y);
    const inside = (p: THREE.Vector3) => w.overlapsCylinder(p.x, p.z, 0.002, p.y - 0.002, p.y + 0.002);
    let n = 0, clip = 0;
    for (let x = -28; x <= 28; x += 1.3) {
      for (let z = -28; z <= 26; z += 1.3) {
        if (!grid.walkable(x, z)) continue;
        for (let k = 0; k < 8; k++) {
          const yaw = (k / 8) * Math.PI * 2;
          const f = V(Math.sin(yaw), 0, Math.cos(yaw));
          if (!w.raycast(V(x, 1, z), f, 1.8) && !w.raycast(V(x, 0.4, z), f, 1.8)) continue;
          const right = V(-Math.cos(yaw), 0, Math.sin(yaw));
          const cam = V(x, 1.55, z).addScaledVector(right, 0.62).addScaledVector(f, -3.1);
          const ray = { origin: cam, dir: V(Math.sin(yaw), -0.08, Math.cos(yaw)).normalize() };
          if (!placeExit(w, ray.origin, ray.dir, V(x, 1.6, z), null, ground).ok) continue;
          const s = nearSpot(w, V(x, 1.08, z), ray, 0, ground);
          n++;
          const r = V(s.normal.z, 0, -s.normal.x);
          let hit = false;
          for (let i = 0; i < 16 && !hit; i++) {
            const a = (i / 16) * Math.PI * 2;
            hit = inside(s.pos.clone().addScaledVector(r, Math.cos(a) * s.w * 0.48).add(V(0, Math.sin(a) * s.h * 0.48, 0)));
          }
          if (hit) clip++;
        }
      }
    }
    expect(n).toBeGreaterThan(300);
    expect(clip / n).toBeLessThan(0.03);
  });

  it('the hero starts in a court of walls: the pad is clear, the first aim ahead is a wall that takes a portal', () => {
    const p = L.lab!.pad.pos;
    const eye = V(p.x, p.y + 1.6, p.z);
    for (const pitch of [-0.1, 0, 0.1]) {
      const dir = V(0, Math.sin(pitch), Math.cos(pitch));
      const s = placeExit(L.world, eye, dir, eye, null, (x, z, y) => L.world.groundAt(x, z, 0.3, y));
      expect(s.reason, `pitch ${pitch}`).not.toBe('sealed');
    }
    expect(AIMP.range).toBe(30);
  });
});
