import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildHalcyon } from '../../src/world/halcyon';
import { buildTower, type TowerBuild } from '../../src/world/tower';
import { buildWorld, readWorld, DEFAULT_WORLD, type WorldStore } from '../../src/world/worlds';
import { BOARD_AT, CUT_KILL_Y, PLATFORM_Y, UPPER_Y as UPPER } from '../../src/world/halcyon/layout';
import type { Collider } from '../../src/world/collision';
import { NavGrid } from '../../src/world/nav';
import { LAW, type EnemyKind, type SpawnDef } from '../../src/core/contracts';
import { FEEL } from '../../src/config';
import { RiftSystem } from '../../src/game/portals';
import { PORTAL } from '../../src/game/portalkey';
import { straightOn, type SpotHost } from '../../src/game/riftspots';
import { orientFrame } from '../../src/game/portalMath';
import { Physics } from '../../src/sim/physics';
import { PropSystem } from '../../src/game/props';
import { ZoneManager } from '../../src/game/zones';
import { Game } from '../../src/game/game';
import { createSky, DEFAULT_SKY } from '../../src/render/fx';
import { createDecoSkyline } from '../../src/render/cityscape';
import { HALCYON_SKY, halcyonAtmosphere } from '../../src/world/halcyon/atmosphere';
import { setDevice, setLang, setWorldStrings, strings, t } from '../../src/ui/i18n';
import { ChallengeSystem } from '../../src/meta/challenges';

let L: TowerBuild;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const BODY: Partial<Record<EnemyKind, { r: number; h: number }>> = { rifleman: { r: 0.4, h: 1.8 }, warden: { r: 0.5, h: 1.9 } };

