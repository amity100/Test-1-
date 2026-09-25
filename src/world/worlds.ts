import * as THREE from 'three';
import { DEFAULT_SKY, GOLDEN_SUN_DIR, type SkyStyle } from '../render/fx';
import { buildTower, type TowerBuild } from './tower';
import { buildHalcyon } from './halcyon';
import { HALCYON_SKY } from './halcyon/atmosphere';
import { SUN_DIR as HALCYON_SUN } from './halcyon/layout';

/**
 * Mission 1 comes in two worlds while the owner picks one: the harbour tower
 * and Halcyon, the city of tomorrow. To drop one later: remove its entry here
 * (and, for Halcyon, src/world/halcyon/ + halcyon.ts and its `halcyon:` strings).
 */
export type WorldId = 'harbour' | 'halcyon';
export const WORLDS: WorldId[] = ['harbour', 'halcyon'];
export const DEFAULT_WORLD: WorldId = 'halcyon';

const KEY = 'threshold.world';

/** Sun and sky each world is lit by (the env map is baked before the level is built). */
export const WORLD_SUN: Record<WorldId, THREE.Vector3> = { harbour: GOLDEN_SUN_DIR, halcyon: HALCYON_SUN };
export const WORLD_SKY: Record<WorldId, SkyStyle> = { harbour: DEFAULT_SKY, halcyon: HALCYON_SKY };

export function buildWorld(id: WorldId, envMap: THREE.Texture | null, mobile: boolean, opts: { headless?: boolean } = {}): TowerBuild {
  return id === 'halcyon' ? buildHalcyon(envMap, mobile, opts) : buildTower(envMap, mobile, opts);
}

const isWorld = (s: unknown): s is WorldId => typeof s === 'string' && (WORLDS as string[]).includes(s);

/** Minimal storage (localStorage, or a stand-in in tests). */
export interface WorldStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function localStore(): WorldStore | null {
  // (a sandboxed frame may throw on the very access)
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** The world to load: `?world=` in the URL, else the last one picked, else the default. */
export function readWorld(search: string = typeof location !== 'undefined' ? location.search : '', store: WorldStore | null = localStore()): WorldId {
  try {
    const q = new URLSearchParams(search).get('world');
    if (isWorld(q)) return q;
  } catch {}
  try {
    const s = store?.getItem(KEY);
    if (isWorld(s)) return s;
  } catch {}
  return DEFAULT_WORLD;
}

/** Remember the pick (storage and the URL, each where the host allows it). */
export function saveWorld(id: WorldId, store: WorldStore | null = localStore()) {
  try {
    store?.setItem(KEY, id);
  } catch {}
  try {
    if (typeof location === 'undefined' || typeof history === 'undefined') return;
    const u = new URL(location.href);
    if (u.searchParams.get('world') === id) return;
    u.searchParams.set('world', id);
    history.replaceState(history.state, '', u.toString());
  } catch {}
}
