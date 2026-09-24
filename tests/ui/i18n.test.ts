import { afterEach, describe, expect, it } from 'vitest';
import type { EnemyState, LessonId, TrickId, ZoneId } from '../../src/core/contracts';
import { addStrings, formatNumber, getLang, has, setDevice, setLang, strings, t } from '../../src/ui/i18n';
import { META_STRINGS } from '../../src/meta/strings';
import { LEAD_STRINGS } from '../../src/game/strings';

const ZONES: ZoneId[] = ['pier', 'yard', 'skeleton', 'lab', 'crown'];
const LESSONS: LessonId[] = [
  'door', 'trapdoor', 'returnToSender', 'slingshot', 'arena', 'loop', 'cargo', 'matador',
  'grenade', 'shield', 'firingLine', 'hijack', 'borrowedGun', 'boss', 'leap',
];
const TRICKS: TrickId[] = [
  'returnToSender', 'crossfire', 'postage', 'firingLine', 'borrowedGun', 'trapdoor', 'splashdown', 'void', 'skyfall',
  'matador', 'bowling', 'headsUp', 'loop', 'cannonball', 'slingshot', 'comet', 'guillotine', 'cargo', 'boom',
  'finisher', 'ghost', 'airtime', 'double', 'triple', 'multi', 'mirror', 'hijack', 'juggle',
];

const STATES: EnemyState[] = ['idle', 'patrol', 'suspicious', 'combat', 'stagger', 'charge', 'launched', 'downed', 'stunned', 'dead'];

