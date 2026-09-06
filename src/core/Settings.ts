export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export type Language = 'he' | 'en';

export interface SettingsData {
  quality: Quality | 'auto';
  language: Language;
  sensitivity: number;
  fov: number;
  volume: number;
  music: number;
  invertY: boolean;
  showFps: boolean;
  playerName: string;
  /** Touch: fire automatically while the crosshair rests on an enemy. */
  autoFire: boolean;
  /** Touch: slow the camera and gently follow enemies near the crosshair. */
  aimAssist: boolean;
  /** Touch: on-screen control size multiplier. */
  touchScale: number;
  /** Touch: on-screen control opacity. */
  touchOpacity: number;
  /** Last chosen primary weapon and gadget kit (round loadout). */
  primary: string;
  kit: string[];
}

const KEY = 'flagkeep.settings.v1';

const DEFAULTS: SettingsData = {
  quality: 'auto',
  language: (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('he')) ? 'he' : 'en',
  sensitivity: 1.0,
  fov: 72,
  volume: 0.8,
  music: 0.5,
  invertY: false,
  showFps: false,
  playerName: '',
  autoFire: true,
  aimAssist: true,
  touchScale: 1,
  touchOpacity: 0.7,
  primary: 'rifle',
  kit: ['zipline', 'breach'],
};

export class Settings {
  data: SettingsData = { ...DEFAULTS };
  resolvedQuality: Quality = 'high';

  load(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<SettingsData> & { v?: number };
        // v2: the old 80° vertical default was a fisheye; keep custom values, replace the old default.
        if (stored.v === undefined) {
          if (stored.fov === 80) stored.fov = 72;
        }
        this.data = { ...DEFAULTS, ...stored };
      }
    } catch {
      /* storage unavailable */
    }
  }

  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...this.data, v: 2 }));
    } catch {
      /* ignore */
    }
  }

  /** Picks a quality tier from GPU hints when quality is 'auto'. */
  resolveQuality(gpuName: string): Quality {
    if (this.data.quality !== 'auto') {
      this.resolvedQuality = this.data.quality;
      return this.resolvedQuality;
    }
    const g = gpuName.toLowerCase();
    let q: Quality = 'high';
    if (/swiftshader|llvmpipe|software/.test(g)) q = 'low';
    else if (/mali|adreno|powervr|apple gpu|apple a\d/.test(g)) q = 'medium';
    else if (/intel/.test(g) && !/arc/.test(g)) q = 'medium';
    else if (/nvidia|geforce|rtx|radeon|amd|arc/.test(g)) q = 'high';
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 4 : 4;
    if (cores <= 2 && q !== 'low') q = 'medium';
    if (typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 600 && q === 'high') q = 'medium';
    this.resolvedQuality = q;
    return q;
  }
}

export const settings = new Settings();
