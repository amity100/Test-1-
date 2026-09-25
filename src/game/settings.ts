import { defaultQuality, IS_TOUCH, QUALITY, type QualityName } from '../config';

export interface Settings {
  quality: QualityName;
  sensitivity: number;
  invertY: boolean;
  slowmo: boolean;
  /** Performance overlay (fps, frame / CPU / GPU ms, resolution, draws). */
  perf: boolean;
  /** Settings format (see readSettings). */
  v: number;
}

/**
 * 2: phones default to the `high` preset (the PC's look at their own
 * resolution). A phone's saved v1 `medium` was the old default, not a choice:
 * it becomes `high`. Anything saved from v2 on is kept as it is.
 */
export const SETTINGS_VERSION = 2;

export function defaultSettings(touch = IS_TOUCH): Settings {
  return { quality: defaultQuality(touch), sensitivity: 1, invertY: false, slowmo: true, perf: false, v: SETTINGS_VERSION };
}

/** Settings from their saved JSON (null / broken: the defaults), migrated to the current version. */
export function readSettings(raw: string | null, touch = IS_TOUCH): Settings {
  const d = defaultSettings(touch);
  let s: Partial<Settings> & Record<string, unknown> = {};
  try {
    const p = JSON.parse(raw || '{}');
    if (p && typeof p === 'object' && !Array.isArray(p)) s = p;
  } catch {}
  const out: Settings = { ...d, ...s } as Settings;
  const v = typeof s.v === 'number' ? s.v : 1;
  if (v < 2 && touch && s.quality === 'medium') out.quality = 'high';
  if (!(out.quality in QUALITY)) out.quality = d.quality;
  if (typeof out.perf !== 'boolean') out.perf = false;
  out.v = SETTINGS_VERSION;
  return out;
}