/** Every source file as text, to find the keys the game names. */
const SOURCES = import.meta.glob('../../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
/** The string tables themselves (they define keys; their comments name key patterns). */
const TABLES = ['/src/ui/i18n.ts', '/src/meta/strings.ts', '/src/game/strings.ts'];
const LITERAL_KEY =
  /['`]((?:aim|gate|portal|strike|prompt|hint|toast|obj|bark|respawn|hud|touch|ctl|key|menu|set|end|clip|photo|outcome|orient|kind|rule|zone|state|trick|challenge|briefing|boot)\.[A-Za-z0-9_.]+)['`]/g;

/** DESIGN §12 canonical keys (trick.* / challenge.* come from META; tricks have UI fallbacks). */
const CANONICAL = [
  ...ZONES.flatMap((z) => [`zone.${z}.name`, `zone.${z}.sub`]),
  ...LESSONS.map((l) => `hint.${l}`),
  'rule.1', 'rule.2', 'rule.3',
  'aim.tooHigh', 'aim.range', 'aim.los', 'aim.enemyClose', 'aim.space', 'aim.noSurface',
  'portal.air', 'portal.grab', 'portal.load', 'portal.hijack', 'portal.hole', 'portal.door',
  'portal.anchored', 'portal.noFloor', 'portal.nowhere', 'portal.loopLow',
  'gate.steady', 'gate.enemyClose', 'gate.noSpace', 'gate.range', 'gate.noExit',
  'outcome.splash', 'outcome.void', 'outcome.skull', 'outcome.stars', 'outcome.safe',
  'prompt.blade', 'prompt.grab', 'prompt.throw', 'prompt.hijack', 'prompt.lift', 'prompt.drop',
  'obj.clear', 'obj.lift', 'obj.boss', 'obj.escape',
  'toast.checkpoint', 'toast.hijack', 'toast.clipSaved', 'toast.clipFailed', 'toast.photoSaved', 'toast.challenge', 'toast.zoneClear',
  'bark.contact', 'bark.reload', 'bark.grenade', 'bark.charge', 'bark.lost', 'bark.where', 'bark.there', 'bark.mateDown', 'bark.what', 'bark.boss1', 'bark.boss2', 'bark.boss3',
  ...TRICKS.map((id) => `trick.${id}`),
];

/** Keys the UI itself renders. */
const UI_KEYS = [
  'title', 'subtitle', 'loading', 'menu.play', 'menu.continue', 'menu.zones', 'menu.challenges', 'menu.controls',
  'menu.settings', 'menu.language', 'menu.quit', 'menu.resume', 'menu.restart', 'menu.retry', 'menu.back', 'menu.paused',
  'briefing.title', 'briefing.text', 'set.quality', 'set.low', 'set.medium', 'set.high', 'set.ultra', 'set.sensitivity',
  'set.invertY', 'set.slowmo', 'end.victory', 'end.defeat', 'end.rank', 'end.time', 'end.kills', 'end.bestCombo',
  'end.styleTotal', 'end.tricks', 'end.challenges', 'end.deaths', 'clip.title', 'clip.saving', 'clip.share',
  'clip.download', 'clip.close', 'photo.title', 'photo.snap', 'photo.exit', 'respawn.void', 'respawn.dead',
  'ctl.padLine', 'orient.auto', 'orient.hatch', 'orient.door', 'kind.floor', 'kind.wall', 'kind.ceiling', 'kind.stand',
  'kind.air', 'touch.portal', 'strike.reflect', 'strike.loop', 'strike.loop.again', 'strike.swap', 'strike.dash',
  'ctl.portal', 'ctl.cancel', 'ctl.strike1', 'ctl.strike2', 'ctl.strike3', 'ctl.strike4', 'ctl.touch.portal',
  'hint.strikes', 'hint.grabHold', 'hint.loopAgain', 'hint.doorPlaced', 'bark.grabbed',
];

afterEach(() => {
  setLang('en');
  setDevice('kbm');
});

describe('i18n coverage', () => {
  it('every canonical §12 key exists in EN and HE', () => {
    const en = strings('en'),
      he = strings('he');
    const missing = CANONICAL.filter((k) => !(k in en) || !(k in he));
    expect(missing).toEqual([]);
  });

  it('every UI key exists in EN and HE', () => {
    const en = strings('en'),
      he = strings('he');
    expect(UI_KEYS.filter((k) => !(k in en) || !(k in he))).toEqual([]);
  });

  it('EN and HE have the same key set (device variants included)', () => {
    const en = Object.keys(strings('en')).sort(),
      he = Object.keys(strings('he')).sort();
    expect(en.filter((k) => !he.includes(k))).toEqual([]);
    expect(he.filter((k) => !en.includes(k))).toEqual([]);
  });

  it('hints that name desktop controls have .pad and .touch variants', () => {
    for (const lang of ['en', 'he'] as const) {
      const d = strings(lang);
      for (const l of LESSONS) {
        if (!d[`hint.${l}`].includes('<kbd>')) continue;
        expect(d[`hint.${l}.pad`], `${lang} hint.${l}.pad`).toBeTruthy();
        expect(d[`hint.${l}.touch`], `${lang} hint.${l}.touch`).toBeTruthy();
        expect(d[`hint.${l}.touch`], `${lang} hint.${l}.touch has no key caps`).not.toContain('<kbd>');
      }
    }
  });

  it('every key the game names literally exists in EN and HE (the string tables merged as the game merges them)', () => {
    const en = { ...strings('en'), ...META_STRINGS.en, ...LEAD_STRINGS.en },
      he = { ...strings('he'), ...META_STRINGS.he, ...LEAD_STRINGS.he };
    const missing = new Set<string>();
    let found = 0;
    for (const [path, src] of Object.entries(SOURCES)) {
      if (TABLES.some((f) => path.endsWith(f))) continue;
      for (const m of src.matchAll(LITERAL_KEY)) {
        found++;
        if (!(m[1] in en) || !(m[1] in he)) missing.add(`${m[1]} (${path})`);
      }
    }
    expect(found).toBeGreaterThan(100);
    expect([...missing]).toEqual([]);
  });

  it('rift vision labels every enemy state in both languages', () => {
    for (const s of STATES) {
      expect(strings('en')[`state.${s}`], `en state.${s}`).toBeTruthy();
      expect(strings('he')[`state.${s}`], `he state.${s}`).toBeTruthy();
    }
  });

  it('no empty strings and Hebrew strings contain Hebrew', () => {
    const he = strings('he');
    const latinOnly = new Set(['title', 'orient.auto']);
    for (const [k, v] of Object.entries(strings('en'))) expect(v.trim(), k).not.toBe('');
    for (const [k, v] of Object.entries(he)) {
      expect(v.trim(), k).not.toBe('');
      if (!latinOnly.has(k)) expect(/[֐-׿]/.test(v), `he ${k} is Hebrew`).toBe(true);
    }
  });
});

describe('hidden blade', () => {
  it('its prompt and trick carry the blade name in both languages', () => {
    for (const k of ['prompt.blade', 'trick.finisher']) {
      expect(strings('en')[k], k).toBe('HIDDEN BLADE');
      expect(strings('he')[k], k).toBe('להב נסתר');
    }
    expect(has('prompt.finish')).toBe(false);
  });
});

describe('t()', () => {
  it('falls back to the key itself', () => {
    expect(t('no.such.key')).toBe('no.such.key');
    expect(has('no.such.key')).toBe(false);
    expect(has('rule.1')).toBe(true);
  });

  it('switches language', () => {
    setLang('he');
    expect(getLang()).toBe('he');
    expect(t('zone.pier.name')).toBe('הרציף');
    setLang('en');
    expect(t('zone.pier.name')).toBe('THE PIER');
  });

  it('falls back to English when a language lacks a key', () => {
    addStrings('en', { 'only.en': 'English only' });
    setLang('he');
    expect(t('only.en')).toBe('English only');
  });

  it('prefers device variants for the current device', () => {
    setDevice('kbm');
    expect(t('hint.door')).toContain('LMB');
    setDevice('pad');
    expect(t('hint.door')).toContain('RT');
    setDevice('touch');
    expect(t('hint.door')).toContain('PORTAL');
    // no variant: base key
    expect(t('hint.arena')).toBe(strings('en')['hint.arena']);
    setLang('he');
    expect(t('hint.door')).toBe(strings('he')['hint.door.touch']);
  });

  it('substitutes vars (every occurrence)', () => {
    addStrings('en', { 'test.vars': '{n} of {m}, {n}!' });
    expect(t('test.vars', { n: 2, m: 5 })).toBe('2 of 5, 2!');
  });

  it('addStrings merges and overrides', () => {
    const before = t('trick.loop');
    addStrings('en', { 'trick.loop': 'LOOP-DE-LOOP', 'challenge.pier.rts.title': 'Return ×3' });
    addStrings('he', { 'challenge.pier.rts.title': 'החזרה ×3' });
    expect(t('trick.loop')).toBe('LOOP-DE-LOOP');
    expect(t('challenge.pier.rts.title')).toBe('Return ×3');
    setLang('he');
    expect(t('challenge.pier.rts.title')).toBe('החזרה ×3');
    // other keys untouched
    expect(t('rule.1')).toBe(strings('he')['rule.1']);
    setLang('en');
    addStrings('en', { 'trick.loop': before });
  });

  it('formats HUD numbers with thousands separators', () => {
    expect(formatNumber(12400)).toBe('12,400');
    expect(formatNumber(999.6)).toBe('1,000');
  });
});
