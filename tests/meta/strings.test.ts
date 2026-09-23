import { describe, it, expect } from 'vitest';
import { META_STRINGS, metaText } from '../../src/meta/strings';
import { TRICK_IDS, RANKS } from '../../src/meta/style';
import { CHALLENGES } from '../../src/meta/challenges';

describe('META_STRINGS', () => {
  it('names every trick in EN and HE', () => {
    expect(TRICK_IDS.length).toBe(31); // 28 + the three STRIKE tricks
    for (const id of TRICK_IDS) {
      expect(META_STRINGS.en[`trick.${id}`], id).toBeTruthy();
      expect(META_STRINGS.he[`trick.${id}`], id).toBeTruthy();
      expect(META_STRINGS.en[`trick.${id}`]).toBe(META_STRINGS.en[`trick.${id}`].toUpperCase());
    }
    expect(META_STRINGS.en['trick.returnToSender']).toBe('RETURN TO SENDER');
    expect(META_STRINGS.he['trick.returnToSender']).toBe('החזרה לשולח');
    expect(META_STRINGS.he['trick.splashdown']).toBe('צלילה');
  });

  it('has every challenge title/desc and the daily templates', () => {
    for (const c of CHALLENGES) {
      for (const lang of ['en', 'he'] as const) {
        expect(META_STRINGS[lang][c.titleKey], `${lang} ${c.titleKey}`).toBeTruthy();
        expect(META_STRINGS[lang][c.descKey], `${lang} ${c.descKey}`).toBeTruthy();
      }
    }
    for (const t of ['count', 'within', 'combo', 'air', 'ghost']) {
      expect(META_STRINGS.en[`challenge.daily.${t}.desc`]).toContain('{trick}');
      expect(META_STRINGS.he[`challenge.daily.${t}.desc`]).toContain('{trick}');
    }
  });

  it('EN and HE have the same keys; ranks and overlay strings exist', () => {
    expect(Object.keys(META_STRINGS.he).sort()).toEqual(Object.keys(META_STRINGS.en).sort());
    for (const r of RANKS) expect(META_STRINGS.en[`rank.${r}`]).toBe(r);
    for (const k of ['replay.title', 'replay.tag', 'replay.combo', 'clip.recording', 'clip.share', 'photo.snap']) {
      expect(META_STRINGS.en[k]).toBeTruthy();
      expect(META_STRINGS.he[k]).toBeTruthy();
    }
  });

  it('metaText falls back and fills vars', () => {
    expect(metaText('trick.boom', 'he')).toBe('בום');
    expect(metaText('missing.key', 'he')).toBe('missing.key');
    expect(metaText('challenge.daily.count.desc', 'en', { trick: 'BOOM', n: 3 })).toBe('Land BOOM ×3 today.');
  });
});
