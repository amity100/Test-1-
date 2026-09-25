import { describe, expect, it } from 'vitest';
import { isCompact, readTime, TIP, TipState } from '../../src/ui/hintstrip';
import { setDevice, setLang, t } from '../../src/ui/i18n';

const run = (s: TipState, sec: number) => {
  let changes = 0;
  for (let i = 0; i < Math.round(sec * 60); i++) if (s.update(1 / 60)) changes++;
  return changes;
};

describe('compact hint (phones)', () => {
  it('is compact on touch only: a locked mouse or a pad could never tap it open, whatever the window size', () => {
    expect(isCompact(true)).toBe(true);
    expect(isCompact(false)).toBe(false);
  });

  it('shows the strip a few seconds, folds into the tab, then goes', () => {
    const s = new TipState();
    expect(s.view).toBe('off');
    s.show('Rifts are doors.', 9);
    expect(s.view).toBe('strip');
    run(s, TIP.strip - 0.1);
    expect(s.view).toBe('strip');
    run(s, 0.2);
    expect(s.view).toBe('tab');
    run(s, TIP.tab - 0.2);
    expect(s.view).toBe('tab');
    run(s, 0.3);
    expect(s.view).toBe('off');
  });

  it('a short hint keeps its own shorter time as the strip', () => {
    const s = new TipState();
    s.show('LOOP again.', 2);
    run(s, 2.1);
    expect(s.view).toBe('tab');
  });

  it('a tap opens the whole text for its reading time; another folds it', () => {
    const s = new TipState();
    const html = t('hint.door');
    s.show(html, 9);
    s.tap();
    expect(s.view).toBe('open');
    // the open text outlasts the strip's time
    run(s, TIP.strip + 0.5);
    expect(s.view).toBe('open');
    s.tap();
    expect(s.view).toBe('tab');
    // from the tab, a tap opens it again; left alone it folds back after its reading time
    s.tap();
    expect(s.view).toBe('open');
    run(s, readTime(html) + 0.1);
    expect(s.view).toBe('tab');
  });

  it('a tap with nothing up does nothing; clear hides everything', () => {
    const s = new TipState();
    s.tap();
    expect(s.view).toBe('off');
    s.show('x', 9);
    s.tap();
    s.clear();
    expect(s.view).toBe('off');
    expect(run(s, 1)).toBe(0);
  });

  it('reading time grows with the words (tags do not count) within bounds', () => {
    expect(readTime('Short.')).toBe(TIP.openMin);
    const long = Array.from({ length: 200 }, () => 'word').join(' ');
    expect(readTime(long)).toBe(TIP.openMax);
    const plain = 'Rifts are doors. Hold PORTAL: the orange ENTRANCE opens in front of you, and a ghost shows where.';
    const tagged = 'Rifts are doors. Hold <b>PORTAL</b>: the orange <b>ENTRANCE</b> opens in front of you, and a ghost shows where.';
    expect(readTime(tagged)).toBeCloseTo(readTime(plain));
    expect(readTime(plain)).toBeGreaterThan(TIP.openMin);
  });

  it('every touch lesson hint gets more reading time than the strip', () => {
    setDevice('touch');
    for (const lang of ['en', 'he'] as const) {
      setLang(lang);
      for (const k of ['hint.door', 'hint.trapdoor', 'hint.slingshot', 'hint.boss']) expect(readTime(t(k)), `${lang} ${k}`).toBeGreaterThan(TIP.strip);
    }
    setLang('en');
    setDevice('kbm');
  });
});
