import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildTower, type TowerBuild, SHAFT } from '../../src/world/tower';
import type { Collider } from '../../src/world/collision';
import { LAW, type EnemyKind, type LessonId, type SpawnDef, type ZoneDef, type ZoneId } from '../../src/core/contracts';
import { RiftSystem } from '../../src/game/portals';
import { PORTAL } from '../../src/game/portalkey';
import { simulateArc, straightOn, type Outcome, type SpotHost } from '../../src/game/riftspots';
import { frameNormal, orientFrame } from '../../src/game/portalMath';
import { Physics } from '../../src/sim/physics';
import { ZoneManager } from '../../src/game/zones';
import { NavGrid } from '../../src/world/nav';
import { AI } from '../../src/actors/tuning';
import { onFoot } from './reach';

let L: TowerBuild;

const ZONES: ZoneId[] = ['pier', 'yard', 'skeleton', 'lab', 'crown'];
/** Each zone's encounters in order: a lesson, or null for a plain fight (no hint). */
const LESSONS: Record<ZoneId, (LessonId | null)[]> = {
  pier: ['door', 'trapdoor', 'returnToSender', 'slingshot', 'arena'],
  yard: ['cargo', 'matador', 'grenade', 'shield'],
  skeleton: ['loop', 'firingLine', 'arena'],
  lab: ['hijack', null, 'borrowedGun'],
  crown: ['boss', 'leap'],
};
const ALL_LESSONS: LessonId[] = ['door', 'trapdoor', 'returnToSender', 'slingshot', 'arena', 'loop', 'cargo', 'matador', 'grenade', 'shield', 'firingLine', 'hijack', 'borrowedGun', 'boss', 'leap'];

const BODY: Record<EnemyKind, { r: number; h: number }> = {
  rifleman: { r: 0.4, h: 1.8 },
  grenadier: { r: 0.4, h: 1.8 },
  warden: { r: 0.5, h: 1.9 },
  brute: { r: 0.7, h: 2.4 },
  sniper: { r: 0.4, h: 1.8 },
  turret: { r: 0.6, h: 1.5 },
  boss: { r: 0.45, h: 1.9 },
};

