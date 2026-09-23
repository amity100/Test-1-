import * as THREE from 'three';
import type { LiftDef, ZoneId } from '../../core/contracts';
import { Builder, Ctx, PALETTE, V, box3 } from './kit';
import type { Rect } from './layout';

/**
 * Construction hoist cage. The mesh's local origin is the platform's top
 * centre and it is placed at `from`; the collider is the floor plate (its top
 * is `from.y`). The game moves both by (to - from) with world.moveCollider.
 * Open side: north (+z), toward the tower.
 */
export function hoistLift(ctx: Ctx, id: string, r: Rect, fromY: number, toY: number, requires: string[], toZone: ZoneId): LiftDef {
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const hx = (r.x1 - r.x0) / 2, hz = (r.z1 - r.z0) / 2;
  const b = new Builder();
  const H = 2.5;
  // floor plate + hazard edge on the open side
  b.box('metal', -hx, -0.2, -hz, hx, 0, hz, 0x4a4f55, 1, { ao: 0 });
  b.box('hazard', -hx, -0.01, hz - 0.2, hx, 0.005, hz, 0xffffff, 1, { ao: 0 });
  // corner posts, roof frame and mesh rails on three sides
  for (const [x, z] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]]) b.box('steel', x - 0.06, 0, z - 0.06, x + 0.06, H, z + 0.06, PALETTE.crane, 1, { ao: 0 });
  b.box('steel', -hx - 0.06, H - 0.1, -hz - 0.06, hx + 0.06, H + 0.05, hz + 0.06, PALETTE.crane, 1, { ao: 0 });
  b.box('metal', -hx + 0.2, H + 0.05, -hz + 0.2, hx - 0.2, H + 0.12, hz - 0.2, 0x6a7078, 1, { ao: 0 });
  const bars = (ax: number, az: number, ex: number, ez: number) => {
    for (const y of [0.5, 1.05, 1.6, 2.15]) b.beam('steel', V(ax, y, az), V(ex, y, ez), 0.04, 0.04, 0x9aa2aa, 1);
    const len = Math.hypot(ex - ax, ez - az);
    const n = Math.max(2, Math.round(len / 0.3));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = ax + (ex - ax) * t, z = az + (ez - az) * t;
      b.box('steel', x - 0.012, 0.05, z - 0.012, x + 0.012, H - 0.1, z + 0.012, 0x9aa2aa, 1, { ao: 0 });
    }
  };
  bars(-hx, -hz, hx, -hz);
  bars(-hx, -hz, -hx, hz);
  bars(hx, -hz, hx, hz);
  // drive unit on the mast side + a control box
  b.box('steel', -0.5, H + 0.05, -hz, 0.5, H + 0.9, -hz + 0.9, 0x2b2f34, 1, { ao: 0 });
  b.box('steel', hx - 0.5, 1.0, -hz + 0.1, hx - 0.15, 1.5, -hz + 0.35, PALETTE.orange, 1, { ao: 0 });
  const mesh = b.build(ctx.materials, { name: id });
  mesh.position.set(cx, fromY, cz);
  mesh.name = `lift:${id}`;
  mesh.userData.liftId = id;
  ctx.shellRoot.add(mesh);
  const collider = ctx.world.add(V(r.x0, fromY - 0.2, r.z0), V(r.x1, fromY, r.z1), { tag: 'lift' });
  return {
    id,
    platform: box3(r.x0, fromY, r.z0, r.x1, fromY + H, r.z1),
    from: V(cx, fromY, cz),
    to: V(cx, toY, cz),
    requires,
    toZone,
    mesh,
    collider,
  };
}

/** Kessler glass lift on the tower's north face (open side: south, toward the tower). */
export function glassLift(ctx: Ctx, id: string, r: Rect, fromY: number, toY: number, requires: string[], toZone: ZoneId): LiftDef {
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const hx = (r.x1 - r.x0) / 2, hz = (r.z1 - r.z0) / 2;
  const b = new Builder();
  const H = 2.8;
  b.box('metal', -hx, -0.25, -hz, hx, 0, hz, 0x22282e, 1, { ao: 0 });
  b.box('panel', -hx + 0.05, -0.01, -hz + 0.05, hx - 0.05, 0.004, hz - 0.05, 0x9aa4ae, 2, { ao: 0 });
  b.box('metal', -hx, H, -hz, hx, H + 0.35, hz, 0x22282e, 1, { ao: 0 });
  b.box('emissive', -hx + 0.3, H - 0.02, -hz + 0.3, hx - 0.3, H, hz - 0.3, new THREE.Color(1.4, 1.6, 1.7), 2, { ao: 0 });
  for (const [x, z] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]]) b.box('metal', x - 0.05, 0, z - 0.05, x + 0.05, H, z + 0.05, 0x22282e, 1, { ao: 0 });
  // glass on east, west and north
  b.box('glass', -hx, 0.05, hz - 0.03, hx, H, hz, 0xffffff, 2, { ao: 0 });
  b.box('glass', -hx, 0.05, -hz, -hx + 0.03, H, hz, 0xffffff, 2, { ao: 0 });
  b.box('glass', hx - 0.03, 0.05, -hz, hx, H, hz, 0xffffff, 2, { ao: 0 });
  // handrail + cyan Kessler strip
  b.box('metal', -hx + 0.05, 1.0, hz - 0.12, hx - 0.05, 1.05, hz - 0.07, 0xb0b8c0, 1, { ao: 0 });
  b.box('emissive', -hx, 0.02, hz - 0.06, hx, 0.08, hz, new THREE.Color(0.3, 2.4, 3), 1, { ao: 0 });
  const mesh = b.build(ctx.materials, { name: id });
  mesh.position.set(cx, fromY, cz);
  mesh.name = `lift:${id}`;
  mesh.userData.liftId = id;
  ctx.shellRoot.add(mesh);
  const collider = ctx.world.add(V(r.x0, fromY - 0.25, r.z0), V(r.x1, fromY, r.z1), { tag: 'lift' });
  // guide rails on the facade (static)
  for (const x of [r.x0 - 0.15, r.x1 + 0.15]) ctx.shell.box('metal', x - 0.08, fromY - 1, r.z1 - 0.5, x + 0.08, toY + 3.5, r.z1 - 0.3, 0x2a3036, 1, { ao: 0 });
  ctx.shell.box('metal', r.x0 - 0.3, toY + 3.2, r.z0, r.x1 + 0.3, toY + 3.6, r.z1, 0x2a3036, 1, { ao: 0 });
  return {
    id,
    platform: box3(r.x0, fromY, r.z0, r.x1, fromY + H, r.z1),
    from: V(cx, fromY, cz),
    to: V(cx, toY, cz),
    requires,
    toZone,
    mesh,
    collider,
  };
}
