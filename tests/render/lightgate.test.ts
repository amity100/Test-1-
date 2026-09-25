import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LightGate } from '../../src/render/lightgate';

const group = (n: number) => Array.from({ length: n }, () => new THREE.PointLight(0xffffff, 0, 9, 1.8));
const inSet = (ls: THREE.Light[]) => ls.filter((l) => l.visible).length;

describe('effect light gate', () => {
  it('takes the whole group out of the light set while none of it is lit', () => {
    const ls = group(6);
    const g = new LightGate(ls);
    expect(g.update()).toBe(0);
    expect(g.on).toBe(false);
    expect(ls.every((l) => !l.visible)).toBe(true);
  });

  it('puts the whole group back as soon as any light is lit (two sizes by default)', () => {
    const ls = group(6);
    const g = new LightGate(ls);
    g.update();
    ls[4].intensity = 0.001;
    expect(g.update()).toBe(6);
    expect(ls.every((l) => l.visible)).toBe(true);
    ls[4].intensity = 0;
    expect(g.update()).toBe(0);
    expect(ls.every((l) => !l.visible)).toBe(true);
  });

  it('uses the smallest allowed size that holds every lit light, lit lights always in', () => {
    const ls = group(6);
    const g = new LightGate(ls, [0, 2]);
    expect(g.sizes).toEqual([0, 2, 6]);
    const cases: [number[], number][] = [
      [[], 0],
      [[0], 2],
      [[0, 1], 2],
      [[5], 2],
      [[1, 4], 2],
      [[0, 1, 2], 6],
      [[0, 1, 4, 5], 6],
    ];
    for (const [lit, size] of cases) {
      ls.forEach((l, i) => (l.intensity = lit.includes(i) ? 3.2 : 0));
      expect(g.update(), `lit ${lit}`).toBe(size);
      expect(inSet(ls), `lit ${lit}`).toBe(size);
      for (const i of lit) expect(ls[i].visible, `lit ${lit}: light ${i}`).toBe(true);
    }
  });

  it('the light count only ever takes the allowed sizes (so no program is compiled mid-game)', () => {
    const ls = group(6);
    const g = new LightGate(ls, [0, 2]);
    let s = 3;
    const seen = new Set<number>();
    for (let t = 0; t < 2000; t++) {
      s = (s * 1103515245 + 12345) % 2147483648;
      for (let i = 0; i < 6; i++) ls[i].intensity = (s >> (i * 3)) % 3 === 0 ? 1 : 0;
      seen.add(g.update());
      expect(g.sizes).toContain(inSet(ls));
      for (const l of ls) if (l.intensity !== 0) expect(l.visible).toBe(true);
    }
    expect([...seen].sort()).toEqual([0, 2, 6]);
  });

  it('setSize gives each size for the warm-up', () => {
    const ls = group(6);
    const g = new LightGate(ls, [0, 2]);
    for (const size of [6, 2, 0]) {
      g.setSize(size);
      expect(inSet(ls)).toBe(size);
    }
  });

  it('only leaves out lights that add nothing (intensity exactly 0)', () => {
    const ls = group(3);
    ls[0].intensity = 1e-9;
    expect(LightGate.anyLit(ls)).toBe(true);
    ls[0].intensity = 0;
    expect(LightGate.anyLit(ls)).toBe(false);
  });

  it('three leaves invisible lights out of the light set (what makes the saving real)', () => {
    const scene = new THREE.Scene();
    const ls = group(4);
    scene.add(...ls, new THREE.DirectionalLight());
    const counted = () => {
      let n = 0;
      scene.traverseVisible((o) => {
        if ((o as THREE.Light).isLight) n++;
      });
      return n;
    };
    const g = new LightGate(ls, [0, 2]);
    expect(counted()).toBe(5);
    g.update();
    expect(counted()).toBe(1);
    ls[3].intensity = 2;
    g.update();
    expect(counted()).toBe(3);
  });
});
