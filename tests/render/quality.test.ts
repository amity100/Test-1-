import { describe, expect, it } from 'vitest';
import { defaultQuality, liteContent, QUALITY, renderPixelRatio, type QualityName } from '../../src/config';
import { readSettings, SETTINGS_VERSION } from '../../src/game/settings';

describe('resolution policy', () => {
  it('every device starts on the PC look (high)', () => {
    expect(defaultQuality(true)).toBe('high');
    expect(defaultQuality(false)).toBe('high');
  });

  it('renders at the device resolution up to the preset cap for the device type', () => {
    // [preset, device DPR, touch, expected]
    const table: [QualityName, number, boolean, number][] = [
      // desktops: unchanged (high caps at 1.5)
      ['high', 1, false, 1],
      ['high', 1.25, false, 1.25],
      ['high', 2, false, 1.5],
      ['ultra', 3, false, 2],
      ['medium', 2, false, 1],
      ['low', 1, false, 0.75],
      // phones: high is 2x (a DPR-3 phone renders 2x: 4x the pixels of the old 1x default)
      ['high', 3, true, 2],
      ['high', 2, true, 2],
      ['high', 1.5, true, 1.5],
      ['ultra', 3, true, 3],
      ['medium', 3, true, 1.5],
      ['low', 3, true, 1],
    ];
    for (const [q, dev, touch, want] of table) expect(renderPixelRatio(QUALITY[q], dev, touch), `${q} @${dev} ${touch ? 'touch' : 'desk'}`).toBe(want);
  });

  it('never renders above the device resolution, and survives a missing DPR', () => {
    for (const q of Object.keys(QUALITY) as QualityName[]) {
      for (const dev of [0.5, 1, 1.75, 2.625, 3.5]) {
        expect(renderPixelRatio(QUALITY[q], dev, true)).toBeLessThanOrEqual(dev);
        expect(renderPixelRatio(QUALITY[q], dev, false)).toBeLessThanOrEqual(dev);
      }
      expect(renderPixelRatio(QUALITY[q], NaN, true)).toBeLessThanOrEqual(1);
      expect(renderPixelRatio(QUALITY[q], 0, false)).toBeLessThanOrEqual(1);
    }
  });
});

describe('world content per preset', () => {
  it("builds the PC's world on a phone at high and ultra, the lighter one at low and medium; a desktop always the full one", () => {
    const table: [QualityName, boolean, boolean][] = [
      ['high', true, false],
      ['ultra', true, false],
      ['medium', true, true],
      ['low', true, true],
      ['high', false, false],
      ['ultra', false, false],
      ['medium', false, false],
      ['low', false, false],
    ];
    for (const [q, touch, lite] of table) expect(liteContent(QUALITY[q], touch), `${q} ${touch ? 'touch' : 'desk'}`).toBe(lite);
    // (the default: every device gets the full world)
    for (const touch of [true, false]) expect(liteContent(QUALITY[defaultQuality(touch)], touch)).toBe(false);
  });
});

describe('settings migration', () => {
  it('no saved settings: the defaults (high, overlay off)', () => {
    for (const touch of [true, false]) {
      const s = readSettings(null, touch);
      expect(s.quality).toBe('high');
      expect(s.perf).toBe(false);
      expect(s.v).toBe(SETTINGS_VERSION);
    }
    expect(readSettings('not json', true).quality).toBe('high');
    expect(readSettings('[1,2]', true).quality).toBe('high');
  });

  it("a phone's saved v1 medium (the old default) becomes high; its other choices stay", () => {
    const s = readSettings(JSON.stringify({ quality: 'medium', sensitivity: 1.4, invertY: true, slowmo: false }), true);
    expect(s.quality).toBe('high');
    expect(s.sensitivity).toBe(1.4);
    expect(s.invertY).toBe(true);
    expect(s.slowmo).toBe(false);
    expect(s.v).toBe(SETTINGS_VERSION);
  });

  it('keeps every other v1 pick, and anything saved from v2 on', () => {
    expect(readSettings(JSON.stringify({ quality: 'low' }), true).quality).toBe('low');
    expect(readSettings(JSON.stringify({ quality: 'ultra' }), true).quality).toBe('ultra');
    // (desktops never defaulted to medium: a desktop's medium was chosen)
    expect(readSettings(JSON.stringify({ quality: 'medium' }), false).quality).toBe('medium');
    // a phone that picks medium after the migration keeps it
    expect(readSettings(JSON.stringify({ quality: 'medium', v: 2 }), true).quality).toBe('medium');
    expect(readSettings(JSON.stringify({ quality: 'high', perf: true, v: 2 }), true).perf).toBe(true);
  });

  it('an unknown preset falls back to the default', () => {
    expect(readSettings(JSON.stringify({ quality: 'insane', v: 2 }), false).quality).toBe('high');
  });
});
