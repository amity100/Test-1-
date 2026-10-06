import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// A CSS / markup contract for the phone menus (no DOM here): the PLAY button must never be pushed off
// the top of a scroller, and must stay in reach while the menu scrolls.
const css = readFileSync('src/ui/style.css', 'utf8');
const menu = readFileSync('src/ui/menu.ts', 'utf8');

const rules = (sel: string) => [...css.matchAll(/(^|\n)\s*([^{}\n@][^{}]*)\{([^}]*)\}/g)].filter((m) => m[2].split(',').some((x) => x.trim() === sel)).map((m) => m[3]);

describe('phone menu layout', () => {
  it('never centres an overflowing menu with justify-content (the top becomes unreachable)', () => {
    for (const body of rules('.menu.on')) expect(body).not.toMatch(/justify-content:\s*center/);
    expect(rules('.menu.main')).toEqual(expect.not.arrayContaining([expect.stringMatching(/justify-content:\s*center/)]));
    expect(css).toMatch(/\.menu\.on > :first-child \{ margin-top: auto; \}/);
    expect(css).toMatch(/\.menu\.on > :last-child \{ margin-bottom: auto; \}/);
  });
  it('the main and pause menus put their primary button in a sticky lead row', () => {
    expect(menu.match(/class="btns lead"><button type="button" class="primary" data-go="(start|resume)"/g)?.length).toBe(2);
    expect(css).toMatch(/\.btns\.lead \{ position: sticky;/);
  });
  it('touch targets in short landscape are at least 44px', () => {
    expect(css).toMatch(/@media \(max-height: 520px\) \{[\s\S]*\.btns button[^{]*\{ min-height: 44px; \}/);
  });
  it('the result cards keep their buttons in reach', () => {
    expect(css).toMatch(/\.m-labend > \.btns\.row[^{]*\{ position: sticky; bottom:/);
  });
  it('the portrait rotate hint never swallows taps', () => {
    expect(css).toMatch(/\.is-touch \.ui::after \{[^}]*pointer-events: none/);
  });
});
