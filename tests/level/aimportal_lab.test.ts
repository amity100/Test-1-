import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCombatLab } from '../../src/world/combatlab';
import type { TowerBuild } from '../../src/world/tower';
import { AIM_WAVES, COVER, PLATFORMS, PLATFORM_Y, POOL, SEALED } from '../../src/world/combatlab/layout';
import { NavGrid } from '../../src/world/nav';
import { KIND } from '../../src/actors/tuning';
import { AIMP, placeExit } from '../../src/game/aimportal';

let L: TowerBuild;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

beforeAll(() => {
  L = buildCombatLab(null, false, { headless: true });
});

describe('AIM PORTAL: the lab it plays in', () => {
  it('three or four sealed panels refuse portals (a ray at one is refused, at the deck is not)', () => {
    expect(SEALED.length).toBeGreaterThanOrEqual(3);
    expect(SEALED.length).toBeLessThanOrEqual(4);
    const ground = (x: number, z: number, y: number) => L.world.groundAt(x, z, 0.3, y);
    for (const [x0, z0, x1, z1, h] of SEALED) {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      // a tall one: men can hide behind it
      expect(h).toBeGreaterThanOrEqual(2.5);
      // aimed at from the south and from the north (a long thin one is hit on its broad side)
      const broadZ = z1 - z0 < x1 - x0;
      const from = broadZ ? V(cx, 1.6, z0 - 8) : V(x0 - 8, 1.6, cz);
      const dir = broadZ ? V(0, 0, 1) : V(1, 0, 0);
      const s = placeExit(L.world, from, dir, from, null, ground);
      expect(s.ok, `panel ${x0},${z0}`).toBe(false);
      expect(s.reason).toBe('sealed');
    }
    // the deck takes one
    const o = V(0, 1.6, -22);
    const floor = placeExit(L.world, o, V(0, -0.3, 1).normalize(), o, null, (x, z, y) => L.world.groundAt(x, z, 0.3, y));
    expect(floor.ok).toBe(true);
    expect(floor.surface).toBe('floor');
  });

  it('two taller platforms stand on the deck (with nav on top); the void edge and the pool are still there', () => {
    expect(PLATFORMS.length).toBe(2);
    const z = L.zones[0];
    for (const [x0, z0, x1, z1] of PLATFORMS) {
      const g = L.world.groundAt((x0 + x1) / 2, (z0 + z1) / 2, 0.3, PLATFORM_Y + 0.1);
      expect(g).toBeCloseTo(PLATFORM_Y, 2);
      expect(z.nav.some((n) => Math.abs(n.floorY - PLATFORM_Y) < 0.01 && n.minX <= x0 && n.maxX >= x1 && n.minZ <= z0 && n.maxZ >= z1)).toBe(true);
    }
    expect(L.isSea(V((POOL.x0 + POOL.x1) / 2, 0, (POOL.z0 + POOL.z1) / 2))).toBe(true);
    expect(L.killYAt!(V(0, 0, 0))).toBeLessThan(-5);
  });

  it('every man of its five waves stands on nav, on the ground, with room, clear of the sealed panels and the cover', () => {
    const z = L.zones[0];
    const grids = z.nav.map((n) => new NavGrid(L.world, n));
    const layerOf = (p: THREE.Vector3) => z.nav.findIndex((n) => p.x >= n.minX && p.x <= n.maxX && p.z >= n.minZ && p.z <= n.maxZ && Math.abs(n.floorY - p.y) <= 0.3);
    for (const [wi, w] of AIM_WAVES.entries()) {
      for (const s of w.spawns) {
        const where = `A${wi + 1} ${s.aim} (${s.post.x}, ${s.post.y}, ${s.post.z})`;
        const li = layerOf(s.post);
        expect(li, `${where} on a layer`).toBeGreaterThanOrEqual(0);
        expect(grids[li].walkable(s.post.x, s.post.z), `${where} walkable`).toBe(true);
        const g = L.world.groundAt(s.post.x, s.post.z, 0.3, s.post.y + 0.3);
        expect(Math.abs(g - s.post.y), `${where} ground`).toBeLessThan(0.05);
        const k = KIND[s.kind];
        // (nothing solid at his body)
        for (const c of L.world.colliders) {
          if (!c.enabled || c.max.y <= s.post.y + 0.05 || c.min.y >= s.post.y + k.height) continue;
          const cx = Math.max(c.min.x, Math.min(s.post.x, c.max.x)), cz = Math.max(c.min.z, Math.min(s.post.z, c.max.z));
          expect((s.post.x - cx) ** 2 + (s.post.z - cz) ** 2, `${where} clear of ${c.tag}`).toBeGreaterThan(k.radius * k.radius);
        }
        // (a man on the deck starts in sight of the south: he is not hidden in a pocket)
        expect(s.aim).toBeTruthy();
      }
    }
    // cover is untouched
    expect(COVER.length).toBeGreaterThan(10);
  });

  it('the hero starts with the whole arena in front of him: the pad is clear, his first aim ahead is not a sealed panel', () => {
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
