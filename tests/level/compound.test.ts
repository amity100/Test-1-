import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCombatLab } from '../../src/world/combatlab';
import type { TowerBuild } from '../../src/world/tower';
import { AIM_WAVES_C, ARENA_BOXES, ARENA_OPENINGS, FLIGHTS, PLATFORMS_C, PLAT_Y, POSTS, postById, type ArenaBox } from '../../src/world/combatlab/compound';
import { DECK, PAD, POOL } from '../../src/world/combatlab/layout';
import { NavGrid } from '../../src/world/nav';
import { KIND } from '../../src/actors/tuning';
import { onFoot } from './reach';
import { fitSnap, placeExit, SIDES } from '../../src/game/aimportal';

let L: TowerBuild;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const fmt = (b: ArenaBox) => `${b.kind}${b.id ? ' ' + b.id : ''} [${b.x0},${b.y0},${b.z0} .. ${b.x1},${b.y1},${b.z1}]`;

beforeAll(() => {
  L = buildCombatLab(null, false, { headless: true });
});

describe('THE COMPOUND: geometry hygiene', () => {
  it('no two boxes interpenetrate', () => {
    const bad: string[] = [];
    const e = 1e-4;
    for (let i = 0; i < ARENA_BOXES.length; i++) {
      for (let j = i + 1; j < ARENA_BOXES.length; j++) {
        const a = ARENA_BOXES[i], b = ARENA_BOXES[j];
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0), oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
        if (ox > e && oy > e && oz > e) bad.push(`${fmt(a)}  x  ${fmt(b)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('no two faces facing the same way lie in one plane over the same patch (z-fighting)', () => {
    const bad: string[] = [];
    const e = 1e-4;
    // (a face: axis, +1/-1, plane position, and its two spans)
    type Face = { ax: 0 | 1 | 2; dir: 1 | -1; p: number; u0: number; u1: number; v0: number; v1: number; b: ArenaBox };
    const faces: Face[] = [];
    for (const b of ARENA_BOXES) {
      const lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
      for (const ax of [0, 1, 2] as const) {
        const [ua, va] = ax === 0 ? [1, 2] : ax === 1 ? [0, 2] : [0, 1];
        faces.push({ ax, dir: 1, p: hi[ax], u0: lo[ua], u1: hi[ua], v0: lo[va], v1: hi[va], b });
        faces.push({ ax, dir: -1, p: lo[ax], u0: lo[ua], u1: hi[ua], v0: lo[va], v1: hi[va], b });
      }
    }
    for (let i = 0; i < faces.length; i++) {
      for (let j = i + 1; j < faces.length; j++) {
        const a = faces[i], b = faces[j];
        if (a.ax !== b.ax || a.dir !== b.dir || Math.abs(a.p - b.p) > e) continue;
        const ou = Math.min(a.u1, b.u1) - Math.max(a.u0, b.u0), ov = Math.min(a.v1, b.v1) - Math.max(a.v0, b.v0);
        if (ou > e && ov > e) bad.push(`${fmt(a.b)} x ${fmt(b.b)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('stands inside the deck, clear of the pool and the pad', () => {
    const bad: string[] = [];
    for (const b of ARENA_BOXES) {
      if (b.x0 < -30 - 1e-6 || b.x1 > 30 + 1e-6 || b.z0 < -30 - 1e-6 || b.z1 > DECK.z1 - 1.5) bad.push('outside ' + fmt(b));
      if (b.x1 > POOL.x0 - 0.3 && b.x0 < POOL.x1 + 0.3 && b.z1 > POOL.z0 - 0.3 && b.z0 < POOL.z1 + 0.3) bad.push('pool ' + fmt(b));
      if (b.x1 > PAD.x - PAD.half - 0.5 && b.x0 < PAD.x + PAD.half + 0.5 && b.z1 > PAD.z - PAD.half - 0.5 && b.z0 < PAD.z + PAD.half + 0.5) bad.push('pad ' + fmt(b));
    }
    expect(bad).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Walking it
// ---------------------------------------------------------------------------

/** The deck's nav grid (layer 0) and a flood fill over its walkable cells from `from`. */
function navFlood(grid: NavGrid, from: { x: number; z: number }): Uint8Array {
  const seen = new Uint8Array(grid.w * grid.h);
  const s = grid.idx(from.x, from.z);
  const q: number[] = [s];
  seen[s] = 1;
  while (q.length) {
    const c = q.pop()!;
    const cx = c % grid.w, cz = Math.floor(c / grid.w);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= grid.w || nz >= grid.h) continue;
        const n = nz * grid.w + nx;
        if (seen[n] || grid.blocked[n]) continue;
        if (dx && dz && (grid.blocked[cz * grid.w + nx] || grid.blocked[nz * grid.w + cx])) continue;
        seen[n] = 1;
        q.push(n);
      }
    }
  }
  return seen;
}

describe('THE COMPOUND: walking it', () => {
  it('every walkable cell of the deck is joined to the pad (no sealed-off pen), every door is walked through', () => {
    const z = L.zones[0];
    const grid = new NavGrid(L.world, z.nav[0]);
    const seen = navFlood(grid, L.lab!.pad.pos);
    let walk = 0, joined = 0;
    const lost: string[] = [];
    for (let k = 0; k < grid.blocked.length; k++) {
      if (grid.blocked[k]) continue;
      // (the gate alcoves in the perimeter wall are not the deck)
      const wx = grid.ox + ((k % grid.w) + 0.5) * grid.cell, wz = grid.oz + (Math.floor(k / grid.w) + 0.5) * grid.cell;
      if (Math.abs(wx) > 30 || wz < -30) continue;
      walk++;
      if (seen[k]) joined++;
      else if (lost.length < 6) lost.push(`(${(grid.ox + ((k % grid.w) + 0.5) * grid.cell).toFixed(1)}, ${(grid.oz + (Math.floor(k / grid.w) + 0.5) * grid.cell).toFixed(1)})`);
    }
    // (a cell the flood does not reach is a pocket nobody can walk into)
    expect(lost, `${walk - joined} cells apart: ${lost.join(' ')}`).toEqual([]);
    expect(joined / walk).toBeGreaterThan(0.99);
    // (a man walks through every door: the door's own cell is walkable, and so is floor joined to the pad a metre or two out on both sides)
    const bad: string[] = [];
    for (const o of ARENA_OPENINGS.filter((q) => q.k === 'door')) {
      const ok = (x: number, zz: number) => {
        const i = grid.idx(x, zz);
        return i >= 0 && !grid.blocked[i] && seen[i] === 1;
      };
      if (!ok(o.x, o.z)) bad.push(`${o.id} (${o.x}, ${o.z}): the door itself`);
      for (const side of [-1, 1]) {
        let found = false;
        for (let d = 0.8; d <= 2.6 && !found; d += 0.3) for (let lat = -0.9; lat <= 0.9 && !found; lat += 0.3) found = o.axis === 'z' ? ok(o.x + side * d, o.z + lat) : ok(o.x + lat, o.z + side * d);
        if (!found) bad.push(`${o.id} (${o.x}, ${o.z}): side ${side}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every post: on the ground (or a perch), on nav, with room, joined to the pad; none on a prop or a wall', () => {
    const z = L.zones[0];
    const grids = z.nav.map((n) => new NavGrid(L.world, n));
    const seen = navFlood(grids[0], L.lab!.pad.pos);
    const layerOf = (p: THREE.Vector3Like) => z.nav.findIndex((n, i) => i > 0 && p.x >= n.minX && p.x <= n.maxX && p.z >= n.minZ && p.z <= n.maxZ && Math.abs((n.floorY ?? 0) - p.y) <= 0.3);
    const bad: string[] = [];
    for (const p of POSTS) {
      const li = p.y > 0.5 ? layerOf(p) : 0;
      if (li < 0) { bad.push(`${p.id}: no layer`); continue; }
      if (!grids[li].walkable(p.x, p.z)) bad.push(`${p.id}: not walkable`);
      const g = L.world.groundAt(p.x, p.z, 0.3, p.y + 0.3);
      if (Math.abs(g - p.y) > 0.05) bad.push(`${p.id}: ground ${g}`);
      const k = KIND.rifleman;
      for (const c of L.world.colliders) {
        if (!c.enabled || c.max.y <= p.y + 0.05 || c.min.y >= p.y + k.height) continue;
        const cx = Math.max(c.min.x, Math.min(p.x, c.max.x)), cz = Math.max(c.min.z, Math.min(p.z, c.max.z));
        if ((p.x - cx) ** 2 + (p.z - cz) ** 2 <= k.radius * k.radius) bad.push(`${p.id}: inside ${c.tag}`);
      }
      for (const pr of L.props) if (Math.hypot(pr.pos.x - p.x, pr.pos.z - p.z) <= 1.2) bad.push(`${p.id}: by ${pr.id}`);
      if (li === 0 && seen[grids[0].idx(p.x, p.z)] !== 1) bad.push(`${p.id}: not joined to the pad`);
    }
    expect(bad).toEqual([]);
  });

  it('on foot from the pad: every flight of stairs reaches its perch, nothing else does (tall walls and perches are not climbed)', () => {
    const reach = onFoot(L.world, { x0: -31, x1: 31, z0: -31, z1: DECK.z1 }, [L.lab!.pad.pos], { skip: (c) => c.tag === 'sealed' });
    for (const f of FLIGHTS) expect(reach.reached(f.bottom), `bottom ${f.bottom.toArray()}`).toBe(true);
    for (const p of PLATFORMS_C) {
      const f = FLIGHTS[PLATFORMS_C.indexOf(p)];
      expect(reach.reached(f.top, 0.3), `${p.id}: ${reach.route(f.top, 0.3)}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Hiding in it
// ---------------------------------------------------------------------------

const gAt = (x: number, z: number, y: number) => L.world.groundAt(x, z, 0.3, y);
/** Where a man's body can be seen: his chest and his head. */
const bodyPts = (p: { x: number; y: number; z: number }) => [V(p.x, p.y + 1.08, p.z), V(p.x, p.y + 1.7, p.z)];
const seesPost = (eye: THREE.Vector3, p: { x: number; y: number; z: number }) => bodyPts(p).some((q) => L.world.lineOfSight(eye, q));

/** Eye positions: a 1.5 m grid over the deck's walkable cells, and over each perch. */
function vantages(): THREE.Vector3[] {
  const grid = new NavGrid(L.world, L.zones[0].nav[0]);
  const out: THREE.Vector3[] = [];
  for (let x = -29.5; x <= 29.5; x += 1.5) for (let z = -29.5; z <= 27; z += 1.5) if (grid.walkable(x, z)) out.push(V(x, 1.6, z));
  for (const p of PLATFORMS_C) for (let x = p.x0 + 0.6; x < p.x1 - 0.5; x += 1.5) for (let z = p.z0 + 0.6; z < p.z1 - 0.5; z += 1.5) out.push(V(x, PLAT_Y + 1.6, z));
  return out;
}

describe('THE COMPOUND: a place to hide', () => {
  it('built for it: tall walls, doors, windows, slits, short cover, pillars, three perches with stairs and parapets', () => {
    const tall = new Set(ARENA_BOXES.filter((b) => (b.kind === 'wall' || b.kind === 'lintel') && b.y1 >= 3).map((b) => b.id));
    expect(tall.size).toBeGreaterThanOrEqual(40);
    // (taller than a man, and out of reach of the jump and the mantle)
    for (const b of ARENA_BOXES.filter((q) => q.kind === 'wall')) expect(b.y1, fmt(b)).toBeGreaterThanOrEqual(3);
    const heights = ARENA_BOXES.filter((b) => b.kind === 'wall').map((b) => b.y1);
    expect(Math.max(...heights)).toBeGreaterThanOrEqual(4.5);
    for (const c of L.world.colliders.filter((q) => q.tag === 'wall')) expect(c.noMantle, 'walls are not climbed').toBe(true);
    const count = (k: string) => ARENA_OPENINGS.filter((o) => o.k === k).length;
    expect(count('door')).toBeGreaterThanOrEqual(20);
    expect(count('window')).toBeGreaterThanOrEqual(14);
    expect(count('slit')).toBeGreaterThanOrEqual(10);
    expect(ARENA_BOXES.filter((b) => b.kind === 'low' && b.y1 === 1.2).length).toBeGreaterThanOrEqual(8);
    expect(ARENA_BOXES.filter((b) => b.kind === 'pillar').length).toBeGreaterThanOrEqual(6);
    expect(PLATFORMS_C.length).toBeGreaterThanOrEqual(3);
    for (const p of PLATFORMS_C) {
      expect(gAt((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, PLAT_Y + 0.1), p.id).toBeCloseTo(PLAT_Y, 2);
      expect(ARENA_BOXES.some((b) => b.kind === 'parapet' && b.id === p.id && Math.abs(b.y1 - b.y0 - 1.2) < 1e-6), `${p.id} parapet`).toBe(true);
      expect(ARENA_BOXES.filter((b) => b.kind === 'step' && b.id === p.id).length, `${p.id} steps`).toBe(13);
      expect(L.zones[0].nav.some((n) => Math.abs((n.floorY ?? 0) - PLAT_Y) < 0.01 && n.minX <= p.x0 && n.maxX >= p.x1)).toBe(true);
    }
  });

  it('most walls take portals: a few sealed panels, at most one metre in twelve of wall', () => {
    const sealed = ARENA_BOXES.filter((b) => b.kind === 'sealed');
    expect(sealed.length).toBeGreaterThanOrEqual(2);
    expect(sealed.length).toBeLessThanOrEqual(8);
    for (const b of sealed) expect(b.y1).toBeGreaterThanOrEqual(2.5);
    const len = (b: ArenaBox) => Math.max(b.x1 - b.x0, b.z1 - b.z0);
    const wallLen = ARENA_BOXES.filter((b) => b.kind === 'wall' || b.kind === 'sealed').reduce((s, b) => s + len(b), 0);
    const sealedLen = sealed.reduce((s, b) => s + len(b), 0);
    expect(sealedLen / wallLen).toBeLessThan(1 / 12);
    for (const c of L.world.colliders.filter((q) => q.tag === 'sealed')) expect(c.noPortal).toBe(true);
    for (const c of L.world.colliders.filter((q) => q.tag === 'wall')) expect(c.noPortal).toBeFalsy();
  });

  it('no spot sees more than 35% of the posts, and the average spot sees a tenth', () => {
    const vs = vantages();
    let max = 0, sum = 0;
    let at = '';
    for (const v of vs) {
      let n = 0;
      for (const p of POSTS) if (seesPost(v, p)) n++;
      sum += n;
      if (n > max) {
        max = n;
        at = `(${v.x}, ${v.y}, ${v.z})`;
      }
    }
    expect(max / POSTS.length, `${max} of ${POSTS.length} posts from ${at}`).toBeLessThanOrEqual(0.35);
    expect(sum / vs.length / POSTS.length).toBeLessThan(0.12);
  });

  it('every windows lets you see out: a clear run beyond it on at least one side', () => {
    const bad: string[] = [];
    for (const o of ARENA_OPENINGS.filter((q) => q.k === 'window' || q.k === 'slit')) {
      let best = 0;
      for (const side of [-1, 1]) {
        const from = o.axis === 'z' ? V(o.x - side * 2.5, 1.5, o.z) : V(o.x, 1.5, o.z - side * 2.5);
        const dir = o.axis === 'z' ? V(side, 0, 0) : V(0, 0, side);
        const hit = L.world.raycast(from, dir, 40);
        best = Math.max(best, hit ? hit.distance - 2.5 : 40);
      }
      // (past the wall, a few metres of room)
      if (best < 3.5) bad.push(`${o.k} ${o.id} (${o.x}, ${o.z}): ${best.toFixed(1)} m`);
    }
    expect(bad).toEqual([]);
  });

  it('a man behind his cover has a flank: a vantage where he is hidden but floor beside him is seen and takes a portal', () => {
    const vs = vantages();
    const bad: string[] = [];
    for (const p of POSTS.filter((q) => q.y < 0.5)) {
      const targets: THREE.Vector3[] = [];
      for (let a = 0; a < 16; a++) for (const r of [1.3, 2.3, 3.2]) targets.push(V(p.x + Math.sin((a * Math.PI) / 8) * r, p.y + 0.05, p.z + Math.cos((a * Math.PI) / 8) * r));
      let n = 0;
      for (const v of vs) {
        if (seesPost(v, p)) continue;
        for (const t of targets) {
          const d = t.clone().sub(v);
          const len = d.length();
          d.normalize();
          const hit = L.world.raycast(v, d, len + 0.5);
          if (!hit || hit.point.distanceTo(t) > 0.35 || hit.normal.y < 0.6) continue;
          if (!placeExit(L.world, v, d, v, null, gAt).ok) continue;
          n++;
          break;
        }
        if (n >= 3) break;
      }
      if (n < 3) bad.push(`${p.id}: ${n}`);
    }
    expect(bad).toEqual([]);
  });

  it('a man you can see takes an exit beside him from some side (the magnet), from wherever you see him', () => {
    const vs = vantages();
    const bad: string[] = [];
    for (const p of POSTS) {
      const man = { pos: V(p.x, p.y, p.z), yaw: 0, height: 1.8 };
      const v = vs.find((q) => seesPost(q, p) && Math.hypot(q.x - p.x, q.z - p.z) > 3 && Math.hypot(q.x - p.x, q.z - p.z) < 30);
      if (!v) { bad.push(`${p.id}: seen from nowhere`); continue; }
      const view = V(p.x - v.x, 0, p.z - v.z).normalize();
      const oks = SIDES.filter((s) => fitSnap(L.world, { ...man, pos: man.pos }, s, p.y, view).ok);
      if (oks.length < 3) bad.push(`${p.id}: ${oks.join(',')}`);
    }
    expect(bad).toEqual([]);
  });

  it('five waves of 3, 4, 5, 6 and 8 men: mirrors from the second, rushers from the third, each on his own post', () => {
    expect(AIM_WAVES_C.map((w) => w.spawns.length)).toEqual([3, 4, 5, 6, 8]);
    AIM_WAVES_C.forEach((w, i) => {
      const kinds = w.spawns.map((s) => s.aim);
      expect(kinds.includes('mirror'), `wave ${i + 1} mirrors`).toBe(i >= 1);
      expect(kinds.includes('rusher'), `wave ${i + 1} rushers`).toBe(i >= 2);
      expect(kinds.includes('gunner')).toBe(true);
      const keys = w.spawns.map((s) => `${s.post.x},${s.post.z}`);
      expect(new Set(keys).size).toBe(keys.length);
      for (const s of w.spawns) expect(POSTS.some((q) => q.x === s.post.x && q.z === s.post.z && q.y === s.post.y)).toBe(true);
      expect(w.ready).toBe(true);
    });
    // (a post out of your sight from the pad: nobody starts in the open)
    const eye = V(0, 1.6, -24);
    for (const w of AIM_WAVES_C) for (const s of w.spawns) expect(seesPost(eye, { x: s.post.x, y: s.post.y, z: s.post.z }), `${s.aim} at ${s.post.x},${s.post.z} seen from the pad`).toBe(false);
  });
});
