/**
 * Content-detail tier for the world modules ('low' | 'medium' | 'high').
 *
 * Engine owns the real quality settings (`engine.quality.name`). World modules are constructed with only a few
 * numbers from it, so they resolve the tier defensively, in this order:
 *   1. `configureWorld(quality)` — Engine may call this once before building the world (preferred);
 *   2. an explicit `name` in the hint a constructor received (e.g. `{ ...q }`);
 *   3. inference from the numbers the constructor received (tree scale, grid spacing, instance counts);
 *   4. the `?q=` URL parameter / a phone user agent (phones are always content 'low').
 * The first tier resolved from 1-3 is remembered so every module of one world agrees.
 */
export type WorldTier = 'low' | 'medium' | 'high';

export interface WorldQualityHint {
  name?: string;
  treeScale?: number;
  nearSpacing?: number;
  grassCount?: number;
  rocks?: number;
  texMax?: number;
  anisotropy?: number;
  mobile?: boolean;
}

let configured: WorldTier | null = null;
let remembered: WorldTier | null = null;
let texMax = 0;
let anisotropy = 0;

function isTier(s: unknown): s is WorldTier {
  return s === 'low' || s === 'medium' || s === 'high';
}

/** Optional: Engine can call this with its `quality` object before `build()`. Safe to call repeatedly. */
export function configureWorld(q: WorldQualityHint | null | undefined) {
  if (!q) return;
  if (isTier(q.name)) configured = q.name;
  if (typeof q.texMax === 'number' && q.texMax > 0) texMax = q.texMax;
  if (typeof q.anisotropy === 'number' && q.anisotropy > 0) anisotropy = q.anisotropy;
}

function fromUrl(): WorldTier | null {
  try {
    const p = new URLSearchParams(location.search).get('q');
    if (p === 'low' || p === 'mobile-high' || p === 'mobile-low') return 'low';
    if (p === 'medium' || p === 'desktop-medium') return 'medium';
    if (p === 'high' || p === 'desktop-high') return 'high';
  } catch {
    /* no location (tests) */
  }
  return null;
}

function looksMobile(): boolean {
  try {
    const ua = navigator.userAgent;
    if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua)) return true;
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function infer(h: WorldQualityHint): WorldTier | null {
  if (isTier(h.name)) return h.name;
  if (h.mobile === true) return 'low';
  if (typeof h.treeScale === 'number') return h.treeScale >= 0.95 ? 'high' : h.treeScale >= 0.75 ? 'medium' : 'low';
  if (typeof h.nearSpacing === 'number') return h.nearSpacing <= 1.7 ? 'high' : h.nearSpacing <= 2.1 ? 'medium' : 'low';
  if (typeof h.grassCount === 'number') return h.grassCount >= 40000 ? 'high' : h.grassCount >= 24000 ? 'medium' : 'low';
  if (typeof h.rocks === 'number') return h.rocks >= 3200 ? 'high' : h.rocks >= 2000 ? 'medium' : 'low';
  return null;
}

/** Resolve the world content tier (see file comment). */
export function worldTier(hint?: WorldQualityHint): WorldTier {
  if (configured) return configured;
  if (hint) {
    configureWorld(hint);
    if (configured) return configured;
    const t = infer(hint);
    if (t) {
      remembered = t;
      return t;
    }
  }
  if (remembered) return remembered;
  return fromUrl() ?? (looksMobile() ? 'low' : 'high');
}

/** Largest texture edge the engine wants modules to upload (0 = no preference). */
export function worldTexMax() {
  return texMax;
}

/** Anisotropy cap requested by the engine (0 = no preference). */
export function worldAnisotropy() {
  return anisotropy;
}

/** Pick a value per tier. */
export function perTier<T>(tier: WorldTier, low: T, medium: T, high: T): T {
  return tier === 'low' ? low : tier === 'medium' ? medium : high;
}
