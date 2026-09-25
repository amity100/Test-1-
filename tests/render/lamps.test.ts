import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { LampDef } from '../../src/core/contracts';
import { LampSystem, nearestLamps } from '../../src/render/fx';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function lamps(n: number, r: () => number): LampDef[] {
  const out: LampDef[] = [];
  for (let i = 0; i < n; i++) {
    // (some lamps share a spot: ties must resolve the way the old stable sort did)
    const pos = i % 7 === 3 && i > 0 ? out[i - 1].pos.clone() : new THREE.Vector3((r() - 0.5) * 120, 3 + r() * 6, (r() - 0.5) * 120);
    out.push({ pos, dir: new THREE.Vector3(0, -1, 0), color: 0xffd0a0, range: 8 + r() * 10, angle: 0.5 + r() * 0.4, intensity: 0.6 + r(), kind: 'pole' });
  }
  return out;
}

/** The pool update as it was (map / sort / slice every frame), on a mirror of the pool state. */
function oldUpdate(ls: LampDef[], focus: THREE.Vector3, assigned: (LampDef | null)[], intensity: number[], targets: number[], power: number) {
  const sorted = ls
    .map((l) => ({ l, d: l.pos.distanceToSquared(focus) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, assigned.length)
    .map((x) => x.l);
  const free: number[] = [];
  for (let i = 0; i < assigned.length; i++) if (!assigned[i] || !sorted.includes(assigned[i]!)) free.push(i);
  for (const l of sorted) {
    if (assigned.includes(l)) continue;
    const i = free.shift();
    if (i === undefined) break;
    assigned[i] = l;
    targets[i] = 38 * power * l.intensity * (l.range / 16) ** 2;
    intensity[i] = 0;
  }
  for (let i = 0; i < assigned.length; i++) {
    const target = assigned[i] && sorted.includes(assigned[i]!) ? targets[i] : 0;
    intensity[i] += (target - intensity[i]) * 0.12;
  }
}

describe('lamp light pool', () => {
  // (the lamp glows draw a radial sprite on a 2D canvas: a stand-in that accepts the calls)
  beforeAll(() => {
    const ctx = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, fillStyle: '' };
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
  });
  afterAll(() => vi.unstubAllGlobals());

  it('nearestLamps picks what a stable sort + slice picks, ties included', () => {
    const r = rng(7);
    const ls = lamps(43, r);
    const out: LampDef[] = [], d: number[] = [];
    for (let t = 0; t < 500; t++) {
      const focus = t % 5 === 0 ? ls[t % ls.length].pos.clone().add(new THREE.Vector3(0, -3, 0)) : new THREE.Vector3((r() - 0.5) * 140, 1.7, (r() - 0.5) * 140);
      for (const k of [0, 1, 4, 43, 50]) {
        const want = ls.map((l) => ({ l, d: l.pos.distanceToSquared(focus) })).sort((a, b) => a.d - b.d).slice(0, k).map((x) => x.l);
        const n = nearestLamps(ls, focus, k, out, d);
        expect(n).toBe(want.length);
        expect(out).toEqual(want);
      }
    }
  });

  it('assigns the same lamps to the same lights, with the same intensities, as the old update', () => {
    const r = rng(11);
    const ls = lamps(43, r);
    const sys = new LampSystem(ls, 4, false, { power: 0.7 });
    const assigned: (LampDef | null)[] = [null, null, null, null], inten = [0, 0, 0, 0], targets = [0, 0, 0, 0];
    const focus = new THREE.Vector3();
    for (let t = 0; t < 3000; t++) {
      // a walk with jumps (respawns, world switches)
      if (t % 400 === 0) focus.set((r() - 0.5) * 120, 1.7, (r() - 0.5) * 120);
      else focus.add(new THREE.Vector3((r() - 0.5) * 1.5, 0, (r() - 0.5) * 1.5));
      sys.update(t / 60, focus);
      oldUpdate(ls, focus, assigned, inten, targets, 0.7);
      expect(sys.assignment).toEqual(assigned);
      expect(sys.lights.map((s) => s.intensity)).toEqual(inten);
    }
  });
});
