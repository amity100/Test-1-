import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCombatLab } from '../../src/world/combatlab';
import type { TowerBuild } from '../../src/world/tower';
import { AIM_WAVES_C, PLAT_Y, PLATFORMS_C } from '../../src/world/combatlab/compound';
import { POOL } from '../../src/world/combatlab/layout';
import { NavGrid } from '../../src/world/nav';
import { KIND } from '../../src/actors/tuning';
import { AIMP, placeExit } from '../../src/game/aimportal';

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