/** Static world only (lift platforms move; they are not ground for spawns). */
const isStatic = (c: Collider) => c.tag !== 'lift';
function groundAt(x: number, z: number, r: number, maxY: number) {
  let g = -Infinity;
  for (const c of L.world.colliders) {
    if (!c.enabled || !isStatic(c)) continue;
    if (c.max.y > maxY || c.max.y <= g) continue;
    if (x + r < c.min.x || x - r > c.max.x || z + r < c.min.z || z - r > c.max.z) continue;
    g = c.max.y;
  }
  return g;
}
function overlapping(x: number, z: number, r: number, y0: number, y1: number) {
  const out: Collider[] = [];
  for (const c of L.world.colliders) {
    if (!c.enabled) continue;
    if (c.max.y <= y0 + 0.05 || c.min.y >= y1) continue;
    const cx = Math.max(c.min.x, Math.min(x, c.max.x));
    const cz = Math.max(c.min.z, Math.min(z, c.max.z));
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) out.push(c);
  }
  return out;
}
const fmt = (v: THREE.Vector3) => `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;
const desc = (cs: Collider[]) => cs.map((c) => `${c.tag ?? '?'}[${fmt(c.min)}..${fmt(c.max)}]`).join(', ');

function allSpawns(z: ZoneDef): SpawnDef[] {
  const s = z.encounters.flatMap((e) => e.spawns);
  if (z.id === 'lab') for (const g of L.gates) for (const w of g.waves) s.push(...w);
  return s;
}

beforeAll(() => {
  L = buildTower(null, false, { headless: true });
});

describe('the tower (level)', () => {
  it('builds headless with 5 zones in order', () => {
    expect(L.zones.map((z) => z.id)).toEqual(ZONES);
    for (const z of ZONES) expect(L.zoneRoots[z]).toBeTruthy();
    expect(L.root.children.length).toBeGreaterThan(5);
    expect(L.water).toBeTruthy();
    expect(L.helicopter).toBeTruthy();
    expect(L.bossArena).toBeTruthy();
    expect(L.lamps.length).toBeGreaterThan(5);
    expect(L.animated.length).toBeGreaterThan(3);
    expect(() => L.animated.forEach((f) => f(1.5))).not.toThrow();
  });

  it('zone keys, lessons, hints and challenges follow the spec', () => {
    for (const z of L.zones) {
      expect(z.nameKey).toBe(`zone.${z.id}.name`);
      expect(z.subKey).toBe(`zone.${z.id}.sub`);
      expect(z.encounters.map((e) => e.lesson ?? null)).toEqual(LESSONS[z.id]);
      for (const e of z.encounters) {
        if (!e.lesson) {
          expect(e.hintKey).toBeUndefined();
          expect(e.id).toMatch(new RegExp(`^${z.id}\\.[a-z]+$`));
          continue;
        }
        expect(ALL_LESSONS).toContain(e.lesson);
        expect(e.hintKey).toBe(`hint.${e.lesson}`);
        expect(e.hintKey).toMatch(/^hint\.[A-Za-z]+$/);
        expect(e.id).toBe(`${z.id}.${e.lesson}`);
      }
      expect(z.challenges).toEqual([1, 2, 3].map((i) => `${z.id}.${i}`));
      expect(z.nav.length).toBeGreaterThan(0);
      expect(z.sea).toBe(z.id === 'pier' || z.id === 'yard');
    }
    const ids = L.zones.flatMap((z) => z.encounters.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
    const pier = L.zones[0];
    expect(pier.encounters[0].requireClear).toBe(false);
    for (const e of pier.encounters.slice(1)) expect(e.requireClear).toBe(true);
  });

  it('every player start and checkpoint has ground just below and free space', () => {
    for (const z of L.zones) {
      const pts = [{ p: z.playerStart, what: `${z.id} start` }, ...z.encounters.filter((e) => e.checkpoint).map((e) => ({ p: e.checkpoint!.pos, what: `${e.id} checkpoint` }))];
      for (const { p, what } of pts) {
        const g = groundAt(p.x, p.z, 0.3, p.y + 0.05);
        expect(p.y - g, `${what} ${fmt(p)} ground ${g}`).toBeLessThanOrEqual(0.5);
        expect(p.y - g, `${what} ${fmt(p)} ground ${g}`).toBeGreaterThanOrEqual(-0.05);
        const o = overlapping(p.x, p.z, 0.34, p.y, p.y + 1.8);
        expect(o.length, `${what} ${fmt(p)} overlaps ${desc(o)}`).toBe(0);
        expect(z.bounds.containsPoint(p), `${what} in bounds`).toBe(true);
      }
    }
  });

  it('every spawn stands on its nav layer and not inside a collider', () => {
    const seen = new Set<string>();
    for (const z of L.zones) {
      for (const s of allSpawns(z)) {
        expect(seen.has(s.id), `duplicate spawn id ${s.id}`).toBe(false);
        seen.add(s.id);
        expect(s.zone).toBe(z.id);
        const p = s.pos;
        const layer = z.nav.find((n) => p.x >= n.minX && p.x <= n.maxX && p.z >= n.minZ && p.z <= n.maxZ && Math.abs(n.floorY - p.y) <= 0.3);
        expect(layer, `${s.id} ${fmt(p)} on a nav layer`).toBeTruthy();
        // (mission 1: every man stands on a cell he can walk, and so does his fallback)
        if (z.id === 'pier') {
          const g = new NavGrid(L.world, layer!);
          expect(g.walkable(p.x, p.z), `${s.id} ${fmt(p)} walkable`).toBe(true);
          if (s.fallback) expect(g.walkable(s.fallback.x, s.fallback.z), `${s.id} fallback ${fmt(s.fallback as THREE.Vector3)} walkable`).toBe(true);
        }
        const g = groundAt(p.x, p.z, 0.3, p.y + 0.5);
        expect(Math.abs(g - p.y), `${s.id} ${fmt(p)} ground ${g}`).toBeLessThanOrEqual(0.3);
        const b = BODY[s.kind];
        const o = overlapping(p.x, p.z, b.r, p.y, p.y + b.h);
        expect(o.length, `${s.id} ${fmt(p)} overlaps ${desc(o)}`).toBe(0);
        if (s.route) for (const q of s.route) {
          const gq = groundAt(q.x, q.z, 0.3, q.y + 0.5);
          expect(Math.abs(gq - q.y), `${s.id} route ${fmt(q)}`).toBeLessThanOrEqual(0.3);
          expect(overlapping(q.x, q.z, b.r, q.y, q.y + b.h).length, `${s.id} route ${fmt(q)}`).toBe(0);
        }
      }
    }
    const voss = L.zones[4].encounters[0].spawns.find((s) => s.kind === 'boss');
    expect(voss?.id).toBe('voss');
  });

  it('perched spawns can see their fight', () => {
    let perched = 0;
    for (const z of L.zones) {
      for (const e of z.encounters) {
        for (const s of e.spawns.filter((s) => s.perch)) {
          perched++;
          const eye = s.pos.clone().add(new THREE.Vector3(0, 1.55, 0));
          const targets = [e.trigger.getCenter(new THREE.Vector3()).setY(s.pos.y > 0 ? e.trigger.min.y + 2 : 1.5), ...e.spawns.filter((o) => o !== s && !o.perch).map((o) => o.pos.clone().add(new THREE.Vector3(0, 1.3, 0)))];
          const seen = targets.filter((t) => L.world.lineOfSight(eye, t));
          expect(seen.length, `${s.id} sees ${seen.length}/${targets.length}`).toBeGreaterThan(0);
          // and most of his squad
          expect(seen.length / targets.length, `${s.id} LOS ratio`).toBeGreaterThanOrEqual(0.5);
        }
      }
    }
    expect(perched).toBeGreaterThanOrEqual(2); // sniper + turret
  });

  it("a void zone's floors and spawns all lie above its killY (a man who falls below it is out of his fight)", () => {
    for (const z of L.zones) {
      if (z.sea) continue;
      for (const n of z.nav) expect(n.floorY, `${z.id} nav layer`).toBeGreaterThan(z.killY + 2);
      for (const s of allSpawns(z)) expect(s.pos.y, `${s.id}`).toBeGreaterThan(z.killY + 2);
    }
  });

  it('every encounter trigger lies inside its zone', () => {
    for (const z of L.zones) for (const e of z.encounters) expect(z.bounds.containsBox(e.trigger), `${e.id}`).toBe(true);
  });

  it('lifts start on their platform and arrive inside the next zone', () => {
    for (let i = 0; i < L.zones.length; i++) {
      const z = L.zones[i];
      if (!z.exit) {
        expect(['pier', 'crown']).toContain(z.id);
        continue;
      }
      const lift = z.exit;
      const next = L.zones[i + 1];
      expect(lift.toZone).toBe(next.id);
      expect(next.bounds.containsPoint(lift.to), `${lift.id} to ${fmt(lift.to)}`).toBe(true);
      expect(z.bounds.containsPoint(lift.from) || z.id === 'yard', `${lift.id} from in zone`).toBe(true);
      expect(lift.platform.containsPoint(lift.from.clone().add(new THREE.Vector3(0, 0.5, 0)))).toBe(true);
      expect(Math.abs(lift.collider.max.y - lift.from.y)).toBeLessThan(1e-6);
      expect(L.world.colliders).toContain(lift.collider);
      // standing on the platform finds the platform
      const g = L.world.groundAt(lift.from.x, lift.from.z, 0.3, lift.from.y + 0.1);
      expect(Math.abs(g - lift.from.y), `${lift.id} ground`).toBeLessThan(0.02);
      expect(lift.mesh.position.distanceTo(lift.from)).toBeLessThan(1e-6);
      const req = z.encounters.filter((e) => e.requireClear).map((e) => e.id);
      expect([...lift.requires].sort()).toEqual([...req].sort());
      // the shaft of travel is clear of static geometry
      const c = lift.collider;
      const y0 = Math.min(lift.from.y, lift.to.y) - 0.2, y1 = Math.max(lift.from.y, lift.to.y) + 2.4;
      const hits = L.world.colliders.filter((o) => o !== c && o.enabled && o.tag !== 'lift' && o.max.x > c.min.x + 0.02 && o.min.x < c.max.x - 0.02 && o.max.z > c.min.z + 0.02 && o.min.z < c.max.z - 0.02 && o.max.y > y0 && o.min.y < y1);
      expect(hits.length, `${lift.id} path blocked by ${desc(hits)}`).toBe(0);
      // the arrival floor is next to the cage
      const arrive = lift.to.clone();
      const edge = z.id === 'lab' ? arrive.clone().setZ(lift.platform.min.z - 1) : arrive.clone().setZ(lift.platform.max.z + 1);
      expect(Math.abs(groundAt(edge.x, edge.z, 0.2, arrive.y + 0.3) - arrive.y), `${lift.id} arrival floor`).toBeLessThanOrEqual(0.25);
    }
  });

  it('hanging props hang, standing props rest on the ground', () => {
    expect(L.props.length).toBeGreaterThan(20);
    const ids = new Set<string>();
    let hanging = 0;
    for (const p of L.props) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      const r = Math.min(p.size.x, p.size.z) / 2;
      if (p.hangFrom) {
        hanging++;
        expect(p.hangFrom.y, `${p.id}`).toBeGreaterThan(p.pos.y + p.size.y + 0.5);
        expect(Math.hypot(p.hangFrom.x - p.pos.x, p.hangFrom.z - p.pos.z), `${p.id} plumb`).toBeLessThan(0.01);
        const below = groundAt(p.pos.x, p.pos.z, 0.2, p.pos.y);
        expect(p.pos.y - below, `${p.id} hangs clear`).toBeGreaterThan(2);
      } else {
        const g = groundAt(p.pos.x, p.pos.z, Math.min(0.2, r), p.pos.y + 0.3);
        expect(Math.abs(g - p.pos.y), `${p.id} ${fmt(p.pos)} rests (ground ${g})`).toBeLessThanOrEqual(0.05);
      }
      const o = overlapping(p.pos.x, p.pos.z, r * 0.95, p.pos.y, p.pos.y + p.size.y);
      expect(o.length, `${p.id} ${fmt(p.pos)} overlaps ${desc(o)}`).toBe(0);
      if (p.kind === 'barrel') expect(p.explosive).toBe(true);
      expect(L.zones.find((z) => z.id === p.zone)!.bounds.containsPoint(p.pos), `${p.id} in its zone`).toBe(true);
      const m = L.propMesh(p);
      expect(m.position.distanceTo(p.pos)).toBeLessThan(1e-6);
    }
    expect(hanging).toBeGreaterThanOrEqual(4); // pier container, yard beams + container, crown load
    const yardHang = L.props.filter((p) => p.zone === 'yard' && p.hangFrom);
    expect(yardHang.map((p) => p.kind).sort()).toEqual(['beamBundle', 'container']);
  });

  it('the skeleton has an open shaft through every floor', () => {
    const cx = (SHAFT.x0 + SHAFT.x1) / 2, cz = (SHAFT.z0 + SHAFT.z1) / 2;
    // nothing between the pit (24) and the lab slab underside (59.7)
    expect(groundAt(cx, cz, 1.3, 59)).toBe(24);
    const hit = L.world.raycast(new THREE.Vector3(cx, 59.5, cz), new THREE.Vector3(0, -1, 0), 50);
    expect(hit?.point.y).toBeCloseTo(24, 3);
    const up = L.world.raycast(new THREE.Vector3(cx, 25, cz), new THREE.Vector3(0, 1, 0), 50);
    expect(up?.point.y).toBeCloseTo(59.7, 3);
    // and the floors are there around it
    for (const y of [30, 36, 42]) {
      expect(groundAt(SHAFT.x0 - 0.8, cz, 0.1, y + 0.1)).toBe(y);
      expect(groundAt(cx, SHAFT.z0 - 0.8, 0.1, y + 0.1)).toBe(y);
    }
    // the skeleton kills below its floors
    const sk = L.zones[2];
    expect(sk.killY).toBeLessThan(24);
    expect(sk.killY).toBeGreaterThan(12);
  });

  it('gates, hazards, lasers and the boss arena are sane', () => {
    expect(L.gates.length).toBe(2);
    const lab = L.zones[3];
    for (const g of L.gates) {
      expect(g.zone).toBe('lab');
      expect(g.waves.length).toBeGreaterThanOrEqual(2);
      expect(g.waves.length).toBeLessThanOrEqual(3);
      expect(lab.bounds.containsPoint(g.inFrame.position)).toBe(true);
      expect(lab.bounds.containsPoint(g.outFrame.position)).toBe(true);
      const gp = groundAt(g.panel.x, g.panel.z, 0.3, g.panel.y + 0.3);
      expect(Math.abs(gp - g.panel.y)).toBeLessThan(0.05);
      expect(overlapping(g.panel.x, g.panel.z, 0.34, g.panel.y, g.panel.y + 1.8).length).toBe(0);
      // the out-end has room in front of it
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(g.outFrame.quaternion);
      const front = g.outFrame.position.clone().addScaledVector(n, 1.2);
      expect(overlapping(front.x, front.z, 0.4, front.y - 1.1, front.y + 0.6).length).toBe(0);
    }
    expect(L.lasers.length).toBeGreaterThan(0);
    for (const l of L.lasers) expect(Math.abs(l.dir.length() - 1)).toBeLessThan(1e-6);
    expect(L.hazards.length).toBeGreaterThan(0);
    const a = L.bossArena!;
    expect(a.blinkPoints.length).toBe(6);
    for (const p of a.blinkPoints) {
      expect(Math.abs(groundAt(p.x, p.z, 0.3, p.y + 0.3) - p.y), `blink ${fmt(p)}`).toBeLessThan(0.05);
      expect(overlapping(p.x, p.z, 0.45, p.y, p.y + 1.9).length, `blink ${fmt(p)}`).toBe(0);
      expect(p.distanceTo(a.center)).toBeLessThanOrEqual(a.radius + 1);
    }
  });

  it('the trapdoor lesson: a PORTAL tap from the way in throws both guards into the sea', () => {
    const pair = L.zones[0].encounters.find((e) => e.lesson === 'trapdoor')!.spawns;
    expect(pair.length).toBe(2);
    // the gap between stack T and row R1, where they first come into sight
    for (const you of [new THREE.Vector3(-7, 0, -44.3), new THREE.Vector3(-10, 0, -44.3)]) {
      for (const s of pair) {
        const man = s.pos;
        expect(L.world.lineOfSight(new THREE.Vector3(you.x, you.y + 1.68, you.z), new THREE.Vector3(man.x, man.y + 1.1, man.z)), `sees ${s.id}`).toBe(true);
        const rifts = new RiftSystem(new THREE.Scene(), null, L.world, { portalScale: 0.5, lightCount: 2, maxViews: 2 });
        const host: SpotHost = { rifts, world: L.world, level: { seaY: L.seaY, isSea: (p) => L.isSea(p as THREE.Vector3) }, killYAt: () => L.seaY - 30 };
        const d = new THREE.Vector3(man.x - you.x, 0, man.z - you.z).normalize();
        const S = PORTAL.straight;
        const exit = straightOn(host, man, d, S.past, S.up, S.tilt)!;
        expect(exit, `room past ${s.id}`).toBeTruthy();
        rifts.openEntranceFrame({ position: new THREE.Vector3(man.x, man.y + 0.01, man.z), quaternion: orientFrame(new THREE.Vector3(0, 1, 0), d), width: LAW.floorEndSize, height: LAW.floorEndSize }, 'floor', true);
        rifts.placeExitFrame(exit, null, { boost: PORTAL.throwSpeed.grab, noPlayer: true });
        const phys = new Physics(L.world, rifts, { seaY: L.seaY, isSea: (p) => L.isSea(p as THREE.Vector3), killYAt: () => L.seaY - 30 });
        const b = phys.createBody('enemy', { pos: man.clone(), radius: 0.4, height: 1.8 });
        b.vel.set(0, -9, 0);
        let wet = false;
        const ev = { crossed() {}, impact() {}, touch() {}, splash: () => (wet = true), fellOut() {} };
        for (let i = 0; i < 150 && !wet; i++) phys.step(1 / 60, ev, i / 60);
        expect(wet, `${s.id} from ${fmt(you)} lands at ${fmt(b.pos)}`).toBe(true);
      }
    }
  });

  it('stays within the collider and draw-call budgets', () => {
    const n = L.world.colliders.length;
    expect(n).toBeLessThan(3000);
    const draws = (o: THREE.Object3D) => {
      let k = 0;
      o.traverse((c) => ((c as THREE.Mesh).isMesh ? k++ : 0));
      return k;
    };
    const report: string[] = [`colliders ${n}`];
    for (const z of ZONES) {
      const d = draws(L.zoneRoots[z]);
      report.push(`${z} ${d}`);
      expect(d, `${z} draw calls`).toBeLessThan(60);
    }
    const shell = draws(L.shellRoot);
    report.push(`shell ${shell}`);
    expect(shell).toBeLessThan(60);
    let tris = 0;
    L.root.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh && m.geometry.index) tris += m.geometry.index.count / 3;
    });
    report.push(`tris ${tris}`);
    expect(tris).toBeLessThan(800_000);
    console.log(report.join(' | '));
  });

  it('mobile build is lighter and gameplay-identical; rebuilds are deterministic', () => {
    const M = buildTower(null, true, { headless: true });
    const tris = (lv: TowerBuild) => {
      let t = 0;
      lv.root.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh && m.geometry.index) t += m.geometry.index.count / 3;
      });
      return t;
    };
    expect(tris(M)).toBeLessThan(tris(L) * 0.8);
    expect(M.world.colliders.length).toBe(L.world.colliders.length);
    expect(M.props.map((p) => p.id)).toEqual(L.props.map((p) => p.id));
    const spawnIds = (lv: TowerBuild) => lv.zones.flatMap((z) => z.encounters.flatMap((e) => e.spawns.map((s) => `${s.id}@${s.pos.toArray().join(',')}`)));
    expect(spawnIds(M)).toEqual(spawnIds(L));
  });

  it('extras: zoneAt / isSea', () => {
    expect(L.zoneAt(new THREE.Vector3(26, 0.5, -63))).toBe('pier');
    expect(L.zoneAt(new THREE.Vector3(0, 0.5, 30))).toBe('yard');
    expect(L.zoneAt(new THREE.Vector3(0, 31, 30))).toBe('skeleton');
    expect(L.zoneAt(new THREE.Vector3(0, 61, 30))).toBe('lab');
    expect(L.zoneAt(new THREE.Vector3(0, 91, 30))).toBe('crown');
    expect(L.isSea(new THREE.Vector3(-60, 0, 20))).toBe(true);
    expect(L.isSea(new THREE.Vector3(0, 0, -53))).toBe(true); // the channel
    expect(L.isSea(new THREE.Vector3(0, 0, -20))).toBe(false);
  });
});

describe('the objective marker', () => {
  it('points at the fight until it has lost a man and only one or two are left, then at the nearest of them, wherever he is', () => {
    const zm = new ZoneManager(L);
    const enc = zm.encounters.find((e) => e.zone === 'pier' && e.def.requireClear)!;
    const centre = enc.def.trigger.getCenter(new THREE.Vector3());
    const at = new Map<number, THREE.Vector3>([
      [1, new THREE.Vector3(1, 0, 1)],
      [2, new THREE.Vector3(-4.2, 5.18, -47)], // thrown onto a container top
      [3, new THREE.Vector3(9, 0, 9)],
    ]);
    enc.triggered = enc.engaged = true;
    enc.enemyIds = [1, 2, 3];
    const where = (id: number) => at.get(id) ?? null;
    const you = new THREE.Vector3(0, 0, -40);
    expect(zm.objective(where, you).target!.equals(centre)).toBe(true);
    at.delete(1);
    expect(zm.objective(where, you).target).toBe(at.get(2));
    // (a two-man fight with both still up is just the fight)
    enc.enemyIds = [2, 3];
    expect(zm.objective(where, you).target!.equals(centre)).toBe(true);
    // (without a locator it's the fight as before)
    expect(zm.objective().target!.equals(centre)).toBe(true);
  });
});

describe('lesson hints on arrival', () => {
  it('the first lesson teaches where the run starts: the door has nothing to clear but still hints', () => {
    const zm = new ZoneManager(L);
    const u = zm.update(L.zones[0].playerStart);
    const door = u.engaged.find((e) => e.def.lesson === 'door')!;
    expect(door).toBeTruthy();
    expect(u.triggered).toContain(door);
    expect(door.cleared).toBe(true);
    expect(zm.lessonHint(door)).toBe('hint.door');
  });

  it('a fight won from afar has nothing left to teach; a plain fight never hints; the leap waits for Voss', () => {
    const zm = new ZoneManager(L);
    const rts = zm.encounters.find((e) => e.def.lesson === 'returnToSender')!;
    rts.triggered = true;
    rts.enemyIds = [1];
    expect(zm.lessonHint(rts)).toBe('hint.returnToSender');
    expect(zm.checkClears(() => false)).toEqual([rts]);
    expect(zm.lessonHint(rts)).toBeNull();
    expect(zm.lessonHint(zm.encounters.find((e) => e.def.id === 'lab.hall')!)).toBeNull();
    // on the roof by the leap beam, mid-fight: the boss hints, the leap doesn't (his fall shows it)
    const u = zm.update(new THREE.Vector3(-12, 90.5, 40));
    const leap = u.engaged.find((e) => e.def.lesson === 'leap')!;
    expect(leap.cleared).toBe(true);
    expect(zm.lessonHint(leap)).toBeNull();
    expect(zm.lessonHint(u.engaged.find((e) => e.def.lesson === 'boss')!)).toBe('hint.boss');
  });
});

/**
 * Mission 1 on the pier holds ground (DESIGN §5 roles, §8): lookouts on posts
 * you can't walk to (the office roof, the warehouse roof, stack CA, the crane
 * catwalk), riflemen in cover on the fight's floor, the warden pushing. Every
 * lookout reads from his fight's approach and has his answers: REFLECT (not
 * modelled here), a GRAB tap whose outcome depends on where you stand, and a
 * DOOR onto his perch beside him.
 */
describe("the pier's posts (holding ground)", () => {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const pier = () => L.zones[0];
  const man = (id: string) => allSpawns(pier()).find((s) => s.id === `pier.${id}`)!;
  const host = (): SpotHost => {
    const rifts = new RiftSystem(new THREE.Scene(), null, L.world, { portalScale: 0.5, lightCount: 2, maxViews: 2 });
    return { rifts, world: L.world, level: { seaY: L.seaY, isSea: (p) => L.isSea(p as THREE.Vector3) }, killYAt: () => L.seaY - 30 };
  };
  const hd = (a: THREE.Vector3Like, b: THREE.Vector3Like) => Math.hypot(a.x - b.x, a.z - b.z);
  /** Eye (feet + 1.66) to chest (feet + 1.3), as the awareness model looks. */
  const sees = (from: THREE.Vector3, to: THREE.Vector3) => L.world.lineOfSight(V(from.x, from.y + 1.66, from.z), V(to.x, to.y + 1.3, to.z));
  const range = (from: THREE.Vector3, to: THREE.Vector3) => V(from.x, from.y + 1.66, from.z).distanceTo(V(to.x, to.y + 1.3, to.z));

  const HOLDERS = ['rts.a', 'sling.c', 'arena.a', 'arena.c'];
  /** Each lookout's fight: the spots you fight him from (§8 tables). */
  const KEY_SPOTS: Record<string, [string, THREE.Vector3][]> = {
    'rts.a': [['checkpoint', V(-10, 0, -36.5)], ['yard middle', V(-16, 0, -35)], ['lane north', V(-14, 0, -27)], ['under the wall', V(-24, 0, -31)], ['R1 top', V(-20, 5.18, -42)]],
    'sling.c': [['S top', V(7, 7.77, -25)], ['S top east', V(8, 7.77, -25.5)], ['quay west', V(12, 0, -30)], ['quay north', V(8, 0, -20)]],
    'arena.a': [['trigger west', V(-12, 0, -18)], ['strip', V(-2, 0, -19)], ['trigger centre', V(0, 0, -18)], ['mid', V(-6, 0, -10)], ['NW top', V(-38.6, 7.77, -16)]],
    'arena.c': [['trigger east', V(12, 0, -17)], ['east entry', V(15, 0, -19)], ['(16, -12)', V(16, 0, -12)], ['(18, -4)', V(18, 0, -4)], ['fallback D', V(13, 0, -2)]],
  };

  it('eleven men with roles: four lookouts above their fights, anchors and the warden on the floor', () => {
    const all = pier().encounters.flatMap((e) => e.spawns);
    expect(all.length).toBe(11);
    const roles = Object.fromEntries(all.map((s) => [s.id.slice(5), s.role]));
    expect(roles).toEqual({
      'trap.a': 'anchor', 'trap.b': 'anchor', 'rts.a': 'holder', 'sling.a': 'anchor', 'sling.b': 'anchor', 'sling.c': 'holder',
      'arena.w': 'pusher', 'arena.a': 'holder', 'arena.b': 'anchor', 'arena.c': 'holder', 'arena.d': 'anchor',
    });
    for (const s of all) {
      if (s.role === 'holder') expect(s.route, `${s.id} holds, no patrol`).toBeUndefined();
      // (a calm patrol isn't leashed: it has to lie inside his ground)
      const leash = s.leash ?? AI.hold.leash[s.role!];
      for (const q of s.route ?? []) expect(hd(q, s.pos), `${s.id} patrol inside his ground`).toBeLessThanOrEqual(leash);
    }
    // one prepared fallback: same floor, back toward the gate (away from where you come in), 5-12 m
    const d = man('arena.d');
    expect(d.fallback).toBeTruthy();
    expect(d.fallback!.y).toBe(d.pos.y);
    expect(hd(d.fallback!, d.pos)).toBeGreaterThanOrEqual(5);
    expect(hd(d.fallback!, d.pos)).toBeLessThanOrEqual(12);
    expect(d.fallback!.z).toBeGreaterThan(d.pos.z);
    expect(all.filter((s) => s.fallback).length).toBe(1);
  });

  it('lookouts see their fight from their posts; the roof sentry has his back to the slingshot', () => {
    for (const id of HOLDERS) {
      const p = man(id).pos as THREE.Vector3;
      const spots = KEY_SPOTS[id].filter(([, q]) => range(p, q) <= 24);
      const seen = spots.filter(([, q]) => sees(p, q));
      expect(spots.length, `${id}: key spots in range`).toBeGreaterThanOrEqual(3);
      expect(seen.length / spots.length, `${id} sees ${seen.map(([n]) => n).join(', ')} of ${spots.map(([n]) => n).join(', ')}`).toBeGreaterThanOrEqual(0.5);
    }
    // rts: out of range as you round the row (a beat to read him against the sky), in range at the checkpoint
    const rts = man('rts.a').pos as THREE.Vector3;
    expect(range(rts, V(-4, 0, -38))).toBeGreaterThan(24);
    expect(range(rts, V(-10, 0, -36.5))).toBeLessThan(24);
    // teach, then twist: the warehouse sentry can't see the pair, the wall foot or the landing...
    const wh = man('sling.c').pos as THREE.Vector3;
    for (const q of [V(17.2, 0, -25.6), V(17.2, 0, -24.3), V(19, 0, -28), V(20, 1, -25)]) expect(sees(wh, q), `sentry sees ${fmt(q)}`).toBe(false);
    // ...and S top, in plain view, is behind him (outside his cone of ±60°)
    const toS = Math.atan2(7 - wh.x, -25 - wh.z);
    let off = Math.abs(toS - man('sling.c').yaw) % (2 * Math.PI);
    if (off > Math.PI) off = 2 * Math.PI - off;
    expect(sees(wh, V(7, 7.77, -25))).toBe(true);
    expect(off).toBeGreaterThan(Math.PI / 3 + 0.2);
    // the arena's two lookouts cover opposite halves: nowhere wide on the floor is in range of both
    const ca = man('arena.a').pos as THREE.Vector3, cr = man('arena.c').pos as THREE.Vector3;
    let both = 0;
    for (let x = -14; x <= 20; x += 2) if (range(ca, V(x, 0, -12)) <= 24 && range(cr, V(x, 0, -12)) <= 24) both++;
    expect(both).toBeLessThanOrEqual(2);
  });

  it("the lookouts' posts can't be reached on foot; the player's own high ground can", () => {
    const f = onFoot(L.world, { x0: -46, x1: 56, z0: -70, z1: 3 }, [pier().playerStart, V(0, 0, -20), V(0, 0, -10)]);
    for (const id of HOLDERS) expect(f.reached(man(id).pos), `${id} reached: ${f.route(man(id).pos)}`).toBe(false);
    for (const [n, p] of [['NW top', V(-38.6, 7.77, -16)], ['S top', V(7, 7.77, -25)], ['R1 top', V(-20, 5.18, -42)], ['T top', V(-5, 5.18, -46.6)]] as const) {
      expect(f.reached(p), `${n} reached`).toBe(true);
    }
    // (a flood fill of every collider top: seconds, more with the rest of the suite running beside it)
  }, 60_000);

  it('every perch: the collider top is the top you see (boots on the surface)', () => {
    L.root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    for (const id of HOLDERS) {
      const p = man(id).pos;
      expect(L.world.groundAt(p.x, p.z, 0.3, p.y + 0.5), `${id} collider top`).toBeCloseTo(p.y, 3);
      ray.set(V(p.x, p.y + 2.5, p.z), V(0, -1, 0));
      ray.far = 5;
      const hit = ray.intersectObject(L.root, true).find((h) => (h.object as THREE.Mesh).isMesh);
      expect(hit, `${id} has a surface under him`).toBeTruthy();
      expect(Math.abs(hit!.point.y - p.y), `${id}: surface you see at ${hit!.point.y.toFixed(3)} (${hit!.object.name})`).toBeLessThanOrEqual(0.03);
    }
  });

  it('a DOOR aimed at a perch face 2.5 m beside a lookout puts you on top, clear of him; aimed at him it is refused', () => {
    const rifts = host().rifts;
    /** from `you`, aim at the point `at` on the perch face; `post` is the man (steady, in combat). */
    const aim = (you: THREE.Vector3, at: THREE.Vector3, post: THREE.Vector3) => {
      const eye = V(you.x, you.y + 1.66, you.z);
      const dir = at.clone().sub(eye).normalize();
      return rifts.aimExit(eye, dir, eye, you, false, [{ key: 'enemy:1', pos: post, radius: 0.4, height: 1.8, canFall: false, steady: true }]);
    };
    const cases: [string, THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [
      // lookout, you, the face beside him, the face right in front of him
      ['rts.a', V(-16, 0, -35), V(-29.8, 7.75, -36.5), V(-29.8, 7.75, -34)],
      ['rts.a', V(-16, 0, -35), V(-29.8, 7.75, -31.5), V(-29.8, 7.75, -34)],
      ['sling.c', V(7, 7.77, -25), V(21.6, 9.2, -28.5), V(21.6, 9.2, -31)],
      ['arena.a', V(-2, 0, -19), V(-21, 4.9, -15), V(-18.5, 4.9, -15)],
      ['arena.c', V(15, 0, -19), V(25, 8.5, -8.3), V(25, 8.5, -5.8)],
      ['arena.c', V(16, 0, -12), V(25, 8.5, -3.3), V(25, 8.5, -5.8)],
    ];
    for (const [id, you, beside, front] of cases) {
      const post = man(id).pos as THREE.Vector3;
      const a = aim(you, beside, post);
      expect(a.valid, `${id} from ${fmt(you)}: ${a.reason}`).toBe(true);
      expect(a.kind, `${id} from ${fmt(you)}`).toBe('stand');
      expect(a.exitFeet.y, `${id} from ${fmt(you)} lands on top`).toBeCloseTo(post.y, 2);
      expect(hd(a.exitFeet, post), `${id} from ${fmt(you)}`).toBeGreaterThanOrEqual(1.2);
      const b = aim(you, front, post);
      expect(b.valid && b.kind === 'stand' ? hd(b.exitFeet, post) : 9, `${id}: a door on top of him`).toBeGreaterThanOrEqual(1.2);
    }
  });

  it('a GRAB tap on a lookout: where you stand decides (a kill off the edge or into a wall, or a knockdown)', () => {
    const h = host();
    const arc = Array.from({ length: 120 }, () => new THREE.Vector3());
    const tapOutcome = (you: THREE.Vector3, p: THREE.Vector3): Outcome | 'none' => {
      const d = V(p.x - you.x, 0, p.z - you.z).normalize();
      const S = PORTAL.straight;
      const f = straightOn(h, p, d, S.past, S.up, S.tilt);
      if (!f) return 'none';
      return simulateArc(h, f.position, frameNormal(f).multiplyScalar(PORTAL.throwSpeed.grab), arc).outcome;
    };
    const kill = ['skull', 'splash', 'void'];
    const cases: [string, THREE.Vector3, string[]][] = [
      ['rts.a', V(-16, 0, -35), kill], // over the west rail into the sea, or into the plant box
      ['rts.a', V(-10, 0, -36.5), kill],
      ['sling.c', V(7, 7.77, -25), kill], // from S top: off the south edge
      ['sling.c', V(12, 0, -30), ['stars']], // from the quay: along his roof, a knockdown (he walks back)
      ['arena.a', V(-2, 0, -19), kill], // off CA's north side
      ['arena.a', V(-32.2, 2.59, -14), kill], // from the NW block's low 20ft: off the far end
      ['arena.c', V(15, 0, -19), kill], // over the sill beam, into the sea past the quay
      ['arena.c', V(12, 0, -17), kill],
      ['arena.c', V(16, 0, -12), kill],
      ['arena.c', V(13, 0, -2), kill],
    ];
    for (const [id, you, want] of cases) {
      const got = tapOutcome(you, man(id).pos as THREE.Vector3);
      expect(want, `${id} tapped from ${fmt(you)}: ${got}`).toContain(got);
    }
  });
});