function groundAt(x: number, z: number, r: number, maxY: number) {
  let g = -Infinity;
  for (const c of L.world.colliders) {
    if (!c.enabled || c.max.y > maxY || c.max.y <= g) continue;
    if (x + r < c.min.x || x - r > c.max.x || z + r < c.min.z || z - r > c.max.z) continue;
    g = c.max.y;
  }
  return g;
}
function overlapping(x: number, z: number, r: number, y0: number, y1: number) {
  const out: Collider[] = [];
  for (const c of L.world.colliders) {
    if (!c.enabled || c.max.y <= y0 + 0.05 || c.min.y >= y1) continue;
    const cx = Math.max(c.min.x, Math.min(x, c.max.x)), cz = Math.max(c.min.z, Math.min(z, c.max.z));
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) out.push(c);
  }
  return out;
}
const fmt = (v: THREE.Vector3) => `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;
const desc = (cs: Collider[]) => cs.map((c) => `${c.tag ?? '?'}[${fmt(c.min)}..${fmt(c.max)}]`).join(', ');
const eye = (p: THREE.Vector3, h = 1.68) => V(p.x, p.y + h, p.z);
const zone = () => L.zones[0];
const enc = (lesson: string) => zone().encounters.find((e) => e.lesson === lesson)!;
const spawnOf = (id: string) => zone().encounters.flatMap((e) => e.spawns).find((s) => s.id === `pier.${id}`)!;
const killYAt = (p: THREE.Vector3) => L.killYAt?.(p) ?? L.seaY - 30;

/** A PORTAL tap on `man` seen from `you`: the straight-on throw, simulated. */
function tap(you: THREE.Vector3, man: THREE.Vector3) {
  const rifts = new RiftSystem(new THREE.Scene(), null, L.world, { portalScale: 0.5, lightCount: 2, maxViews: 2 });
  const host: SpotHost = { rifts, world: L.world, level: { seaY: L.seaY, isSea: (p) => L.isSea(p as THREE.Vector3) }, killYAt: (p) => killYAt(p as THREE.Vector3) };
  const d = V(man.x - you.x, 0, man.z - you.z).normalize();
  const S = PORTAL.straight;
  const exit = straightOn(host, man, d, S.past, S.up, S.tilt);
  if (!exit) return { wet: false, at: man.clone(), room: false };
  rifts.openEntranceFrame({ position: V(man.x, man.y + 0.01, man.z), quaternion: orientFrame(V(0, 1, 0), d), width: LAW.floorEndSize, height: LAW.floorEndSize }, 'floor', true);
  rifts.placeExitFrame(exit, null, { boost: PORTAL.throwSpeed.grab, noPlayer: true });
  const phys = new Physics(L.world, rifts, { seaY: L.seaY, isSea: (p) => L.isSea(p as THREE.Vector3), killYAt: (p) => killYAt(p as THREE.Vector3) });
  const b = phys.createBody('enemy', { pos: man.clone(), radius: 0.4, height: 1.8 });
  b.vel.set(0, -9, 0);
  let wet = false;
  const ev = { crossed() {}, impact() {}, touch() {}, splash: () => (wet = true), fellOut() {} };
  for (let i = 0; i < 240 && !wet; i++) phys.step(1 / 60, ev, i / 60);
  return { wet, at: b.pos.clone(), room: true };
}

/**
 * Walks a player body along waypoints with the engine's physics (step-up,
 * ground snap, collisions); `jump` hops at that waypoint. Returns where it
 * got stuck or died, or null when it arrived.
 */
function walk(from: THREE.Vector3, route: { p: THREE.Vector3; jump?: boolean }[]) {
  const rifts = new RiftSystem(new THREE.Scene(), null, L.world, { portalScale: 0.5, lightCount: 2, maxViews: 2 });
  const phys = new Physics(L.world, rifts, { seaY: L.seaY, isSea: (p) => L.isSea(p as THREE.Vector3), killYAt: (p) => killYAt(p as THREE.Vector3) });
  const b = phys.createBody('player', { pos: from.clone(), radius: FEEL.playerRadius, height: FEEL.playerHeight });
  let dead = '';
  const ev = { crossed() {}, impact() {}, touch() {}, splash: () => (dead = 'splash'), fellOut: () => (dead = 'void') };
  let t = 0;
  for (const w of route) {
    let jumped = false;
    for (let i = 0; ; i++) {
      const dx = w.p.x - b.pos.x, dz = w.p.z - b.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.35) break;
      if (i > 60 * 40 || dead) return `stuck at ${fmt(b.pos)} on the way to ${fmt(w.p)}${dead ? ` (${dead})` : ''}`;
      b.vel.x = (dx / d) * 4;
      b.vel.z = (dz / d) * 4;
      if (w.jump && !jumped && b.onGround) {
        b.vel.y = FEEL.jumpSpeed;
        jumped = true;
      }
      phys.step(1 / 60, ev, (t += 1 / 60));
    }
    // settle
    b.vel.x = b.vel.z = 0;
    for (let i = 0; i < 90; i++) phys.step(1 / 60, ev, (t += 1 / 60));
    if (dead) return `${dead} at ${fmt(b.pos)}`;
    if (Math.abs(b.pos.y - w.p.y) > 0.3) return `at ${fmt(b.pos)}, expected y ${w.p.y}`;
  }
  return null;
}

beforeAll(() => {
  L = buildHalcyon(null, false, { headless: true });
});

describe('Halcyon (mission 1, second world)', () => {
  it('builds headless as one zone, the pier, with the pier lessons in order', () => {
    expect(L.zones.map((z) => z.id)).toEqual(['pier']);
    const z = zone();
    expect(z.encounters.map((e) => e.lesson)).toEqual(['door', 'trapdoor', 'returnToSender', 'slingshot', 'arena']);
    expect(z.encounters.map((e) => e.id)).toEqual(['pier.door', 'pier.trapdoor', 'pier.returnToSender', 'pier.slingshot', 'pier.arena']);
    expect(z.encounters.map((e) => e.hintKey)).toEqual(['hint.halcyon.door', 'hint.halcyon.trapdoor', 'hint.returnToSender', 'hint.halcyon.slingshot', 'hint.arena']);
    expect(z.encounters[0].requireClear).toBe(false);
    for (const e of z.encounters.slice(1)) expect(e.requireClear).toBe(true);
    expect(z.challenges).toEqual(['pier.1', 'pier.2', 'pier.3']);
    expect(z.sea).toBe(true);
    expect(L.seaY).toBe(-2);
    expect(z.exit).toBeNull();
    expect(L.water).toBeTruthy();
    expect(L.lamps.length).toBeGreaterThan(30);
    for (const id of ['yard', 'skeleton', 'lab', 'crown'] as const) expect(L.zoneRoots[id]).toBeTruthy();
    expect(() => L.animated.forEach((f) => f(1.5))).not.toThrow();
    expect(L.menuView?.fov).toBeGreaterThan(30);
  });

  it("the menu postcard frames the concept: her in the middle, the airship upper left, the lit train and vault bottom right", () => {
    const mv = L.menuView!;
    for (const aspect of [16 / 9, 2.16])
      for (const sway of [-mv.sway, 0, mv.sway]) {
        const cam = new THREE.PerspectiveCamera(mv.fov, aspect, 0.1, 3000);
        cam.position.copy(mv.pos).x += sway;
        cam.lookAt(mv.look);
        cam.updateMatrixWorld();
        const at = (p: THREE.Vector3) => {
          const v = p.clone().project(cam);
          return { x: v.x * 0.5 + 0.5, y: 0.5 - v.y * 0.5 };
        };
        const seen = (p: THREE.Vector3) => {
          const d = p.clone().sub(cam.position);
          const hit = L.world.raycast(cam.position, d.clone().normalize(), d.length() - 1, { sight: true });
          return !hit || ['statue', 'train', 'airship', 'gondola'].includes(hit.collider.tag ?? '');
        };
        const where = `aspect ${aspect.toFixed(2)} sway ${sway}`;
        const top = at(V(-3.4, 44.5, 30.4)), foot = at(V(-2, 1.2, 15.4));
        expect(Math.abs(top.x - 0.5), where).toBeLessThan(0.08);
        expect(foot.y - top.y, where).toBeGreaterThan(0.4);
        const ship = at(V(24, 45, 48));
        expect(ship.x < 0.45 && ship.y < 0.2, where).toBe(true);
        // the train's nose out of the vault and the fan-light screen: bottom right, in sight
        for (const p of [V(-5, -4.8, -23.75), V(-8, 6, -24)]) {
          const s = at(p);
          expect(s.x > 0.6 && s.x < 0.95 && s.y > 0.7 && s.y < 0.97, `${where} ${fmt(p)} at ${s.x.toFixed(2)},${s.y.toFixed(2)}`).toBe(true);
          expect(seen(p), `${where} ${fmt(p)} hidden`).toBe(true);
        }
      }
  });

  it('its hints and texts exist in EN and HE (every device), short enough on a phone', () => {
    for (const lang of ['en', 'he'] as const) {
      const d = strings(lang);
      for (const e of zone().encounters) {
        const k = e.hintKey!;
        expect(d[k], `${lang} ${k}`).toBeTruthy();
        if (!d[k].includes('<kbd>')) continue;
        expect(d[`${k}.pad`], `${lang} ${k}.pad`).toBeTruthy();
        expect(d[`${k}.touch`], `${lang} ${k}.touch`).toBeTruthy();
        expect(d[`${k}.touch`]).not.toContain('<kbd>');
        if (k.startsWith('hint.halcyon.')) expect(d[`${k}.touch`].replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length, `${lang} ${k}.touch words`).toBeLessThanOrEqual(24);
      }
      for (const k of [L.missionEnd!.objKey, L.missionEnd!.toastKey!, L.drownKey!, 'menu.world', 'menu.worldNote', 'world.harbour', 'world.halcyon']) expect(d[k], `${lang} ${k}`).toBeTruthy();
      for (const k of ['zone.pier.name', 'zone.pier.sub', 'briefing.title', 'briefing.text', 'end.victory', 'end.victorySub', 'end.defeatSub', 'respawn.void']) expect(d[`halcyon:${k}`], `${lang} halcyon:${k}`).toBeTruthy();
    }
  });

  it('while Halcyon is loaded its texts replace the pier names, and switch back', () => {
    try {
      setLang('en');
      expect(t('zone.pier.name')).toBe('THE PIER');
      setWorldStrings('halcyon');
      expect(t('zone.pier.name')).toBe('TOMORROW SQUARE');
      expect(t('end.victory')).toBe('MISSION COMPLETE');
      expect(t('rule.1')).toBe(strings('en')['rule.1']);
      setDevice('touch');
      expect(t('hint.halcyon.door')).toBe(strings('en')['hint.halcyon.door.touch']);
      // challenge names (not t()'s texts) follow the world too: no "Pier Pressure" in a city
      const g = Object.assign(Object.create(Game.prototype), { challenges: new ChallengeSystem(null) });
      expect(g.challengeText('pier.3').title).toBe('Brighter Tomorrow');
      expect(g.challengeText('pier.2').title).toBe('Double Dip');
      setLang('he');
      expect(t('zone.pier.name')).toBe('כיכר המחר');
      expect(g.challengeText('pier.3').title).toBe('מחר מזהיר יותר');
      setWorldStrings('');
      expect(t('zone.pier.name')).toBe('הרציף');
      expect(g.challengeText('pier.3').title).toBe('לחץ על המזח');
    } finally {
      setWorldStrings('');
      setLang('en');
      setDevice('kbm');
    }
  });

  it('the start and every checkpoint have ground just below and room to stand; triggers lie in the zone', () => {
    const z = zone();
    const pts = [{ p: z.playerStart, what: 'start' }, ...z.encounters.filter((e) => e.checkpoint).map((e) => ({ p: e.checkpoint!.pos, what: `${e.id} checkpoint` }))];
    expect(pts.length).toBe(5);
    for (const { p, what } of pts) {
      const g = groundAt(p.x, p.z, 0.3, p.y + 0.05);
      expect(p.y - g, `${what} ${fmt(p)} ground ${g}`).toBeLessThanOrEqual(0.5);
      expect(p.y - g, `${what} ${fmt(p)} ground ${g}`).toBeGreaterThanOrEqual(-0.05);
      const o = overlapping(p.x, p.z, 0.34, p.y, p.y + 1.8);
      expect(o.length, `${what} ${fmt(p)} overlaps ${desc(o)}`).toBe(0);
      expect(z.bounds.containsPoint(p), `${what} in bounds`).toBe(true);
    }
    expect(enc('door').trigger.containsPoint(z.playerStart)).toBe(true);
    for (const e of z.encounters) expect(z.bounds.containsBox(e.trigger), e.id).toBe(true);
  });

  it('every spawn stands on walkable nav above the kill line, clear of colliders and props; patrols are clear', () => {
    const z = zone();
    const grids = z.nav.map((n) => new NavGrid(L.world, n));
    const spawns: SpawnDef[] = z.encounters.flatMap((e) => e.spawns);
    expect(spawns.length).toBe(11);
    for (const s of spawns) {
      const b = BODY[s.kind]!;
      expect(s.pos.y, `${s.id} above killY`).toBeGreaterThan(z.killY + 1);
      const li = z.nav.findIndex((n) => s.pos.x >= n.minX && s.pos.x <= n.maxX && s.pos.z >= n.minZ && s.pos.z <= n.maxZ && Math.abs(n.floorY - s.pos.y) <= 0.3);
      expect(li, `${s.id} ${fmt(s.pos)} on a nav layer`).toBeGreaterThanOrEqual(0);
      expect(grids[li].walkable(s.pos.x, s.pos.z), `${s.id} walkable`).toBe(true);
      for (const q of [s.pos, ...(s.route ?? [])]) {
        const g = groundAt(q.x, q.z, 0.3, q.y + 0.5);
        expect(Math.abs(g - q.y), `${s.id} ${fmt(q)} ground ${g}`).toBeLessThanOrEqual(0.3);
        const o = overlapping(q.x, q.z, b.r, q.y, q.y + b.h);
        expect(o.length, `${s.id} ${fmt(q)} overlaps ${desc(o)}`).toBe(0);
        for (const p of L.props) {
          if (p.hangFrom || Math.abs(p.pos.y - q.y) > 1) continue;
          expect(Math.hypot(p.pos.x - q.x, p.pos.z - q.z), `${s.id} clear of ${p.id}`).toBeGreaterThan(b.r + Math.max(p.size.x, p.size.z) / 2);
        }
      }
      if (s.route) for (let i = 1; i < s.route.length; i++) expect(grids[li].clearLine(s.route[i - 1].x, s.route[i - 1].z, s.route[i].x, s.route[i].z), `${s.id} patrol`).toBe(true);
    }
  });

  it('props: the cargo pod hangs plumb and clear under the airship, the rest rest on the ground', () => {
    const ids = new Set<string>();
    let hanging = 0;
    for (const p of L.props) {
      expect(ids.has(p.id), p.id).toBe(false);
      ids.add(p.id);
      const r = Math.min(p.size.x, p.size.z) / 2;
      if (p.hangFrom) {
        hanging++;
        expect(p.id).toBe('pier.hang.pod');
        expect(p.hangFrom.y).toBeGreaterThan(p.pos.y + p.size.y + 0.5);
        expect(Math.hypot(p.hangFrom.x - p.pos.x, p.hangFrom.z - p.pos.z)).toBeLessThan(0.01);
        expect(p.pos.y - groundAt(p.pos.x, p.pos.z, 0.2, p.pos.y), 'hangs clear').toBeGreaterThan(2);
        const cable = L.world.colliders.filter((c) => !['airship', 'gondola', 'boom'].includes(c.tag ?? '') && c.min.x < p.pos.x + 0.1 && c.max.x > p.pos.x - 0.1 && c.min.z < p.pos.z + 0.1 && c.max.z > p.pos.z - 0.1 && c.max.y > p.pos.y + p.size.y && c.min.y < p.hangFrom!.y);
        expect(cable.length, `cable blocked by ${desc(cable)}`).toBe(0);
      } else {
        const g = groundAt(p.pos.x, p.pos.z, Math.min(0.2, r), p.pos.y + 0.3);
        expect(Math.abs(g - p.pos.y), `${p.id} ${fmt(p.pos)} rests (ground ${g})`).toBeLessThanOrEqual(0.05);
      }
      const o = overlapping(p.pos.x, p.pos.z, r * 0.95, p.pos.y, p.pos.y + p.size.y);
      expect(o.length, `${p.id} ${fmt(p.pos)} overlaps ${desc(o)}`).toBe(0);
      if (p.kind === 'barrel') expect(p.explosive).toBe(true);
      expect(zone().bounds.containsPoint(p.pos), `${p.id} in zone`).toBe(true);
      expect(L.propMesh(p).position.distanceTo(p.pos)).toBeLessThan(1e-6);
    }
    expect(hanging).toBe(1);
  });

  it('door: from the start the Terrace across the rail cut is in sight and range; stepping off falls to the tracks', () => {
    const s = zone().playerStart;
    for (const p of [V(14, 6, -12), V(20, 6, -10), V(36, 6, -12)]) {
      expect(L.world.lineOfSight(eye(s), V(p.x, p.y + 0.3, p.z)), `sees ${fmt(p)}`).toBe(true);
      expect(eye(s).distanceTo(p)).toBeLessThan(LAW.riftRange);
    }
    expect(killYAt(V(12, -8, -26))).toBe(CUT_KILL_Y);
    expect(groundAt(12, -26, 0.3, 0)).toBe(-8);
  });

  it('trapdoor: a PORTAL tap from the walkway throws both River Gate guards into the river', () => {
    for (const you of [V(52, 6, -2), V(51, 6, 7), V(55, 6, -4)]) {
      for (const id of ['trap.a', 'trap.b']) {
        const man = spawnOf(id).pos;
        expect(L.world.lineOfSight(eye(you), V(man.x, man.y + 1.1, man.z)), `${id} seen from ${fmt(you)}`).toBe(true);
        const r = tap(you, man);
        expect(r.room, `room past ${id}`).toBe(true);
        expect(r.wet, `${id} from ${fmt(you)} ends at ${fmt(r.at)}`).toBe(true);
      }
    }
  });

  it('return to sender: the colonnade man sees the walkway through the arches, not the trapdoor pair', () => {
    const rts = spawnOf('rts.a').pos;
    const pts = [V(50, 6, 10), V(53, 6, 12), V(56, 6, 14), V(52, 6, 16), V(49, 6, 18), V(55, 6, 18), V(50, 6, 13)];
    expect(pts.filter((p) => L.world.lineOfSight(eye(p), eye(rts, 1.1))).length).toBeGreaterThanOrEqual(3);
    for (const id of ['trap.a', 'trap.b']) {
      const m = spawnOf(id).pos;
      expect(L.world.lineOfSight(eye(rts, 1.55), eye(m, 1.1)) || L.world.lineOfSight(eye(rts, 1.55), eye(m, 1.7)), `no sight of ${id}`).toBe(false);
    }
  });

  it("slingshot: from the Loggia roof the pavilion's wall faces the pair and takes a rift", () => {
    const stand = V(41, 14, 61);
    for (const z of [58, 61, 64]) {
      const from = eye(stand, 1.5);
      const hit = L.world.raycast(from, V(29.5, 7.2, z).sub(from).normalize(), 40, { sight: true });
      expect(hit?.collider.tag, `ray to z ${z}`).toBe('pavilion');
      expect(hit!.collider.noPortal).toBeFalsy();
      expect(hit!.normal.x).toBeGreaterThan(0.9);
    }
    for (const id of ['sling.a', 'sling.b']) expect(Math.abs(spawnOf(id).pos.x - 29.5)).toBeLessThanOrEqual(5);
    expect(stand.y - groundAt(38, 61, 0.3, stand.y - 1)).toBeGreaterThanOrEqual(7.5);
    expect(L.world.lineOfSight(eye(stand), eye(spawnOf('sling.a').pos, 1.1))).toBe(true);
  });

  it('arena: the pod over the warden is in sight from the stair top; the quay man can be tapped into the river', () => {
    const cp = enc('slingshot').checkpoint!.pos;
    const pod = L.props.find((p) => p.hangFrom)!;
    expect(L.world.lineOfSight(eye(cp), pod.pos.clone().setY(pod.pos.y + 1.5))).toBe(true);
    const w = spawnOf('arena.w').pos;
    expect(Math.hypot(w.x - pod.pos.x, w.z - pod.pos.z)).toBeLessThan(0.5);
    for (const you of [V(-6, 0, 52), V(-10, 0, 55)]) {
      const r = tap(you, spawnOf('arena.c').pos);
      expect(r.wet, `arena.c from ${fmt(you)} ends at ${fmt(r.at)}`).toBe(true);
    }
  });

  it('hooks: the rail cut kills, the river is water, the station stair goes down to the platform', () => {
    expect(L.killYAt!(V(-20, 0, -26))).toBe(CUT_KILL_Y);
    expect(L.killYAt!(V(0, 0, 30))).toBeNull();
    expect(L.killYAt!(V(-10, 0, -16))).toBeNull();
    expect(L.isSea(V(0, 0, 100))).toBe(true);
    expect(L.isSea(V(100, 0, 0))).toBe(true);
    expect(L.isSea(V(62, 0, 7))).toBe(false);
    expect(L.isSea(V(0, 0, 30))).toBe(false);
    expect(L.isSea(V(-20, 0, -26))).toBe(false);
    let prev = 0.01;
    for (let x = -19.8; x < -11.7; x += 0.44) {
      const g = groundAt(x, -16, 0.05, 0.5);
      expect(g, `stair at x ${x.toFixed(2)}`).toBeLessThan(prev);
      expect(prev - g).toBeLessThan(0.4);
      prev = g;
    }
    expect(groundAt(-13.3, -22, 0.2, -6)).toBe(PLATFORM_Y);
  });

  it('the mission ends on the train: the boarding box stands on the platform, open once the four fights are won', () => {
    const me = L.missionEnd!;
    expect(me).toBeTruthy();
    expect(me.box.containsPoint(BOARD_AT)).toBe(true);
    expect(Math.abs(groundAt(BOARD_AT.x, BOARD_AT.z, 0.3, BOARD_AT.y + 0.5) - PLATFORM_Y)).toBeLessThan(0.01);
    expect(overlapping(BOARD_AT.x, BOARD_AT.z, 0.34, BOARD_AT.y, BOARD_AT.y + 1.8).length).toBe(0);
    expect(killYAt(BOARD_AT)).toBeLessThan(BOARD_AT.y);
    expect([...me.requires].sort()).toEqual(['pier.arena', 'pier.returnToSender', 'pier.slingshot', 'pier.trapdoor']);
    expect(() => {
      me.ready(true);
      me.depart();
      L.animated.forEach((f) => f(3));
      me.ready(false);
    }).not.toThrow();
  });

  it('the exit is reachable on foot: Terrace, River Gate, colonnade, Loggia roof, café, Grand Stair, square, platform', () => {
    // (the door and the drop off the roof are the lessons' own moves; the rest is walking)
    const leg1 = walk(V(14, 6, -12), [
      { p: V(52, 6, -12) },
      { p: V(52, 6, 4) },
      { p: V(62, 6, 7) },
      { p: V(50, 6, 7) },
      // (round the river kiosk, past the colonnade's arches)
      { p: V(50, 6, 22) },
      { p: V(55.5, 6, 30) },
      { p: V(55.5, 14, 42) },
      { p: V(46, 14, 61) },
      { p: V(41, 14, 61) },
    ]);
    expect(leg1).toBeNull();
    const leg2 = walk(V(38.5, 6, 61), [
      { p: V(30.5, 6, 48) },
      { p: V(23, 6, 48) },
      { p: V(12, 0, 48) },
      { p: V(8, 0, 40) },
      { p: V(8, 0, 10) },
      { p: V(-21.5, 0, -10) },
      { p: V(-21.5, 0, -16) },
      { p: V(-10, PLATFORM_Y, -16) },
      { p: V(BOARD_AT.x, PLATFORM_Y, BOARD_AT.z) },
    ]);
    expect(leg2).toBeNull();
    // and the roof's café edge is a low lip you can hop
    expect(walk(V(46, 14, 61), [{ p: V(41.2, 14, 61) }, { p: V(37, 6, 61), jump: true }])).toBeNull();
  });

  it('the zone manager runs a one-zone level: objective to the train once cleared, no next zone, startAt falls back', () => {
    const zm = new ZoneManager(L);
    expect(zm.objective().key).toBe('obj.clear');
    expect(zm.objective().target!.equals(enc('trapdoor').trigger.getCenter(V(0, 0, 0)))).toBe(true);
    for (const e of zm.encounters) e.cleared = e.triggered = e.engaged = true;
    const o = zm.objective();
    expect(o.key).toBe('obj.train');
    expect(o.target!.equals(L.missionEnd!.target)).toBe(true);
    expect(zm.allCleared(L.missionEnd!.requires)).toBe(true);
    expect([...zm.active]).toEqual(['pier']);
    zm.startAt('yard');
    expect(zm.current.id).toBe('pier');
    expect(zm.checkpoint.pos.equals(zone().playerStart)).toBe(true);
  });

  it('nobody is placed in front of you: on early and reverse routes no spawn is in sight within 20 m as its fight triggers', () => {
    // [route start, ...waypoints]: the golden path, a drop off the Terrace up the pedestal's lane,
    // the forecourt to the Grand Stair and on up to the café, a door from the Belvedere into the square
    const routes = [
      [V(12, 12, -39), V(14, 6, -12), V(52, 6, -12), V(53, 6, 12), V(55.5, 6, 31), V(55.5, 14, 40), V(48, 14, 61), V(41, 14, 61)],
      [V(12, 12, -39), V(10, 6, -10), V(10, 0, -4), V(10, 0, 20), V(10, 0, 38)],
      [V(12, 12, -39), V(-4, 0, 8), V(10, 0, 40), V(12.8, 0, 48), V(22, 6, 48), V(30, 6, 52)],
      [V(12, 12, -39), V(-10, 0, 20), V(-4, 0, 40)],
    ];
    for (const r of routes) {
      const zm = new ZoneManager(L);
      const bad: string[] = [];
      const at = (p: THREE.Vector3) => {
        for (const e of zm.update(p).triggered)
          for (const s of e.def.spawns) {
            const d = s.pos.distanceTo(p);
            if (d < 20 && L.world.lineOfSight(eye(p), eye(s.pos, 1.3))) bad.push(`${s.id} ${d.toFixed(1)} m from ${fmt(p)}`);
          }
      };
      at(r[0]);
      // the first leg is a door, a drop or a walk: land on it, then walk the rest in 0.25 m steps
      at(r[1]);
      for (let i = 2; i < r.length; i++) {
        const n = Math.ceil(r[i - 1].distanceTo(r[i]) / 0.25);
        for (let k = 1; k <= n; k++) at(r[i - 1].clone().lerp(r[i], k / n));
      }
      expect(bad, `route to ${fmt(r[r.length - 1])}`).toEqual([]);
      expect(zm.encounters.find((e) => e.def.lesson === 'arena')!.triggered).toBe(true);
    }
  });

  it('the mobile build is gameplay-identical; rebuilds are deterministic', () => {
    const M = buildHalcyon(null, true, { headless: true });
    expect(M.world.colliders.length).toBe(L.world.colliders.length);
    expect(M.props.map((p) => `${p.id}@${p.pos.toArray()}`)).toEqual(L.props.map((p) => `${p.id}@${p.pos.toArray()}`));
    const spawns = (lv: TowerBuild) => lv.zones.flatMap((z) => z.encounters.flatMap((e) => e.spawns.map((s) => `${s.id}@${s.pos.toArray()}`)));
    expect(spawns(M)).toEqual(spawns(L));
    const again = buildHalcyon(null, false, { headless: true });
    expect(again.world.colliders.map((c) => `${fmt(c.min)}${fmt(c.max)}`)).toEqual(L.world.colliders.map((c) => `${fmt(c.min)}${fmt(c.max)}`));
    expect(L.world.colliders.length).toBeLessThan(1500);
  });
});

describe('Halcyon architecture: levels, walls and the lessons\' spaces', () => {
  /** The first solid thing a rift aim meets from `from` along `dir` (see-through railings let it pass). */
  const aim = (from: THREE.Vector3, dir: THREE.Vector3) => L.world.raycast(from, dir.clone().normalize(), 60, { sight: true });

  it('stairs connect the levels: square to café terrace, walkway to the Loggia roof, T1 to the podium, platform to forecourt', () => {
    // the Grand Stair, both flights and the landing
    expect(walk(V(10, 0, 48), [{ p: V(17.4, 3, 48) }, { p: V(25, 6, 48) }])).toBeNull();
    // the pedestal: its three steps, then its stair up to the podium top (a vantage 7.8 m up)
    expect(walk(V(-2, 0, 9), [{ p: V(-2, 1.2, 14.2) }, { p: V(-2, 7.8, 25) }])).toBeNull();
    // back up from the platform: the landing, the station stair, the forecourt
    expect(walk(V(-10, -7, -19.5), [{ p: V(-10, -7, -16) }, { p: V(-21.5, 0, -16) }, { p: V(-21.5, 0, -10) }])).toBeNull();
    // down the Loggia Stair from the roof to the walkway
    expect(walk(V(55.5, 14, 45), [{ p: V(55.5, 14, 41) }, { p: V(55.5, 6, 30) }])).toBeNull();
  });

  it('each nav layer is one walk grid for its squads: stairs are walls to it, every squad reaches its mates', () => {
    const z = zone();
    const [square, upper] = z.nav.map((n) => new NavGrid(L.world, n));
    const reach = (g: NavGrid, a: THREE.Vector3, b: THREE.Vector3) => {
      const path = g.findPath(a, b);
      return !!path && path.length > 0 && Math.hypot(path[path.length - 1].x - b.x, path[path.length - 1].z - b.z) < 1;
    };
    // the arena: from its checkpoint to every man of the squad, round the pedestal
    const cp = enc('arena').checkpoint!.pos;
    for (const id of ['arena.w', 'arena.a', 'arena.b', 'arena.c', 'arena.d']) expect(reach(square, cp, spawnOf(id).pos), id).toBe(true);
    // the upper ring: walkway to the River Gate and the colonnade; the café terrace to the slingshot pair
    expect(reach(upper, enc('trapdoor').checkpoint!.pos, spawnOf('trap.a').pos)).toBe(true);
    expect(reach(upper, enc('trapdoor').checkpoint!.pos, spawnOf('rts.a').pos)).toBe(true);
    expect(reach(upper, enc('slingshot').checkpoint!.pos, spawnOf('sling.a').pos)).toBe(true);
    // (stair treads are blocked cells: each squad keeps to its own level)
    expect(square.walkable(14.6, 48)).toBe(false);
    expect(upper.walkable(20.2, 48)).toBe(false);
    expect(square.walkable(-15, -16)).toBe(false);
  });

  it('walls that face the fights take a rift; the rotunda, the statue, the airship and every railing refuse one', () => {
    const takes: [string, THREE.Vector3, THREE.Vector3, string, THREE.Vector3][] = [
      ["the Hall's face on the square (behind the café arcade)", V(10, 2.5, 21.5), V(1, 0, 0), 'hall', V(-1, 0, 0)],
      ["the Terrace's retaining wall", V(14, 2.5, 5), V(0, 0, -1), 'ground:terrace', V(0, 0, 1)],
      ["the café terrace's wall on the square", V(10, 2.5, 62), V(1, 0, 0), 'ground:cafeTerrace', V(-1, 0, 0)],
      ['the stage backdrop', V(-21, 3, 0), V(0, 0, 1), 'stageBack', V(0, 0, -1)],
      ["the podium's east face", V(12, 4, 30), V(-1, 0, 0), 'podium', V(1, 0, 0)],
      ["the podium's west face", V(-20, 4, 30), V(1, 0, 0), 'podium', V(-1, 0, 0)],
      ["the podium's north face", V(-2, 4, 50), V(0, 0, -1), 'podium', V(0, 0, 1)],
      ["the Banner Tower's sunlit face", V(-15, 8, 0), V(-1, 0, 0), 'bannerTower', V(1, 0, 0)],
      ["the Kessler Pavilion's slingshot wall", V(36, 7.5, 61), V(-1, 0, 0), 'pavilion', V(1, 0, 0)],
    ];
    for (const [what, from, dir, tag, n] of takes) {
      const hit = aim(from, dir);
      expect(hit?.collider.tag, what).toBe(tag);
      expect(hit!.collider.noPortal, what).toBeFalsy();
      expect(hit!.normal.dot(n), what).toBeGreaterThan(0.99);
    }
    const refuses: [string, THREE.Vector3, THREE.Vector3, string][] = [
      ['the rotunda', V(-20, 5, 46), V(-1, 0, 0), 'rotunda'],
      ['the statue', V(-2, 15, 40), V(0, 0, -1), 'statue'],
      ['the airship', V(24, 30, 48), V(0, 1, 0), 'gondola'],
    ];
    for (const [what, from, dir, tag] of refuses) {
      const hit = aim(from, dir);
      expect(hit?.collider.tag, what).toBe(tag);
      expect(hit!.collider.noPortal, what).toBe(true);
    }
    for (const c of L.world.colliders.filter((q) => q.tag === 'rail' || q.tag === 'pole' || q.tag === 'barrier' || q.tag === 'hallRoofRail')) {
      expect(c.noPortal, `${c.tag} ${fmt(c.min)}`).toBe(true);
      expect(c.seeThrough, `${c.tag} ${fmt(c.min)}`).toBe(true);
    }
  });

  it('trapdoor: past each River Gate guard, along every approach tap line, open river with nothing in the way', () => {
    for (const you of [V(52, 6, -2), V(51, 6, 7), V(55, 6, -4)]) {
      for (const id of ['trap.a', 'trap.b']) {
        const man = spawnOf(id).pos;
        const d = V(man.x - you.x, 0, man.z - you.z).normalize();
        // off the landing within a few metres, then river for at least 12 m more
        let off = -1;
        for (let s = 0.5; s < 30; s += 0.25) {
          const q = man.clone().addScaledVector(d, s);
          if (off < 0 && L.isSea(q)) off = s;
          if (off >= 0 && s < off + 12) expect(L.isSea(q), `${id} from ${fmt(you)}: water at ${s.toFixed(2)} m past him`).toBe(true);
        }
        expect(off, `${id} from ${fmt(you)}`).toBeGreaterThan(0);
        expect(off, `${id} from ${fmt(you)}`).toBeLessThan(6);
        // nothing stands in the throw's way at chest height (a bollard is 0.66 m)
        const chest = V(man.x, man.y + 1.2, man.z);
        expect(L.world.raycast(chest, d, off + 12), `${id} from ${fmt(you)}`).toBeNull();
      }
    }
  });

  it("slingshot: the pavilion's wall faces the group and is big enough for a rift, the pair stands in front of it", () => {
    const wall = L.world.colliders.find((c) => c.tag === 'pavilion')!;
    expect(wall.noPortal).toBeFalsy();
    expect(wall.max.z - wall.min.z).toBeGreaterThanOrEqual(LAW.floorEndSize);
    expect(wall.max.y - UPPER).toBeGreaterThanOrEqual(3.2);
    for (const id of ['sling.a', 'sling.b']) {
      const m = spawnOf(id).pos;
      expect(m.x - wall.max.x, `${id} in front of the wall`).toBeGreaterThan(2);
      expect(m.z).toBeGreaterThan(wall.min.z + 1);
      expect(m.z).toBeLessThan(wall.max.z - 1);
      // (and the wall sees him: the fly-out path is clear)
      expect(L.world.lineOfSight(V(wall.max.x + 0.3, 7.2, m.z), eye(m, 1.1)), id).toBe(true);
    }
  });

  it('the hanging load: the cargo pod hangs from the airship\'s boom over the arena floor, over the warden', () => {
    const pod = L.props.find((p) => p.hangFrom)!;
    const boom = L.world.colliders.find((c) => c.tag === 'boom')!;
    const pulley = pod.hangFrom!;
    expect(new THREE.Box3(boom.min, boom.max).distanceToPoint(pulley)).toBeLessThan(0.5);
    // over the square's own walk grid, 11 m up
    const sq = zone().nav[0];
    expect(groundAt(pod.pos.x, pod.pos.z, 0.5, pod.pos.y)).toBe(sq.floorY);
    expect(pod.pos.x > sq.minX && pod.pos.x < sq.maxX && pod.pos.z > sq.minZ && pod.pos.z < sq.maxZ).toBe(true);
    expect(new NavGrid(L.world, sq).walkable(pod.pos.x, pod.pos.z)).toBe(true);
    const w = spawnOf('arena.w').pos;
    expect(Math.hypot(w.x - pod.pos.x, w.z - pod.pos.z)).toBeLessThan(0.5);
    expect(pod.pos.y - w.y).toBeGreaterThan(9);
    // (its cable clears the Grand Stair's rail and the square's lamps)
    for (const c of L.world.colliders) {
      if (['airship', 'gondola', 'boom'].includes(c.tag ?? '')) continue;
      const hitsCable = c.min.x < pod.pos.x + 0.2 && c.max.x > pod.pos.x - 0.2 && c.min.z < pod.pos.z + 0.2 && c.max.z > pod.pos.z - 0.2 && c.max.y > pod.pos.y;
      expect(hitsCable, `${c.tag} ${fmt(c.min)}`).toBe(false);
    }
  });

  it('its geometry is clean: every normal finite and unit length (one NaN pixel fed to bloom blacks out the frame)', () => {
    for (const lv of [L, buildHalcyon(null, true, { headless: true })]) {
      lv.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const n = m.geometry.getAttribute('normal');
        if (!n) return;
        for (let i = 0; i < n.count; i++) {
          const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
          if (!(Math.abs(l - 1) < 1e-3)) throw new Error(`${m.name}: normal ${i} has length ${l}`);
        }
      });
    }
  });

  it('stays within budget: three culled chunks, few meshes each, few shadow casters; phones get about half', () => {
    const tris = (lv: TowerBuild) => {
      let all = 0, cast = 0;
      lv.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const g = m.geometry;
        const n = ((g.index ? g.index.count : g.getAttribute('position').count) / 3) * ((m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1);
        all += n;
        if (m.castShadow) cast += n;
      });
      return { all, cast };
    };
    const t = tris(L);
    expect(t.all).toBeLessThan(300_000);
    expect(t.cast).toBeLessThan(60_000);
    const chunks = L.zoneRoots.pier.children.filter((c) => /^halcyon:(left|centre|right)$/.test(c.name));
    expect(chunks.map((c) => c.name)).toEqual(['halcyon:left', 'halcyon:centre', 'halcyon:right']);
    for (const c of chunks) {
      let meshes = 0;
      c.traverse((o) => ((o as THREE.Mesh).isMesh ? meshes++ : 0));
      expect(meshes, c.name).toBeLessThanOrEqual(24);
    }
    const M = buildHalcyon(null, true, { headless: true });
    expect(tris(M).all).toBeLessThan(t.all * 0.56);
    expect(tris(buildHalcyon(null, false, { headless: true })).all).toBe(t.all);
    // phones cast what the PC casts: the same buckets (railings, ironwork, paint, leaves too) and the same box
    const casting = (lv: TowerBuild) => {
      const keys = new Set<string>();
      lv.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.castShadow && /^halcyon:(left|centre|right):[a-z]+$/.test(m.name)) keys.add(m.name.split(':')[2]);
      });
      return [...keys].sort();
    };
    expect(casting(M)).toEqual(casting(L));
    expect(casting(M)).toEqual(expect.arrayContaining(['foliage', 'iron', 'lattice', 'leaves', 'paint', 'stone', 'trim']));
    expect(M.atmosphere.shadow).toEqual(L.atmosphere.shadow);
  });
});

describe('the game with a second world', () => {
  const bare = (fields: Record<string, unknown>) => Object.assign(Object.create(Game.prototype), fields) as any;

  it('draws every prop where its body stands, in either world (the pod 11 m up, casks on a terrace, a 30th-floor barrel)', () => {
    for (const lv of [L, buildTower(null, false, { headless: true })]) {
      const rifts = new RiftSystem(new THREE.Scene(), null, lv.world, { portalScale: 0.5, lightCount: 2, maxViews: 2 });
      const phys = new Physics(lv.world, rifts, { seaY: lv.seaY, isSea: (p) => lv.isSea(p as THREE.Vector3), killYAt: () => lv.seaY - 30 });
      const props = new PropSystem(phys, lv);
      for (const z of lv.zones) props.spawnZone(z.id);
      const raised = props.items.filter((p) => p.body.pos.y > 1);
      expect(raised.length).toBeGreaterThan(0);
      for (const p of props.items) {
        const bb = new THREE.Box3().setFromObject(p.mesh);
        expect(Math.abs(bb.min.y - p.body.pos.y), `${p.id} at ${fmt(p.body.pos)}`).toBeLessThan(0.05);
      }
    }
  });

  it('frees what it takes away: the cables a respawn replaces, and a world switch its systems and characters', () => {
    const rifts = new RiftSystem(new THREE.Scene(), null, L.world, { portalScale: 0.5, lightCount: 2, maxViews: 2 });
    const phys = new Physics(L.world, rifts, { seaY: L.seaY, isSea: (p) => L.isSea(p as THREE.Vector3), killYAt: () => L.seaY - 30 });
    const props = new PropSystem(phys, L);
    props.spawnZone('pier');
    const freed = new Set<unknown>();
    const watch = (x: THREE.EventDispatcher<any>) => x.addEventListener('dispose', () => freed.add(x));
    const cables = props.items.filter((p) => p.cable).map((p) => p.cable!.geometry);
    expect(cables.length).toBeGreaterThan(0);
    cables.forEach(watch);
    props.clear();
    for (const c of cables) expect(freed.has(c)).toBe(true);

    // unloading a world: every object it added is freed, a skinned man's bone texture too (his asset's buffers aren't)
    const scene = new THREE.Scene();
    const pool = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
    const skin = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    skin.bind(new THREE.Skeleton([new THREE.Bone()]));
    const bones = skin.skeleton.computeBoneTexture().boneTexture!;
    const man = new THREE.Group().add(skin);
    // (an instanced mesh's matrix buffer goes only with the mesh's own dispose)
    const crowd = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 4);
    [pool.geometry, pool.material, bones, skin.geometry, crowd, crowd.geometry].forEach(watch);
    const noop = { clear() {}, dispose() {} };
    const lv = { ...L, materials: {}, root: new THREE.Group() };
    const g = bare({ scene, level: lv, enemies: noop, projectiles: noop, props: { group: new THREE.Group(), clear() {} }, rifts: noop, hero: noop, worldObjs: [pool, man, crowd], riftMarked: new Set(), strikeMarks: null });
    scene.add(pool, man, crowd);
    g.unloadWorld();
    expect(scene.children.length).toBe(0);
    expect(freed.has(pool.geometry) && freed.has(pool.material)).toBe(true);
    expect(freed.has(bones)).toBe(true);
    expect(freed.has(skin.geometry)).toBe(false);
    expect(freed.has(crowd) && freed.has(crowd.geometry)).toBe(true);
    expect(g.built).toBe(false);
  });

  it('a world that fails to build leaves nothing behind, so another can be built in its place', () => {
    const scene = new THREE.Scene();
    const keep = new THREE.Group();
    scene.add(keep);
    const half = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    let freed = false;
    half.geometry.addEventListener('dispose', () => (freed = true));
    const g = bare({ scene, worldObjs: [keep], built: false });
    g.buildWorldInto = () => {
      scene.environment = new THREE.Texture();
      scene.add(half);
      throw new Error('no float textures here');
    };
    expect(() => g.buildWorld('halcyon')).toThrow('no float textures');
    expect(scene.children).toEqual([keep]);
    expect(scene.environment).toBeNull();
    expect(freed).toBe(true);
    expect(g.built).toBe(false);
    // the next one builds, and a switch unloads only a world that was built
    g.buildWorldInto = () => scene.add(half);
    let unloaded = 0;
    g.unloadWorld = () => unloaded++;
    g.setWorld('harbour');
    expect(g.built).toBe(true);
    expect(unloaded).toBe(0);
    g.world = 'harbour';
    g.setWorld('halcyon');
    expect(unloaded).toBe(1);
  });

  it('kills on the tracks at the level line, and keeps the harbour rules elsewhere', () => {
    const g = bare({ level: L, zones: new ZoneManager(L), enemies: { enemyOfBody: () => null } });
    expect(g.killYAt(V(-20, -7, -26))).toBe(CUT_KILL_Y);
    expect(g.killYAt(V(0, 0, 30))).toBe(L.seaY - 30);
    const H = buildTower(null, false, { headless: true });
    const h = bare({ level: H, zones: new ZoneManager(H), enemies: { enemyOfBody: () => null } });
    expect(h.killYAt(V(0, 0, -20))).toBe(H.seaY - 30);
  });

  it('opens the train once the last required fight is cleared (not before), and a new run shuts it', () => {
    const calls: boolean[] = [];
    const me = { ...L.missionEnd!, ready: (on: boolean) => calls.push(on) };
    const level = { ...L, missionEnd: me };
    const zm = new ZoneManager(level);
    const toasts: string[] = [];
    const g = bare({ level, zones: zm, meReady: false, hud: { toast: (s: string) => toasts.push(s) }, audio: { sting() {} } });
    for (const e of zm.encounters.slice(0, 4)) e.cleared = true;
    g.checkMissionEnd();
    expect(calls).toEqual([]);
    zm.encounters[4].cleared = true;
    g.checkMissionEnd();
    g.checkMissionEnd();
    expect(calls).toEqual([true]);
    expect(g.meReady).toBe(true);
    expect(toasts).toEqual([t('toast.trainReady')]);
  });

  it("boarding wins the run without the crown's challenge", () => {
    const done: string[] = [];
    let departed = 0;
    const g = bare({
      level: { missionEnd: { ...L.missionEnd!, depart: () => departed++ } },
      hero: { root: { visible: true } },
      victoryT: -1,
      bossDead: false,
      boarded: false,
      challenges: { complete: (id: string) => done.push(id) },
      audio: { sting() {} },
    });
    g.board();
    expect(departed).toBe(1);
    expect(g.boarded).toBe(true);
    expect(g.hero.root.visible).toBe(false);
    expect(g.victoryT).toBeGreaterThan(0);
    expect(done).toEqual([]);
    // (the harbour's ending still awards it)
    const h = bare({ victoryT: -1, bossDead: true, challenges: { complete: (id: string) => done.push(id) }, audio: { sting() {} } });
    h.victory();
    expect(done).toEqual(['crown.3']);
  });
});

describe('worlds', () => {
  const mem = (v: string | null, throws = false): WorldStore => ({
    getItem: () => {
      if (throws) throw new Error('sandboxed');
      return v;
    },
    setItem: () => {
      if (throws) throw new Error('sandboxed');
    },
  });

  it('picks the URL first, then the saved choice, else the default; storage that throws is fine', () => {
    expect(readWorld('?world=harbour', mem('halcyon'))).toBe('harbour');
    expect(readWorld('?world=halcyon', mem('harbour'))).toBe('halcyon');
    expect(readWorld('', mem('harbour'))).toBe('harbour');
    expect(readWorld('?world=nowhere', mem('bogus'))).toBe(DEFAULT_WORLD);
    expect(readWorld('', mem(null, true))).toBe(DEFAULT_WORLD);
    expect(readWorld('', null)).toBe(DEFAULT_WORLD);
  });

  it('builds either world; the harbour is still the five-zone tower with its default sky', () => {
    const H = buildWorld('harbour', null, false, { headless: true });
    expect(H.zones.map((z) => z.id)).toEqual(['pier', 'yard', 'skeleton', 'lab', 'crown']);
    expect(H.killYAt).toBeUndefined();
    expect(H.missionEnd).toBeUndefined();
    expect(H.menuView).toBeUndefined();
    expect(H.atmosphere.sky).toBeUndefined();
    // (the harbour keeps its look: no rim light on its men, its bloom and rift flash as they were)
    expect(H.atmosphere.rim).toBeUndefined();
    expect(H.atmosphere.look).toBeUndefined();
    expect(buildWorld('halcyon', null, false, { headless: true }).zones.map((z) => z.id)).toEqual(['pier']);
    // Halcyon: a rim on its backlit men; phones draw no lamp cones and bloom less of the low sun
    const desk = halcyonAtmosphere(false), phone = halcyonAtmosphere(true);
    expect(desk.rim).toBeGreaterThan(0);
    expect(desk.lampLook!.cones).toBeGreaterThan(0);
    expect(phone.lampLook!.cones).toBe(0);
    expect(phone.look!.bloom[2]).toBeGreaterThan(desk.look!.bloom[2]);
    expect(phone.look!.bloomClamp!).toBeLessThanOrEqual(desk.look!.bloomClamp!);
    // the harbour's sky uniforms are the old constants
    const u = (createSky().material as THREE.ShaderMaterial).uniforms;
    expect(u.uZenith.value.toArray()).toEqual(DEFAULT_SKY.zenith);
    expect(u.uHorizonSun.value.toArray()).toEqual([1.25, 0.56, 0.2]);
    expect(u.uCover.value.toArray()).toEqual([0.56, 0.8]);
    expect(u.uHeaps.value).toBe(0);
    // (Halcyon's big cumulus and softer halo are off by default)
    expect(u.uPuff.value).toBe(0);
    expect(u.uHalo.value).toBe(1);
  });

  it("Halcyon's far city is one clean mesh (one draw), lighter on phones; its sky has the big cumulus", () => {
    const count = (o: THREE.Object3D) => {
      let meshes = 0, tris = 0;
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (!m.isMesh) return;
        meshes++;
        tris += m.geometry.index!.count / 3;
        const n = m.geometry.getAttribute('normal');
        for (let i = 0; i < n.count; i++) expect(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1)).toBeLessThan(1e-3);
      });
      return { meshes, tris };
    };
    const d = count(createDecoSkyline({ sky: HALCYON_SKY })), m = count(createDecoSkyline({ mobile: true, sky: HALCYON_SKY }));
    expect(d.meshes).toBe(1);
    expect(d.tris).toBeLessThan(25_000);
    expect(m.tris).toBeLessThan(d.tris * 0.75);
    expect(HALCYON_SKY.puff).toBeGreaterThan(0);
  });
});
