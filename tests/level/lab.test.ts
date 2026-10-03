import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as THREE from 'three';
import { buildCombatLab } from '../../src/world/combatlab';
import type { TowerBuild } from '../../src/world/tower';
import { ALL_WORLDS, buildWorld, readWorld, WORLDS, type WorldStore } from '../../src/world/worlds';
import { DECK, GATES, KILL_Y, labWaves, LOADS, ONSLAUGHT_WAVES, POOL, RING, SEA_Y, STAIR_E, STAIR_W, TOWER_H, TOWERS, WAVES } from '../../src/world/combatlab/layout';
import type { Collider } from '../../src/world/collision';
import { NavGrid } from '../../src/world/nav';
import { FEEL } from '../../src/config';
import { KIND } from '../../src/actors/tuning';
import { onFoot } from './reach';
import { fmtTime, killTool, LAB_TIMING, LabDirector, type LabDirectorHooks } from '../../src/game/labdirector';
import { activeVariant, chosenVariant, setLabActive, setVariant, variantForKey } from '../../src/game/variant';
import { readSettings } from '../../src/game/settings';
import { strings } from '../../src/ui/i18n';

let L: TowerBuild;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const fmt = (v: THREE.Vector3) => `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;

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

beforeAll(() => {
  L = buildCombatLab(null, false, { headless: true });
});

afterEach(() => {
  setVariant('current');
  setLabActive(false);
});

describe('COMBAT LAB: the arena', () => {
  it('is a third world, built headless in place of the others, never in the mission toggle', () => {
    expect(ALL_WORLDS).toContain('lab');
    expect(WORLDS).not.toContain('lab');
    const store: WorldStore = { getItem: () => null, setItem() {} };
    expect(readWorld('?world=lab', store)).toBe('lab');
    const b = buildWorld('lab', null, true, { headless: true });
    expect(b.lab?.waves.length).toBe(5);
    expect(L.zones.map((z) => z.id)).toEqual(['pier']);
    expect(L.zones[0].encounters).toEqual([]);
    expect(L.missionEnd ?? null).toBeNull();
    expect(L.atmosphere.skyline).toBe('none');
    expect(L.water).toBeTruthy();
    expect(() => L.animated.forEach((f) => f(2))).not.toThrow();
    // one merged mesh per material (a handful of draw calls for the whole arena)
    let meshes = 0;
    L.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes++;
    });
    expect(meshes).toBeLessThanOrEqual(14);
  });

  it('the pad: ground under it, room to stand, facing the arena', () => {
    const p = L.lab!.pad.pos;
    expect(Math.abs(groundAt(p.x, p.z, 0.3, p.y + 0.05) - p.y)).toBeLessThan(0.02);
    expect(overlapping(p.x, p.z, 0.34, p.y, p.y + 1.8)).toEqual([]);
    expect(L.zones[0].playerStart.distanceTo(p)).toBeLessThan(1e-6);
  });

  it('every gate and every post stands on nav, on the ground, with room for the man', () => {
    const z = L.zones[0];
    const grids = z.nav.map((n) => new NavGrid(L.world, n));
    const layerOf = (p: THREE.Vector3) => z.nav.findIndex((n) => p.x >= n.minX && p.x <= n.maxX && p.z >= n.minZ && p.z <= n.maxZ && Math.abs(n.floorY - p.y) <= 0.3);
    for (const g of GATES) {
      const li = layerOf(g.pos);
      expect(li, `gate ${g.id} on a layer`).toBeGreaterThanOrEqual(0);
      expect(grids[li].walkable(g.pos.x, g.pos.z), `gate ${g.id} walkable`).toBe(true);
      expect(Math.abs(groundAt(g.pos.x, g.pos.z, 0.3, g.pos.y + 0.3) - g.pos.y), `gate ${g.id} ground`).toBeLessThan(0.05);
      expect(overlapping(g.pos.x, g.pos.z, 0.6, g.pos.y, g.pos.y + 2.2), `gate ${g.id} clear`).toEqual([]);
    }
    // (ONSLAUGHT's own sequence stands on the same ground rules)
    for (const [wi, w] of [...WAVES, ...ONSLAUGHT_WAVES].entries()) {
      for (const s of w.spawns) {
        const where = `${wi < WAVES.length ? 'W' : 'O'}${(wi % WAVES.length) + 1} ${s.kind} ${fmt(s.post)}`;
        const gate = GATES.find((g) => g.id === s.gate)!;
        expect(gate, where).toBeTruthy();
        const li = layerOf(s.post);
        expect(li, `${where} on a layer`).toBeGreaterThanOrEqual(0);
        expect(grids[li].walkable(s.post.x, s.post.z), `${where} walkable`).toBe(true);
        expect(Math.abs(groundAt(s.post.x, s.post.z, 0.3, s.post.y + 0.3) - s.post.y), `${where} ground`).toBeLessThan(0.05);
        const k = KIND[s.kind];
        expect(overlapping(s.post.x, s.post.z, k.radius, s.post.y, s.post.y + k.height), `${where} clear`).toEqual([]);
        for (const p of L.props) {
          if (p.hangFrom) continue;
          expect(Math.hypot(p.pos.x - s.post.x, p.pos.z - s.post.z), `${where} clear of ${p.id}`).toBeGreaterThan(k.radius + Math.max(p.size.x, p.size.z) / 2);
        }
        // through an edge gate he walks in: there is a path from the gate to his post
        if (gate.kind === 'edge') {
          expect(li, `${where}: an edge gate's man holds the deck`).toBe(0);
          expect(grids[0].findPath(gate.pos, s.post), `${where}: a path in from ${gate.id}`).not.toBeNull();
        } else expect(s.post.distanceTo(gate.pos), `${where} stands where his rift opens`).toBeLessThan(0.01);
        if (s.role === 'holder') expect(s.post.y, `${where}: holders hold the towers`).toBe(TOWER_H);
      }
    }
    // the tower tops take the holders; the ring takes the drops onto it
    expect(WAVES.flatMap((w) => w.spawns).filter((s) => s.gate === 'tw' || s.gate === 'te').length).toBeGreaterThanOrEqual(6);
  });

  it('the waves escalate: more men, heavier kinds', () => {
    const n = WAVES.map((w) => w.spawns.length);
    for (let i = 1; i < n.length; i++) expect(n[i]).toBeGreaterThanOrEqual(n[i - 1]);
    expect(WAVES[0].spawns.every((s) => s.kind === 'rifleman' && s.role === 'anchor')).toBe(true);
    const kinds = new Set(WAVES[3].spawns.map((s) => s.kind));
    for (const k of ['grenadier', 'sniper', 'brute', 'warden', 'rifleman']) expect(kinds.has(k as never), `W4 has a ${k}`).toBe(true);
    for (const w of WAVES) for (const k of ['en', 'he'] as const) expect(strings(k)[w.subKey], `${k} ${w.subKey}`).toBeTruthy();
  });

  it('on foot: the ring is reached by both stairs; the towers never are', () => {
    const start = L.lab!.pad.pos;
    const reach = onFoot(L.world, { x0: -31, x1: 31, z0: -31, z1: DECK.z1 }, [start]);
    expect(reach.reached(V(0, RING.y, RING.cz - RING.outer + 1))).toBe(true);
    expect(reach.reached(V(STAIR_W.x0 + 1, 2, STAIR_W.zTop + 4 + 0.25), 0.2)).toBe(true);
    expect(reach.reached(V(STAIR_E.x0 + 1, 2, STAIR_E.zTop - 4 - 0.25), 0.2)).toBe(true);
    for (const t of TOWERS) expect(reach.reached(V(t.x, TOWER_H, t.z)), `tower ${t.id}: ${reach.route(V(t.x, TOWER_H, t.z))}`).toBe(false);
  });

  it('the tower tops take a rift: aimed from the ring, and from above', () => {
    for (const t of TOWERS) {
      const eye = V(t.x * 0.35, RING.y + 1.68, RING.cz + RING.outer - 1);
      const aim = V(t.x, TOWER_H, t.z);
      const d = aim.clone().sub(eye);
      const hit = L.world.raycast(eye, d.clone().normalize(), d.length() + 1, { sight: true });
      // (from below you see its edge: a PORTAL aimed high on its side perches the exit on top)
      expect(hit?.collider.tag, `ray to ${t.id}`).toBe('towerTop');
      expect(hit!.collider.noPortal).toBeFalsy();
      // from above (a fall, a loop) the top itself: open floor facing up
      const down = L.world.raycast(V(t.x + 0.5, 30, t.z - 0.5), V(0, -1, 0), 40, { sight: true });
      expect(down?.collider.tag).toBe('towerTop');
      expect(down!.normal.y).toBeGreaterThan(0.9);
      expect(down!.point.y).toBeCloseTo(TOWER_H, 5);
      // a floor end fits on it (1.7 m) with room
      const top = hit!.collider;
      expect(top.max.x - top.min.x).toBeGreaterThan(3);
      expect(top.max.z - top.min.z).toBeGreaterThan(3);
    }
  });

  it('the long wall and the perimeter take doors; the gantry does not', () => {
    const w = L.world.colliders.find((c) => c.tag === 'longWall')!;
    expect(w.noPortal).toBeFalsy();
    expect(w.max.y - w.min.y).toBeGreaterThanOrEqual(FEEL.portalHeight + 1);
    expect(w.max.z - w.min.z).toBeGreaterThan(20);
    for (const c of L.world.colliders.filter((q) => q.tag === 'gantry')) expect(c.noPortal).toBe(true);
  });

  it('lethal: the void past the north edge, the pool; the deck is not', () => {
    expect(L.killYAt!(V(0, 0, DECK.z1 + 5))).toBe(KILL_Y);
    expect(groundAt(0, DECK.z1 + 3, 0.2, 1)).toBe(-Infinity);
    expect(L.seaY).toBe(SEA_Y);
    const pc = V((POOL.x0 + POOL.x1) / 2, 0, (POOL.z0 + POOL.z1) / 2);
    expect(L.isSea(pc)).toBe(true);
    expect(groundAt(pc.x, pc.z, 0.2, 1)).toBe(-Infinity);
    expect(L.isSea(V(0, 0, 0))).toBe(false);
    expect(groundAt(0, -20, 0.2, 1)).toBe(0);
  });

  it('the loads hang plumb from the gantry, clear over the deck; the rest rest on it', () => {
    let hanging = 0;
    for (const p of L.props) {
      const r = Math.min(p.size.x, p.size.z) / 2;
      if (p.hangFrom) {
        hanging++;
        expect(LOADS.some((l) => l.id === p.id)).toBe(true);
        expect(Math.hypot(p.hangFrom.x - p.pos.x, p.hangFrom.z - p.pos.z)).toBeLessThan(0.01);
        expect(p.pos.y - groundAt(p.pos.x, p.pos.z, 0.2, p.pos.y)).toBeGreaterThan(3);
        const cable = L.world.colliders.filter((c) => c.min.x < p.pos.x + 0.1 && c.max.x > p.pos.x - 0.1 && c.min.z < p.pos.z + 0.1 && c.max.z > p.pos.z - 0.1 && c.max.y > p.pos.y + p.size.y && c.min.y < p.hangFrom!.y - 0.01);
        expect(cable, 'cable clear').toEqual([]);
      } else expect(Math.abs(groundAt(p.pos.x, p.pos.z, Math.min(0.2, r), p.pos.y + 0.3) - p.pos.y), p.id).toBeLessThan(0.05);
      expect(overlapping(p.pos.x, p.pos.z, r * 0.95, p.pos.y, p.pos.y + p.size.y), p.id).toEqual([]);
    }
    expect(hanging).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// The wave director
// ---------------------------------------------------------------------------

function fakeRun() {
  const alive = new Map<number, boolean>();
  let next = 1;
  const log: string[] = [];
  const hooks: LabDirectorHooks = {
    spawn: (s, g, w) => {
      const id = next++;
      alive.set(id, true);
      log.push(`spawn W${w} ${s.kind}@${g.id}`);
      return id;
    },
    alive: (id) => alive.get(id) ?? false,
    announce: (n) => log.push(`announce ${n}`),
    cleared: (n, t) => log.push(`cleared ${n} ${t.toFixed(1)}`),
    finished: () => log.push('finished'),
  };
  const d = new LabDirector(L.lab!, hooks);
  const step = (sec: number) => {
    for (let i = 0; i < Math.round(sec * 60); i++) d.update(1 / 60);
  };
  const killAll = () => {
    for (const id of d.ids) alive.set(id, false);
  };
  return { d, log, step, killAll, alive };
}

describe('COMBAT LAB: the wave director', () => {
  it('announces W1, brings its men through their gates one by one after the breather', () => {
    const { d, log, step } = fakeRun();
    d.start();
    expect(d.phase).toBe('breather');
    expect(log).toEqual(['announce 1']);
    step(LAB_TIMING.first - 0.1);
    expect(d.ids.length).toBe(0);
    step(0.2);
    expect(d.phase).toBe('fight');
    // (one per gate at once; W1's three come through three different gates)
    expect(d.ids.length).toBe(3);
    expect(d.left).toBe(3);
  });

  it('advances wave by wave with a breather, times each, and finishes after W5', () => {
    const { d, log, step, killAll } = fakeRun();
    d.start();
    for (let w = 0; w < WAVES.length; w++) {
      step(w === 0 ? LAB_TIMING.first + 0.1 : LAB_TIMING.breather + 0.1);
      expect(d.phase, `W${w + 1}`).toBe('fight');
      step(2 + w);
      expect(d.ids.length, `W${w + 1} all through`).toBe(WAVES[w].spawns.length);
      killAll();
      step(1 / 60);
      expect(d.stats.waves[w].cleared).toBe(true);
      expect(d.stats.waves[w].time).toBeGreaterThan(1.9 + w);
    }
    expect(d.phase).toBe('done');
    expect(d.stats.done).toBe(true);
    expect(log.filter((l) => l.startsWith('announce')).length).toBe(5);
    expect(log.at(-1)).toBe('finished');
    const t = d.stats.total;
    step(5);
    expect(d.stats.total).toBe(t);
  });

  it('keeps the run stats: damage, deaths, kills by tool (per wave too), and resets them', () => {
    const { d, step } = fakeRun();
    d.noteKill('reflect');
    expect(d.totalKills()).toBe(0);
    d.start();
    step(LAB_TIMING.first + 0.1);
    d.noteDamage(15);
    d.noteDamage(-3);
    d.noteDeath();
    d.noteKill('reflect');
    d.noteKill('grab');
    d.noteKill('grab');
    expect(d.stats.damage).toBe(15);
    expect(d.stats.deaths).toBe(1);
    expect(d.stats.kills.grab).toBe(2);
    expect(d.totalKills()).toBe(3);
    expect(d.stats.waves[0]).toMatchObject({ damage: 15, deaths: 1, kills: 3 });
    d.reset();
    expect(d.phase).toBe('idle');
    expect(d.totalKills()).toBe(0);
    expect(d.stats.damage).toBe(0);
    expect(d.stats.waves.every((w) => !w.cleared && w.time === 0)).toBe(true);
  });

  it('a variant switch starts the run over under it', () => {
    const { d, step, killAll } = fakeRun();
    setLabActive(true);
    d.start();
    step(LAB_TIMING.first + 0.1);
    killAll();
    step(LAB_TIMING.breather + 0.2);
    d.noteDamage(30);
    expect(d.wave).toBe(1);
    d.setVariant('precision');
    expect(chosenVariant()).toBe('precision');
    expect(activeVariant()).toBe('precision');
    expect(d.stats.variant).toBe('precision');
    expect(d.wave).toBe(0);
    expect(d.phase).toBe('breather');
    expect(d.stats.damage).toBe(0);
    expect(d.stats.waves[0].cleared).toBe(false);
  });
});

describe('COMBAT LAB: variants and kill credit', () => {
  it('CURRENT everywhere outside the lab; the pick only inside it; F1-F3; a setting', () => {
    setVariant('onslaught');
    expect(activeVariant()).toBe('current');
    setLabActive(true);
    expect(activeVariant()).toBe('onslaught');
    setVariant('bogus');
    expect(activeVariant()).toBe('current');
    expect(['F1', 'F2', 'F3', 'F4', 'F5'].map(variantForKey)).toEqual(['current', 'precision', 'onslaught', 'flow', null]);
    // (the lab offers REACH only now: a new player, an old pick or a broken one all come back as REACH)
    expect(readSettings(null).combatVariant).toBe('reach');
    expect(readSettings(JSON.stringify({ combatVariant: 'precision' })).combatVariant).toBe('reach');
    expect(readSettings(JSON.stringify({ combatVariant: 'nope' })).combatVariant).toBe('reach');
  });

  it('credits kills to the tool that made them', () => {
    const base = { strike: null, cause: 'impact' as const, viaTrapdoor: false, victimCrossings: 0, killerCrossings: 0, charged: false };
    expect(killTool({ ...base, strike: 'reflect' })).toBe('reflect');
    expect(killTool({ ...base, strike: 'geyser' })).toBe('loop');
    expect(killTool({ ...base, strike: 'cannon' })).toBe('loop');
    expect(killTool({ ...base, strike: 'swap' })).toBe('swap');
    expect(killTool({ ...base, strike: 'dash' })).toBe('dash');
    expect(killTool({ ...base, cause: 'blade' })).toBe('blade');
    expect(killTool({ ...base, victimCrossings: 1, charged: true })).toBe('grab');
    expect(killTool({ ...base, viaTrapdoor: true })).toBe('grab');
    expect(killTool({ ...base, cause: 'bolt', killerCrossings: 1, charged: true })).toBe('grab');
    expect(killTool({ ...base, cause: 'explosion' })).toBe('other');
    expect(fmtTime(59.96)).toBe('0:59.9');
    expect(fmtTime(83.25)).toBe('1:23.2');
  });
});

describe('COMBAT LAB: ONSLAUGHT waves', () => {
  it('each variant plays its own list: CURRENT and PRECISION the baseline, ONSLAUGHT its own', () => {
    const a = L.lab!;
    expect(labWaves(a, 'current')).toBe(a.waves);
    expect(labWaves(a, 'precision')).toBe(a.waves);
    const o = labWaves(a, 'onslaught');
    expect(o).not.toBe(a.waves);
    expect(o.map((w) => w.subKey)).toEqual(['lab.o1', 'lab.o2', 'lab.o3', 'lab.o4', 'lab.o5']);
    // the baseline is untouched: no archetypes, no pulses
    expect(a.waves.flatMap((w) => w.spawns).some((q) => q.arch || q.pulse)).toBe(false);
    expect(a.waves.some((w) => w.pulse)).toBe(false);
    for (const w of ONSLAUGHT_WAVES) for (const k of ['en', 'he'] as const) expect(strings(k)[w.subKey], `${k} ${w.subKey}`).toBeTruthy();
  });

  it('the sequence the owner asked for: stormer pairs from different sides, suppressors, heavies, ten in two pulses', () => {
    const kinds = (w: (typeof ONSLAUGHT_WAVES)[number]) => w.spawns.map((q) => q.arch ?? q.kind).sort();
    expect(kinds(ONSLAUGHT_WAVES[0])).toEqual(['stormer', 'stormer', 'suppressor']);
    expect(kinds(ONSLAUGHT_WAVES[1])).toEqual(['sniper', 'stormer', 'stormer', 'suppressor']);
    expect(ONSLAUGHT_WAVES[1].spawns.find((q) => q.kind === 'sniper')).toMatchObject({ role: 'holder', gate: 'tw' });
    expect(kinds(ONSLAUGHT_WAVES[2])).toEqual(['stormer', 'stormer', 'suppressor', 'warden']);
    expect(kinds(ONSLAUGHT_WAVES[3])).toEqual(['brute', 'grenadier', 'stormer', 'stormer', 'suppressor', 'warden']);
    const w5 = ONSLAUGHT_WAVES[4];
    expect(w5.spawns.length).toBeGreaterThanOrEqual(8);
    expect(w5.spawns.length).toBeLessThanOrEqual(10);
    expect(w5.pulse).toBeTruthy();
    const second = w5.spawns.filter((q) => q.pulse === 2).length;
    expect(second).toBeGreaterThan(2);
    expect(w5.spawns.length - second).toBeGreaterThan(2);
    for (const [i, w] of ONSLAUGHT_WAVES.entries()) {
      // stormers come in pairs, from different gates
      for (const p of [undefined, 2]) {
        const st = w.spawns.filter((q) => q.arch === 'stormer' && q.pulse === p);
        if (!st.length) continue;
        expect(st.length % 2, `O${i + 1} pairs`).toBe(0);
        expect(new Set(st.map((q) => q.gate)).size, `O${i + 1} from different sides`).toBe(st.length);
      }
      // only riflemen carry an archetype; never more than 10 in a wave
      expect(w.spawns.every((q) => !q.arch || q.kind === 'rifleman')).toBe(true);
      expect(w.spawns.length).toBeLessThanOrEqual(10);
    }
  });

  it('the director plays ONSLAUGHT\'s list under ONSLAUGHT, the second pulse on its clock or when the first is nearly down', () => {
    setLabActive(true);
    setVariant('onslaught');
    const { d, step, killAll, alive } = fakeRun();
    d.start();
    expect(d.stats.variant).toBe('onslaught');
    expect(d.waveCount).toBe(5);
    expect(d.stats.waves.length).toBe(5);
    for (let w = 0; w < 4; w++) {
      step(w === 0 ? LAB_TIMING.first + 0.1 : LAB_TIMING.breather + 0.1);
      step(3);
      expect(d.ids.length, `O${w + 1}`).toBe(ONSLAUGHT_WAVES[w].spawns.length);
      killAll();
      step(1 / 60);
    }
    step(LAB_TIMING.breather + 0.1);
    const w5 = ONSLAUGHT_WAVES[4];
    const first = w5.spawns.filter((q) => q.pulse !== 2).length;
    step(3);
    expect(d.ids.length).toBe(first);
    expect(d.left).toBe(w5.spawns.length);
    // down to the pulse's `left`: the rest come through
    const ids = [...d.ids];
    for (const id of ids.slice(0, ids.length - w5.pulse!.left)) alive.set(id, false);
    step(3);
    expect(d.ids.length).toBe(w5.spawns.length);
    killAll();
    step(1 / 60);
    expect(d.phase).toBe('done');
  });

  it('the second pulse comes on its clock even if the first still stands', () => {
    setLabActive(true);
    setVariant('onslaught');
    const { d, step, killAll } = fakeRun();
    d.start();
    for (let w = 0; w < 4; w++) {
      step(w === 0 ? LAB_TIMING.first + 0.1 : LAB_TIMING.breather + 0.1);
      step(3);
      killAll();
      step(1 / 60);
    }
    step(LAB_TIMING.breather + 0.1);
    const w5 = ONSLAUGHT_WAVES[4];
    step(w5.pulse!.at - 1);
    expect(d.ids.length).toBeLessThan(w5.spawns.length);
    step(4);
    expect(d.ids.length).toBe(w5.spawns.length);
  });

  it('PRECISION and CURRENT still play the baseline five', () => {
    for (const v of ['current', 'precision'] as const) {
      setLabActive(true);
      setVariant(v);
      const { d, step, log } = fakeRun();
      d.start();
      step(LAB_TIMING.first + 3);
      expect(d.ids.length).toBe(WAVES[0].spawns.length);
      expect(log.filter((l) => l.startsWith('spawn')).every((l) => l.includes('rifleman'))).toBe(true);
      expect(d.waves).toBe(L.lab!.waves);
    }
  });
});
